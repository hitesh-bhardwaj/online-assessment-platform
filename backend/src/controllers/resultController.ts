import fs from 'fs';
import fsPromises from 'fs/promises';
import { Readable } from 'stream';
import { Response } from 'express';
import mongoose from 'mongoose';
import { AssessmentResult, Invitation, Assessment, SystemLog } from '../models';
import { IUserInfo } from '../models/SystemLog';
import { AuthenticatedRequest } from '../middleware/auth';
import logControllerError from '../utils/logger';
import { toObjectId, toObjectIdString } from '../utils/objectId';
import { fetchProctoringSegment } from '../utils/storage';

// Helper function to get user info for logging
const getUserInfo = (req: AuthenticatedRequest): IUserInfo => ({
  userId: toObjectId(req.user?._id),
  email: req.user?.email,
  role: req.user?.role,
  ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
  userAgent: req.get('User-Agent') || 'unknown'
});

const proctoringSeverityRank: Record<string, number> = { low: 0, medium: 1, high: 2 };
const defaultProctoringSummary = 'Proctoring events recorded. Detailed analysis forthcoming.';

export const resultController = {
  // Get all results for organization
  async getResults(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const {
        page = 1,
        limit = 10,
        status,
        assessmentId,
        search,
        minScore,
        maxScore
      } = req.query;

      const organizationId = toObjectId(user.organizationId);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier'
        });
      }

      // Get organization's assessments to filter results
      const organizationAssessments = await Assessment.find({
        organizationId,
        isActive: true
      }).select('_id');

      const assessmentIds = organizationAssessments.map(assessment => toObjectId(assessment._id)).filter((id): id is mongoose.Types.ObjectId => Boolean(id));

      // Get invitations for these assessments
      const invitations = await Invitation.find({
        assessmentId: { $in: assessmentIds }
      }).select('_id candidate assessmentId');

      const invitationIds = invitations.map(invitation => toObjectId(invitation._id)).filter((id): id is mongoose.Types.ObjectId => Boolean(id));

      // Build query
      const query: Record<string, unknown> = {
        invitationId: { $in: invitationIds }
      };

      if (typeof status === 'string') {
        query.status = status;
      }
      if (minScore !== undefined) {
        query['score.percentage'] = { $gte: Number(minScore) };
      }
      if (maxScore !== undefined) {
        query['score.percentage'] = {
          ...(query['score.percentage'] as Record<string, number> | undefined),
          $lte: Number(maxScore)
        };
      }

      // If specific assessment requested
      const requestedAssessmentId = typeof assessmentId === 'string' ? assessmentId : undefined;
      if (requestedAssessmentId) {
        const assessmentInvitations = invitations
          .filter(inv => toObjectIdString(inv.assessmentId) === requestedAssessmentId)
          .map(inv => toObjectId(inv._id))
          .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
        query.invitationId = { $in: assessmentInvitations };
      }

      const results = await AssessmentResult.find(query)
        .populate({
          path: 'invitationId',
          populate: {
            path: 'assessmentId',
            select: 'title type'
          }
        })
        .populate('reviewedBy', 'firstName lastName email')
        .sort({ submittedAt: -1 })
        .limit(Number(limit) * 1)
        .skip((Number(page) - 1) * Number(limit));

      // Filter by search if provided
      let filteredResults = results;
      if (search) {
        filteredResults = results.filter(result => {
          const invitation = result.invitationId as any;
          const candidate = invitation?.candidate;
          if (!candidate) return false;

          const searchTerm = search.toString().toLowerCase();
          return (
            candidate.firstName?.toLowerCase().includes(searchTerm) ||
            candidate.lastName?.toLowerCase().includes(searchTerm) ||
            candidate.email?.toLowerCase().includes(searchTerm) ||
            invitation.assessmentId?.title?.toLowerCase().includes(searchTerm)
          );
        });
      }

      const total = await AssessmentResult.countDocuments(query);

      const formattedResults = filteredResults.map(resultDoc => {
        const doc = resultDoc.toObject({ virtuals: true }) as any;
        const report = doc.proctoringReport ?? {};
        const events = Array.isArray(report.events) ? report.events : [];
        const baseRank = typeof report.riskLevel === 'string' ? proctoringSeverityRank[report.riskLevel] ?? 0 : 0;
        const highestRank = events.reduce((acc: number, event: any) => {
          if (!event) return acc;
          const severity = typeof event.severity === 'string' ? event.severity.toLowerCase() : 'low';
          return Math.max(acc, proctoringSeverityRank[severity] ?? acc);
        }, baseRank);

        const highestSeverity = Object.entries(proctoringSeverityRank).find(([, rank]) => rank === highestRank)?.[0];

        const flags: string[] = [];
        if (typeof highestSeverity === 'string') {
          flags.push(highestSeverity);
        }
        if (typeof report.riskLevel === 'string' && !flags.includes(report.riskLevel)) {
          flags.push(report.riskLevel);
        }

        const { events: _events, mediaSegments, ...restReport } = report || {};
        doc.proctoringReport = {
          ...restReport,
          summary: restReport?.summary ?? defaultProctoringSummary
        };
        doc.proctoringFlags = flags;

        return doc;
      });

      res.json({
        success: true,
        data: {
          results: formattedResults,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'result',
        action: 'get_results_error',
        message: 'Error retrieving results',
        error,
        extra: {
          handler: 'resultController.getResults'
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Get result by ID
  async getResultById(req: AuthenticatedRequest, res: Response) {
    try {
      const { resultId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const result = await AssessmentResult.findById(resultId)
        .populate({
          path: 'invitationId',
          populate: {
            path: 'assessmentId',
            populate: {
              path: 'organizationId',
              match: { _id: user.organizationId }
            }
          }
        })
        .populate('reviewedBy', 'firstName lastName email')
        .populate('responses.questionId', 'title type difficulty points');

      if (!result || !(result.invitationId as any)?.assessmentId?.organizationId) {
        return res.status(404).json({
          success: false,
          message: 'Result not found'
        });
      }

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'result',
        action: 'get_result_error',
        message: 'Error retrieving result by id',
        error,
        extra: {
          handler: 'resultController.getResultById',
          resultId: req.params.resultId
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Update result review
  async reviewResult(req: AuthenticatedRequest, res: Response) {
    try {
      const { resultId } = req.params;
      const { feedback, isPublic } = req.body;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const organizationId = toObjectId(user.organizationId);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier'
        });
      }

      const result = await AssessmentResult.findById(resultId)
        .populate({
          path: 'invitationId',
          populate: {
            path: 'assessmentId',
            populate: {
              path: 'organizationId',
              match: { _id: organizationId }
            }
          }
        });

      if (!result || !(result.invitationId as any)?.assessmentId?.organizationId) {
        return res.status(404).json({
          success: false,
          message: 'Result not found'
        });
      }

      // Update review fields
      if (feedback !== undefined) result.feedback = feedback.trim();
      if (isPublic !== undefined) result.isPublic = isPublic;
      const reviewerId = toObjectId(user._id);

      if (!reviewerId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reviewer identifier'
        });
      }

      result.reviewedBy = reviewerId;
      result.reviewedAt = new Date();

      await result.save();

      // Log the review
      await SystemLog.create({
        level: 'info',
        category: 'result',
        action: 'result_review',
        message: 'Result reviewed',
        details: {
          resultId,
          hasCustomFeedback: !!feedback,
          isPublic
        },
        context: {
          organizationId,
          resultId: toObjectId(result._id)
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Result reviewed successfully',
        data: {
          id: toObjectIdString(result._id),
          feedback: result.feedback,
          isPublic: result.isPublic,
          reviewedBy: reviewerId,
          reviewedAt: result.reviewedAt
        }
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'result',
        action: 'review_result_error',
        message: 'Error reviewing result',
        error,
        extra: {
          handler: 'resultController.reviewResult',
          resultId: req.params.resultId
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  async getProctoringDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const { resultId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const organizationId = toObjectId(user.organizationId);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier'
        });
      }

      const result = await AssessmentResult.findById(resultId)
        .populate({
          path: 'invitationId',
          populate: {
            path: 'assessmentId',
            select: 'title organizationId',
            populate: {
              path: 'organizationId',
              select: '_id',
              match: { _id: organizationId }
            }
          }
        })
        .lean();

      const invitation = result?.invitationId as any;
      if (!result || !invitation?.assessmentId?.organizationId) {
        return res.status(404).json({
          success: false,
          message: 'Result not found'
        });
      }

      const candidate = invitation.candidate ?? {};
      const assessment = invitation.assessmentId ?? {};
      const report = result.proctoringReport ?? {};

      const events = (Array.isArray(report.events) ? report.events : [])
        .map((event: any) => ({
          type: event.type,
          severity: event.severity,
          timestamp: event.timestamp,
          details: event.details
        }))
        .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime());

      const mediaSegments = (Array.isArray(report.mediaSegments) ? report.mediaSegments : [])
        .map((segment: any) => ({
          segmentId: segment.segmentId,
          type: segment.type,
          recordedAt: segment.recordedAt,
          mimeType: segment.mimeType,
          durationMs: segment.durationMs,
          size: segment.size,
          sequence: segment.sequence
        }))
        .sort((a, b) => new Date(b.recordedAt ?? 0).getTime() - new Date(a.recordedAt ?? 0).getTime());

      const baseRank = typeof report.riskLevel === 'string' ? proctoringSeverityRank[report.riskLevel] ?? 0 : 0;
      const highestRank = events.reduce((acc, event) => {
        const severity = typeof event.severity === 'string' ? event.severity.toLowerCase() : 'low';
        return Math.max(acc, proctoringSeverityRank[severity] ?? acc);
      }, baseRank);
      const highestSeverity = Object.entries(proctoringSeverityRank).find(([, rank]) => rank === highestRank)?.[0];

      const flags: string[] = [];
      if (typeof highestSeverity === 'string') {
        flags.push(highestSeverity);
      }
      if (typeof report.riskLevel === 'string' && !flags.includes(report.riskLevel)) {
        flags.push(report.riskLevel);
      }

      res.json({
        success: true,
        data: {
          resultId: toObjectIdString(result._id),
          candidate: {
            name: [candidate?.firstName, candidate?.lastName].filter(Boolean).join(' ').trim() || candidate?.email,
            email: candidate?.email
          },
          assessment: {
            id: assessment?._id ? toObjectIdString(assessment._id) : undefined,
            title: assessment?.title
          },
          status: result.status,
          submittedAt: result.submittedAt,
          proctoring: {
            trustScore: report.trustScore ?? 100,
            riskLevel: report.riskLevel ?? 'low',
            summary: report.summary ?? defaultProctoringSummary,
            recording: {
              latest: {
                screen: report.recordingUrls?.screen ?? null,
                webcam: report.recordingUrls?.webcam ?? null,
                microphone: report.recordingUrls?.microphone ?? null
              }
            },
            mergeStatus: report.mergeStatus ?? null,
            flags,
            events,
            mediaSegments
          }
        }
      });
    } catch (error) {
      await logControllerError(req, {
        category: 'result',
        action: 'get_proctoring_details_error',
        message: 'Error retrieving proctoring details',
        error,
        extra: {
          handler: 'resultController.getProctoringDetails',
          resultId: req.params.resultId
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  async streamProctoringMedia(req: AuthenticatedRequest, res: Response) {
    try {
      const { resultId, segmentId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const organizationId = toObjectId(user.organizationId);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier'
        });
      }

      const result = await AssessmentResult.findById(resultId)
        .populate({
          path: 'invitationId',
          populate: {
            path: 'assessmentId',
            select: 'organizationId',
            match: { organizationId }
          }
        })
        .lean();

      const invitation = result?.invitationId as any;
      if (!result || !invitation?.assessmentId?.organizationId) {
        return res.status(404).json({
          success: false,
          message: 'Media segment not found'
        });
      }

      const segment = result.proctoringReport?.mediaSegments?.find?.(
        (item: any) => item.segmentId === segmentId
      );

      if (!segment) {
        return res.status(404).json({
          success: false,
          message: 'Media segment not found'
        });
      }

      if (segment.storage === 'r2') {
        const baseUrl = process.env.R2_PUBLIC_BASE_URL ? process.env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '') : undefined;
        const publicUrl = segment.publicUrl || (segment.fileKey && baseUrl ? `${baseUrl}/${segment.fileKey}` : undefined);
        if (publicUrl) {
          return res.redirect(publicUrl);
        }

        if (segment.fileKey) {
          const object = await fetchProctoringSegment(segment.fileKey, req.headers.range);
          if (object && object.Body) {
            const body = object.Body as Readable;
            const mimeType = segment.mimeType ?? object.ContentType ?? 'video/webm';
            const contentLength = object.ContentLength;
            const contentRange = (object as any).ContentRange as string | undefined;

            if (req.headers.range && contentRange) {
              res.status(206);
              res.setHeader('Content-Range', contentRange);
            } else {
              res.status(200);
            }

            if (contentLength != null) {
              res.setHeader('Content-Length', contentLength.toString());
            }
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Accept-Ranges', 'bytes');

            if (typeof (body as any).pipe === 'function') {
              body.pipe(res);
            } else {
              Readable.from(body as any).pipe(res);
            }
            return;
          }
        }

        return res.status(404).json({
          success: false,
          message: 'Media segment unavailable'
        });
      }

      const fileStat = segment.filePath ? await fsPromises.stat(segment.filePath).catch(() => null) : null;
      if (!fileStat) {
        return res.status(404).json({
          success: false,
          message: 'Media file missing'
        });
      }

      const mimeType = segment.mimeType ?? 'video/webm';
      const rangeHeader = req.headers.range;

      if (rangeHeader) {
        const [rawStart, rawEnd] = rangeHeader.replace(/bytes=/, '').split('-');
        const start = Number(rawStart);
        if (Number.isNaN(start) || start >= fileStat.size) {
          res.status(416).setHeader('Content-Range', `bytes */${fileStat.size}`);
          return res.end();
        }
        const end = rawEnd ? Number(rawEnd) : fileStat.size - 1;
        const chunkEnd = Math.min(end, fileStat.size - 1);
        const chunkSize = chunkEnd - start + 1;

        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${chunkEnd}/${fileStat.size}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', chunkSize.toString());
        res.setHeader('Content-Type', mimeType);

        const stream = fs.createReadStream(segment.filePath, { start, end: chunkEnd });
        stream.pipe(res);
        return;
      }

      res.setHeader('Content-Length', fileStat.size.toString());
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Accept-Ranges', 'bytes');

      const stream = fs.createReadStream(segment.filePath);
      stream.pipe(res);
      return;
    } catch (error) {
      await logControllerError(req, {
        category: 'result',
        action: 'stream_proctoring_media_error',
        message: 'Error streaming proctoring media',
        error,
        extra: {
          handler: 'resultController.streamProctoringMedia',
          resultId: req.params.resultId,
          segmentId: req.params.segmentId
        }
      });
      res.status(500).json({
        success: false,
        message: 'Unable to stream media segment'
      });
    }
  },

  // Export results
  async exportResults(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const { assessmentId, format = 'json' } = req.query;
      const organizationId = toObjectId(user.organizationId);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier'
        });
      }

      const requestedAssessmentId = typeof assessmentId === 'string' ? assessmentId : undefined;

      // Build query for organization's results
      const organizationAssessments = await Assessment.find({
        organizationId,
        isActive: true,
        ...(requestedAssessmentId && { _id: requestedAssessmentId })
      }).select('_id');

      const assessmentIds = organizationAssessments
        .map(assessment => toObjectId(assessment._id))
        .filter((id): id is mongoose.Types.ObjectId => Boolean(id));

      const invitations = await Invitation.find({
        assessmentId: { $in: assessmentIds }
      }).select('_id');

      const invitationIds = invitations
        .map(invitation => toObjectId(invitation._id))
        .filter((id): id is mongoose.Types.ObjectId => Boolean(id));

      const results = await AssessmentResult.find({
        invitationId: { $in: invitationIds },
        status: { $in: ['completed', 'auto_submitted'] }
      })
        .populate({
          path: 'invitationId',
          populate: {
            path: 'assessmentId',
            select: 'title type'
          }
        })
        .sort({ submittedAt: -1 });

      // Transform data for export
      const exportData = results.map(result => {
        const invitation = result.invitationId as any;
        const assessment = invitation?.assessmentId;
        const candidate = invitation?.candidate;

        return {
          candidateName: `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim(),
          candidateEmail: candidate?.email,
          assessmentTitle: assessment?.title,
          assessmentType: assessment?.type,
          score: result.score.earned,
          totalScore: result.score.total,
          percentage: result.score.percentage,
          grade: result.grade,
          status: result.status,
          startedAt: result.startedAt,
          submittedAt: result.submittedAt,
          duration: result.durationMinutes,
          questionsAttempted: result.performanceMetrics.questionsAttempted,
          questionsSkipped: result.performanceMetrics.questionsSkipped,
          proctoringTrustScore: result.proctoringReport?.trustScore,
          proctoringRiskLevel: result.proctoringReport?.riskLevel,
          reviewedAt: result.reviewedAt,
          isPublic: result.isPublic
        };
      });

      // Log the export
      await SystemLog.create({
        level: 'info',
        category: 'result',
        action: 'results_export',
        message: 'Results exported',
        details: {
          assessmentId: requestedAssessmentId,
          format,
          resultCount: exportData.length
        },
        context: { organizationId },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      if (format === 'csv') {
        // Convert to CSV format
        if (exportData.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'No results found for export'
          });
        }

        const headers = Object.keys(exportData[0]).join(',');
        const csvData = exportData.map(row =>
          Object.values(row).map(value =>
            typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
          ).join(',')
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=assessment-results.csv');
        res.send(headers + '\n' + csvData);
      } else {
        // Return JSON format
        res.json({
          success: true,
          data: {
            results: exportData,
            exportedAt: new Date().toISOString(),
            totalCount: exportData.length
          }
        });
      }

    } catch (error) {
      await logControllerError(req, {
        category: 'result',
        action: 'export_results_error',
        message: 'Error exporting results',
        error,
        extra: {
          handler: 'resultController.exportResults',
          format: req.query?.format,
          assessmentId: req.query?.assessmentId
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Get results analytics
  async getResultsAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const { assessmentId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Verify assessment belongs to organization
      const assessment = await Assessment.findOne({
        _id: assessmentId,
        organizationId: user.organizationId,
        isActive: true
      });

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found'
        });
      }

      // Get invitations for this assessment
      const invitations = await Invitation.find({
        assessmentId: assessment._id
      }).select('_id');

      const invitationIds = invitations.map(inv => inv._id);

      // Get analytics
      const analytics = await AssessmentResult.aggregate([
        {
          $match: {
            invitationId: { $in: invitationIds },
            status: { $in: ['completed', 'auto_submitted'] }
          }
        },
        {
          $group: {
            _id: null,
            totalSubmissions: { $sum: 1 },
            avgScore: { $avg: '$score.percentage' },
            maxScore: { $max: '$score.percentage' },
            minScore: { $min: '$score.percentage' },
            avgDuration: { $avg: '$performanceMetrics.totalTimeSpent' },
            scoreDistribution: {
              $push: '$score.percentage'
            },
            proctoringStats: {
              $push: '$proctoringReport.trustScore'
            }
          }
        }
      ]);

      const stats = analytics[0] || {
        totalSubmissions: 0,
        avgScore: 0,
        maxScore: 0,
        minScore: 0,
        avgDuration: 0,
        scoreDistribution: [],
        proctoringStats: []
      };

      // Calculate score distribution
      const scoreRanges = {
        '90-100': 0,
        '80-89': 0,
        '70-79': 0,
        '60-69': 0,
        '0-59': 0
      };

      stats.scoreDistribution.forEach((score: number) => {
        if (score >= 90) scoreRanges['90-100']++;
        else if (score >= 80) scoreRanges['80-89']++;
        else if (score >= 70) scoreRanges['70-79']++;
        else if (score >= 60) scoreRanges['60-69']++;
        else scoreRanges['0-59']++;
      });

      // Calculate average proctoring trust score
      const validTrustScores = stats.proctoringStats.filter((score: number) => score != null);
      const avgTrustScore = validTrustScores.length > 0
        ? validTrustScores.reduce((sum: number, score: number) => sum + score, 0) / validTrustScores.length
        : null;

      res.json({
        success: true,
        data: {
          assessment: {
            id: assessment._id,
            title: assessment.title,
            type: assessment.type,
            totalQuestions: assessment.questions.length,
            totalPoints: assessment.getTotalPoints()
          },
          statistics: {
            totalSubmissions: stats.totalSubmissions,
            avgScore: Math.round(stats.avgScore * 100) / 100,
            maxScore: stats.maxScore,
            minScore: stats.minScore,
            avgDurationMinutes: Math.round(stats.avgDuration / 60),
            avgTrustScore: avgTrustScore ? Math.round(avgTrustScore * 100) / 100 : null,
            scoreDistribution: scoreRanges,
            passingRate: stats.scoreDistribution.filter((score: number) => score >= 60).length / stats.totalSubmissions * 100
          }
        }
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'result',
        action: 'get_results_analytics_error',
        message: 'Error retrieving results analytics',
        error,
        extra: {
          handler: 'resultController.getResultsAnalytics',
          assessmentId: req.params.assessmentId
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Delete result
  async deleteResult(req: AuthenticatedRequest, res: Response) {
    try {
      const { resultId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const result = await AssessmentResult.findById(resultId)
        .populate({
          path: 'invitationId',
          populate: {
            path: 'assessmentId',
            populate: {
              path: 'organizationId',
              match: { _id: user.organizationId }
            }
          }
        });

      if (!result || !(result.invitationId as any)?.assessmentId?.organizationId) {
        return res.status(404).json({
          success: false,
          message: 'Result not found'
        });
      }

      await AssessmentResult.findByIdAndDelete(resultId);

      // Log the deletion
      await SystemLog.create({
        level: 'info',
        category: 'result',
        action: 'result_delete',
        message: 'Result deleted',
        details: { resultId },
        context: {
          organizationId: user.organizationId,
          resultId: result._id
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Result deleted successfully'
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'result',
        action: 'delete_result_error',
        message: 'Error deleting result',
        error,
        extra: {
          handler: 'resultController.deleteResult',
          resultId: req.params.resultId
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
};

export default resultController;
