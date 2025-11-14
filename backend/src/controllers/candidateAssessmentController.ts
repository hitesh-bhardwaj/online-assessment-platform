import { Response } from 'express';
import mongoose from 'mongoose';

import { AuthenticatedRequest } from '../middleware/auth';
import { Invitation, Question, AssessmentResult } from '../models';
import { queueRecordingMerge } from '../utils/recording-queue';

type QuestionOption = {
  id: string;
  text: string;
};

type CodingTestCase = {
  input: string;
  expectedOutput: string;
};

const toSafeObjectId = (value: unknown): mongoose.Types.ObjectId | undefined => {
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return undefined;
};

const defaultProctoringSummary = 'Proctoring events recorded. Detailed analysis forthcoming.';

const candidateAssessmentController = {
  /**
   * Start the assessment timer - creates AssessmentResult with startedAt timestamp
   * Called when candidate completes consent dialog
   */
  async startAssessment(req: AuthenticatedRequest, res: Response) {
    try {
      const candidateSession = req.candidate;
      if (!candidateSession) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const requestedAssessmentId = req.params.assessmentId;
      if (!requestedAssessmentId || candidateSession.assessmentId !== requestedAssessmentId) {
        return res.status(403).json({ success: false, message: 'Assessment access denied' });
      }

      const invitation = await Invitation.findById(candidateSession.invitationId)
        .populate({
          path: 'assessmentId',
          select: 'settings',
        });

      if (!invitation || !invitation.assessmentId) {
        return res.status(404).json({ success: false, message: 'Invitation not found' });
      }

      if (!invitation.isValid()) {
        return res.status(401).json({ success: false, message: 'Invitation expired' });
      }

      // Check if AssessmentResult already exists
      let result = await AssessmentResult.findOne({ invitationId: invitation._id });

      if (!result) {
        // Create AssessmentResult with startedAt = NOW (when consent is granted)
        result = new AssessmentResult({
          invitationId: invitation._id,
          responses: [],
          score: {
            total: 0,
            earned: 0,
            percentage: 0,
            breakdown: {
              mcq: { total: 0, earned: 0, count: 0 },
              msq: { total: 0, earned: 0, count: 0 },
              coding: { total: 0, earned: 0, count: 0 },
            },
          },
          status: 'in_progress',
          startedAt: new Date(),
          performanceMetrics: {
            totalTimeSpent: 0,
            averageTimePerQuestion: 0,
            questionsAttempted: 0,
            questionsSkipped: 0,
            reviewCount: 0,
          },
          proctoringReport: {
            events: [],
            trustScore: 100,
            riskLevel: 'low',
            summary: defaultProctoringSummary,
            recordingUrls: {},
            mediaSegments: [],
          },
        });
        await result.save();

        console.log(`[startAssessment] Created AssessmentResult for invitation ${invitation._id}, startedAt: ${result.startedAt}`);
      }

      res.json({
        success: true,
        data: {
          startedAt: result.startedAt,
          status: result.status,
        },
      });
    } catch (error) {
      console.error('[candidateAssessmentController] startAssessment error', error);
      res.status(500).json({
        success: false,
        message: 'Unable to start assessment',
      });
    }
  },

  async getAssessmentContent(req: AuthenticatedRequest, res: Response) {
    try {
      const candidateSession = req.candidate;
      if (!candidateSession) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const requestedAssessmentId = req.params.assessmentId;
      if (!requestedAssessmentId || candidateSession.assessmentId !== requestedAssessmentId) {
        return res.status(403).json({ success: false, message: 'Assessment access denied' });
      }

      const invitation = await Invitation.findById(candidateSession.invitationId)
        .populate({
          path: 'assessmentId',
          select: 'title description type instructions settings questions',
        });

      if (!invitation || !invitation.assessmentId) {
        return res.status(404).json({ success: false, message: 'Assessment not found' });
      }

      if (!invitation.isValid()) {
        return res.status(401).json({ success: false, message: 'Assessment invitation expired' });
      }

      const assessmentDoc = invitation.assessmentId as any;
      const questionRefs: Array<{ questionId: mongoose.Types.ObjectId; order: number; points: number }> =
        Array.isArray(assessmentDoc.questions) ? [...assessmentDoc.questions] : [];

      // Sort by order first
      questionRefs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      // Shuffle questions if enabled (Fisher-Yates algorithm)
      if (assessmentDoc.settings?.shuffleQuestions === true) {
        for (let i = questionRefs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [questionRefs[i], questionRefs[j]] = [questionRefs[j], questionRefs[i]];
        }
      }

      const questionIds = questionRefs
        .map((ref) => toSafeObjectId(ref.questionId))
        .filter((id): id is mongoose.Types.ObjectId => Boolean(id));

      const questionDocs = await Question.find({ _id: { $in: questionIds } })
        .select('type title description options codingDetails difficulty tags estimatedTimeMinutes category')
        .lean();

      const questionMap = new Map<string, typeof questionDocs[number]>(
        questionDocs.map((question) => [question._id.toString(), question])
      );

      const assembledQuestions = questionRefs
        .map((ref) => {
          const questionDoc = questionMap.get(ref.questionId.toString());
          if (!questionDoc) return null;

          const base = {
            id: ref.questionId.toString(),
            order: ref.order,
            points: ref.points,
            type: questionDoc.type,
            title: questionDoc.title,
            description: questionDoc.description,
            difficulty: questionDoc.difficulty,
            estimatedTimeMinutes: questionDoc.estimatedTimeMinutes,
            category: questionDoc.category,
            tags: questionDoc.tags,
          };

          if (questionDoc.type === 'mcq' || questionDoc.type === 'msq') {
            let options: QuestionOption[] =
              questionDoc.options?.map((option) => ({
                id: option.id,
                text: option.text,
              })) ?? [];

            // Shuffle options if enabled (Fisher-Yates algorithm)
            if (assessmentDoc.settings?.shuffleOptions === true) {
              for (let i = options.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [options[i], options[j]] = [options[j], options[i]];
              }
            }

            return {
              ...base,
              options,
            };
          }

          if (questionDoc.type === 'coding') {
            const codingDetails = questionDoc.codingDetails ?? {};
            const publicTestCases: CodingTestCase[] =
              codingDetails.testCases
                ?.filter((testCase) => !testCase.isHidden)
                .map((testCase) => ({
                  input: testCase.input,
                  expectedOutput: testCase.expectedOutput,
                })) ?? [];

            return {
              ...base,
              codingDetails: {
                language: codingDetails.language,
                starterCode: codingDetails.starterCode,
                timeLimit: codingDetails.timeLimit,
                memoryLimit: codingDetails.memoryLimit,
                sampleTestCases: publicTestCases,
              },
            };
          }

          return base;
        })
        .filter((question): question is NonNullable<typeof question> => Boolean(question));

      const existingResult = await AssessmentResult.findOne({ invitationId: invitation._id })
        .select('status responses startedAt score submittedAt')
        .lean();

      const progress = existingResult
        ? {
            status: existingResult.status,
            responses:
              existingResult.responses?.map((response) => ({
                questionId: response.questionId.toString(),
                answer: response.answer,
                timeTaken: response.timeTaken,
                attempts: response.attempts,
              })) ?? [],
          }
        : null;

      res.json({
        success: true,
        data: {
          assessment: {
            id: assessmentDoc._id.toString(),
            title: assessmentDoc.title,
            description: assessmentDoc.description,
            type: assessmentDoc.type,
            instructions: assessmentDoc.instructions,
            settings: assessmentDoc.settings,
            questionCount: assembledQuestions.length,
          },
          questions: assembledQuestions,
          session: {
            status: invitation.status,
            validFrom: invitation.validFrom,
            validUntil: invitation.validUntil,
            attemptsUsed: invitation.sessionData?.attemptsUsed ?? 0,
            remindersSent: invitation.remindersSent,
            startedAt: existingResult?.startedAt ?? null,
            serverTime: new Date(),
          },
          progress,
          resultSummary:
            existingResult &&
            existingResult.status === 'completed' &&
            existingResult.score &&
            assessmentDoc.settings?.showResultsToCandidate === true
              ? {
                  score: existingResult.score,
                  submittedAt: existingResult.submittedAt,
                }
              : undefined,
        },
      });
    } catch (error) {
      console.error('[candidateAssessmentController] getAssessmentContent error', error);
      res.status(500).json({
        success: false,
        message: 'Unable to load assessment content',
      });
    }
  },

  async saveAssessmentProgress(req: AuthenticatedRequest, res: Response) {
    try {
      const candidateSession = req.candidate;
      if (!candidateSession) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const requestedAssessmentId = req.params.assessmentId;
      if (!requestedAssessmentId || candidateSession.assessmentId !== requestedAssessmentId) {
        return res.status(403).json({ success: false, message: 'Assessment access denied' });
      }

      const { questionId, answer, timeTaken } = req.body ?? {};

      if (!questionId) {
        return res.status(400).json({ success: false, message: 'questionId is required' });
      }

      const invitation = await Invitation.findById(candidateSession.invitationId)
        .populate({
          path: 'assessmentId',
          select: 'questions settings',
        });

      if (!invitation || !invitation.assessmentId) {
        return res.status(404).json({ success: false, message: 'Invitation not found' });
      }

      if (!invitation.isValid()) {
        return res.status(401).json({ success: false, message: 'Invitation expired' });
      }

      const assessmentDoc = invitation.assessmentId as any;
      const validQuestion = Array.isArray(assessmentDoc.questions)
        ? assessmentDoc.questions.some((ref: { questionId: mongoose.Types.ObjectId | string }) =>
            ref.questionId.toString() === questionId
          )
        : false;

      if (!validQuestion) {
        return res.status(400).json({ success: false, message: 'Question does not belong to this assessment' });
      }

      let result = await AssessmentResult.findOne({ invitationId: invitation._id });
      if (!result) {
        result = new AssessmentResult({
          invitationId: invitation._id,
          responses: [],
          score: {
            total: 0,
            earned: 0,
            percentage: 0,
            breakdown: {
              mcq: { total: 0, earned: 0, count: 0 },
              msq: { total: 0, earned: 0, count: 0 },
              coding: { total: 0, earned: 0, count: 0 },
            },
          },
          status: 'in_progress',
          startedAt: new Date(),
          performanceMetrics: {
            totalTimeSpent: 0,
            averageTimePerQuestion: 0,
            questionsAttempted: 0,
            questionsSkipped: 0,
            reviewCount: 0,
          },
          proctoringReport: {
            events: [],
            trustScore: 100,
            riskLevel: 'low',
            summary: defaultProctoringSummary,
            recordingUrls: {},
            mediaSegments: []
          }
        });
      }

      const existingResponse = result.responses.find((response) => response.questionId.toString() === questionId);
      const normalizedAnswer = answer ?? null;
      const normalizedTime = typeof timeTaken === 'number' && timeTaken > 0 ? timeTaken : 0;

      if (existingResponse) {
        existingResponse.answer = normalizedAnswer;
        existingResponse.timeTaken = normalizedTime;
        existingResponse.submittedAt = new Date();
      } else {
        result.responses.push({
          questionId,
          answer: normalizedAnswer,
          timeTaken: normalizedTime,
          isCorrect: false,
          pointsEarned: 0,
          submittedAt: new Date(),
          attempts: 1,
        } as any);
      }

      result.performanceMetrics.questionsAttempted = result.responses.length;
      result.performanceMetrics.totalTimeSpent = result.responses.reduce((acc, response) => acc + (response.timeTaken ?? 0), 0);
      result.performanceMetrics.averageTimePerQuestion =
        result.performanceMetrics.questionsAttempted > 0
          ? Math.round(result.performanceMetrics.totalTimeSpent / result.performanceMetrics.questionsAttempted)
          : 0;

      await result.save();

      res.json({
        success: true,
        data: {
          questionId,
          status: normalizedAnswer === null || normalizedAnswer === '' ? 'in_progress' : 'answered',
        },
      });
    } catch (error) {
      console.error('[candidateAssessmentController] saveAssessmentProgress error', error);
      res.status(500).json({
        success: false,
        message: 'Unable to save assessment progress',
      });
    }
  },

  async submitAssessment(req: AuthenticatedRequest, res: Response) {
    try {
      const candidateSession = req.candidate;
      if (!candidateSession) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const requestedAssessmentId = req.params.assessmentId;
      if (!requestedAssessmentId || candidateSession.assessmentId !== requestedAssessmentId) {
        return res.status(403).json({ success: false, message: 'Assessment access denied' });
      }

      const invitation = await Invitation.findById(candidateSession.invitationId)
        .populate({
          path: 'assessmentId',
          select: 'questions settings',
        });

      if (!invitation || !invitation.assessmentId) {
        return res.status(404).json({ success: false, message: 'Invitation not found' });
      }

      const result = await AssessmentResult.findOne({ invitationId: invitation._id });
      if (!result) {
        return res.status(400).json({ success: false, message: 'No responses recorded yet' });
      }

      if (result.status === 'completed') {
        // Check if results should be shown to candidate based on assessment settings
        const showResultsToCandidate = assessmentDoc.settings?.showResultsToCandidate ?? false;

        return res.json({
          success: true,
          data: {
            summary: showResultsToCandidate
              ? {
                  score: result.score,
                  submittedAt: result.submittedAt,
                }
              : {
                  submittedAt: result.submittedAt,
                },
          },
        });
      }

      const assessmentDoc = invitation.assessmentId as any;
      const questionRefs: Array<{ questionId: mongoose.Types.ObjectId; points: number }> =
        Array.isArray(assessmentDoc.questions) ? [...assessmentDoc.questions] : [];
      const questionRefMap = new Map<string, { points: number }>();
      questionRefs.forEach((ref) => {
        questionRefMap.set(ref.questionId.toString(), { points: ref.points });
      });

      const questionIds = result.responses.map((response) => response.questionId.toString());
      const questionDocs = await Question.find({ _id: { $in: questionIds } })
        .select('type options')
        .lean();
      const questionDocMap = new Map<string, typeof questionDocs[number]>(
        questionDocs.map((doc) => [doc._id.toString(), doc])
      );

      let totalPoints = 0;
      let earnedPoints = 0;
      const breakdown = {
        mcq: { total: 0, earned: 0, count: 0 },
        msq: { total: 0, earned: 0, count: 0 },
        coding: { total: 0, earned: 0, count: 0 },
      };

      result.responses.forEach((response) => {
        const questionId = response.questionId.toString();
        const ref = questionRefMap.get(questionId);
        const doc = questionDocMap.get(questionId);

        if (!ref || !doc) {
          response.pointsEarned = 0;
          response.isCorrect = false;
          return;
        }

        const points = ref.points ?? 0;
        totalPoints += points;

        let isCorrect = false;
        let earned = 0;

        if (doc.type === 'mcq') {
          const correctOption = doc.options?.find((option: any) => option.isCorrect);
          if (typeof response.answer === 'string' && correctOption && response.answer === correctOption.id) {
            isCorrect = true;
            earned = points;
          }
          breakdown.mcq.total += points;
          breakdown.mcq.earned += earned;
          breakdown.mcq.count += 1;
        } else if (doc.type === 'msq') {
          const correctOptions = new Set(
            (doc.options ?? []).filter((option: any) => option.isCorrect).map((option: any) => option.id)
          );
          const provided = Array.isArray(response.answer) ? new Set(response.answer as string[]) : new Set<string>();

          if (correctOptions.size > 0 && correctOptions.size === provided.size) {
            isCorrect = Array.from(correctOptions).every((option) => provided.has(option));
          }

          if (isCorrect) {
            earned = points;
          }

          breakdown.msq.total += points;
          breakdown.msq.earned += earned;
          breakdown.msq.count += 1;
        } else {
          breakdown.coding.total += points;
          breakdown.coding.count += 1;
        }

        earnedPoints += earned;
        response.isCorrect = isCorrect;
        response.pointsEarned = earned;
        response.submittedAt = new Date();
      });

      result.score = {
        total: totalPoints,
        earned: earnedPoints,
        percentage: totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0,
        breakdown,
      };
      result.status = 'completed';
      result.submittedAt = new Date();

      await result.save();

      // Update invitation status to 'submitted'
      invitation.status = 'submitted';
      invitation.submittedAt = new Date();
      await invitation.save();

      // Start recording merge job in background (non-blocking)
      // This will merge video chunks and upload to R2 automatically
      if (result.proctoringReport?.mediaSegments && result.proctoringReport.mediaSegments.length > 0) {
        console.log(`[submitAssessment] Queuing recording merge for result: ${result._id}`);
        queueRecordingMerge(result._id.toString());
      }

      // Check if results should be shown to candidate based on assessment settings
      const showResultsToCandidate = assessmentDoc.settings?.showResultsToCandidate ?? false;

      res.json({
        success: true,
        data: {
          summary: showResultsToCandidate
            ? {
                score: result.score,
                submittedAt: result.submittedAt,
              }
            : {
                submittedAt: result.submittedAt,
              },
        },
      });
    } catch (error) {
      console.error('[candidateAssessmentController] submitAssessment error', error);
      res.status(500).json({
        success: false,
        message: 'Unable to submit assessment',
      });
    }
  },
};

export default candidateAssessmentController;
