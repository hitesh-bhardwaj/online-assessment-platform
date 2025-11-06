import { Response } from 'express';
import { Assessment, SystemLog, Question } from '../models';
import { AuthenticatedRequest } from '../middleware/auth';

// Helper function to get user info for logging
const getUserInfo = (req: AuthenticatedRequest) => ({
  userId: req.user?._id,
  email: req.user?.email,
  role: req.user?.role,
  ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
  userAgent: req.get('User-Agent') || 'unknown'
});

export const assessmentController = {
  // Get all assessments for organization
  async getAssessments(req: AuthenticatedRequest, res: Response) {
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
        type,
        isPublished,
        search,
        createdBy,
        status
      } = req.query;

      // Build query
      const query: any = {
        organizationId: user.organizationId,
        isActive: true
      };

      if (type) query.type = type;
      if (isPublished !== undefined) query.isPublished = isPublished === 'true';
      if (createdBy) query.createdBy = createdBy;
      if (status) query.status = status;
      if (search) {
        // Use full-text search
        query.$text = { $search: search as string };
      }

      const assessments = await Assessment.find(query)
        .populate('createdBy', 'firstName lastName email')
        .populate('questions.questionId', 'title type difficulty')
        .sort({ createdAt: -1 })
        .limit(Number(limit) * 1)
        .skip((Number(page) - 1) * Number(limit));

      const total = await Assessment.countDocuments(query);

      res.json({
        success: true,
        data: {
          assessments,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });

    } catch (error) {
      await SystemLog.create({
        level: 'error',
        category: 'assessment',
        action: 'get_assessments_error',
        message: 'Error retrieving assessments',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        context: { organizationId: req.user?.organizationId },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Get assessment by ID
  async getAssessmentById(req: AuthenticatedRequest, res: Response) {
    try {
      const { assessmentId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const assessment = await Assessment.findOne({
        _id: assessmentId,
        organizationId: user.organizationId,
        isActive: true
      })
        .populate('createdBy', 'firstName lastName email')
        .populate('questions.questionId');

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found'
        });
      }

      res.json({
        success: true,
        data: assessment
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Create new assessment
  async createAssessment(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const {
        title,
        description,
        type,
        questions,
        settings,
        instructions,
        tags,
        category,
        department,
        jobRole,
        scheduledStartDate,
        scheduledEndDate,
        status
      } = req.body;

      // Validate questions exist and belong to organization
      const questionIds = questions.map((q: any) => q.questionId);
      const existingQuestions = await Question.find({
        _id: { $in: questionIds },
        organizationId: user.organizationId,
        isActive: true
      });

      if (existingQuestions.length !== questionIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more questions not found or do not belong to your organization'
        });
      }

      // Validate scheduling dates
      if (scheduledStartDate && scheduledEndDate) {
        const startDate = new Date(scheduledStartDate);
        const endDate = new Date(scheduledEndDate);

        if (startDate >= endDate) {
          return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: [{
              field: 'scheduledEndDate',
              message: 'Scheduled end date must be after start date',
              value: scheduledEndDate
            }]
          });
        }

        // Optional: Validate start date is not in the past
        const now = new Date();
        if (startDate < now) {
          return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: [{
              field: 'scheduledStartDate',
              message: 'Scheduled start date cannot be in the past',
              value: scheduledStartDate
            }]
          });
        }
      }

      // Create assessment
      const assessment = new Assessment({
        organizationId: user.organizationId,
        title: title.trim(),
        description: description?.trim(),
        type,
        questions,
        settings,
        instructions: instructions?.trim(),
        tags: tags?.map((tag: string) => tag.trim().toLowerCase()) || [],
        category: category?.trim(),
        department: department?.trim(),
        jobRole: jobRole?.trim(),
        scheduledStartDate: scheduledStartDate ? new Date(scheduledStartDate) : undefined,
        scheduledEndDate: scheduledEndDate ? new Date(scheduledEndDate) : undefined,
        status: status || 'draft',
        createdBy: user._id
      });

      await assessment.save();

      // Log assessment creation
      await SystemLog.create({
        level: 'info',
        category: 'assessment',
        action: 'assessment_create',
        message: 'Assessment created',
        details: {
          assessmentId: assessment._id,
          title,
          type,
          questionCount: questions.length
        },
        context: {
          organizationId: user.organizationId,
          assessmentId: assessment._id
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      // Populate the created assessment
      const populatedAssessment = await Assessment.findById(assessment._id)
        .populate('createdBy', 'firstName lastName email')
        .populate('questions.questionId', 'title type difficulty');

      res.status(201).json({
        success: true,
        message: 'Assessment created successfully',
        data: populatedAssessment
      });

    } catch (error) {
      await SystemLog.create({
        level: 'error',
        category: 'assessment',
        action: 'create_assessment_error',
        message: 'Error creating assessment',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        context: { organizationId: req.user?.organizationId },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Update assessment
  async updateAssessment(req: AuthenticatedRequest, res: Response) {
    try {
      const { assessmentId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

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

      // Check if assessment is published and has invitations
      if (assessment.isPublished) {
        const { Invitation } = await import('../models');
        const hasInvitations = await Invitation.countDocuments({
          assessmentId: assessment._id
        });

        if (hasInvitations > 0) {
          return res.status(400).json({
            success: false,
            message: 'Cannot modify published assessment with existing invitations'
          });
        }
      }

      const {
        title,
        description,
        questions,
        settings,
        instructions,
        // Metadata fields
        tags,
        category,
        department,
        jobRole,
        // Scheduling fields
        scheduledStartDate,
        scheduledEndDate
      } = req.body;

      // Track changes
      const changes: any = {};

      if (title && title !== assessment.title) {
        changes.title = { from: assessment.title, to: title };
        assessment.title = title.trim();
      }

      if (description !== undefined && description !== assessment.description) {
        changes.description = { from: assessment.description, to: description };
        assessment.description = description?.trim();
      }

      if (questions) {
        // Validate questions
        const questionIds = questions.map((q: any) => q.questionId);
        const existingQuestions = await Question.find({
          _id: { $in: questionIds },
          organizationId: user.organizationId,
          isActive: true
        });

        if (existingQuestions.length !== questionIds.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more questions not found or do not belong to your organization'
          });
        }

        changes.questions = { from: assessment.questions.length, to: questions.length };
        assessment.questions = questions;
      }

      if (settings) {
        changes.settings = { updated: true };
        assessment.settings = { ...assessment.settings, ...settings };
      }

      if (instructions !== undefined) {
        changes.instructions = { from: !!assessment.instructions, to: !!instructions };
        assessment.instructions = instructions?.trim();
      }

      // Update metadata fields
      if (tags !== undefined) {
        changes.tags = { from: assessment.tags, to: tags };
        assessment.tags = tags;
      }

      if (category !== undefined && category !== assessment.category) {
        changes.category = { from: assessment.category, to: category };
        assessment.category = category?.trim();
      }

      if (department !== undefined && department !== assessment.department) {
        changes.department = { from: assessment.department, to: department };
        assessment.department = department?.trim();
      }

      if (jobRole !== undefined && jobRole !== assessment.jobRole) {
        changes.jobRole = { from: assessment.jobRole, to: jobRole };
        assessment.jobRole = jobRole?.trim();
      }

      // Update scheduling dates with validation
      if (scheduledStartDate !== undefined || scheduledEndDate !== undefined) {
        const newStartDate = scheduledStartDate !== undefined
          ? (scheduledStartDate ? new Date(scheduledStartDate) : undefined)
          : assessment.scheduledStartDate;
        const newEndDate = scheduledEndDate !== undefined
          ? (scheduledEndDate ? new Date(scheduledEndDate) : undefined)
          : assessment.scheduledEndDate;

        // Validate: end date must be after start date
        if (newStartDate && newEndDate && newStartDate >= newEndDate) {
          return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: [{
              field: 'scheduledEndDate',
              message: 'Scheduled end date must be after start date',
              value: scheduledEndDate
            }]
          });
        }

        if (scheduledStartDate !== undefined) {
          changes.scheduledStartDate = { from: assessment.scheduledStartDate, to: newStartDate };
          assessment.scheduledStartDate = newStartDate;
        }

        if (scheduledEndDate !== undefined) {
          changes.scheduledEndDate = { from: assessment.scheduledEndDate, to: newEndDate };
          assessment.scheduledEndDate = newEndDate;
        }
      }

      await assessment.save();

      // Log the update
      await SystemLog.create({
        level: 'info',
        category: 'assessment',
        action: 'assessment_update',
        message: 'Assessment updated',
        details: { assessmentId, changes },
        context: {
          organizationId: user.organizationId,
          assessmentId: assessment._id
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      // Return updated assessment
      const updatedAssessment = await Assessment.findById(assessmentId)
        .populate('createdBy', 'firstName lastName email')
        .populate('questions.questionId', 'title type difficulty');

      res.json({
        success: true,
        message: 'Assessment updated successfully',
        data: updatedAssessment
      });

    } catch (error) {
      await SystemLog.create({
        level: 'error',
        category: 'assessment',
        action: 'update_assessment_error',
        message: 'Error updating assessment',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        context: { organizationId: req.user?.organizationId },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Publish assessment
  async publishAssessment(req: AuthenticatedRequest, res: Response) {
    try {
      const { assessmentId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

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

      if (assessment.isPublished) {
        return res.status(400).json({
          success: false,
          message: 'Assessment is already published'
        });
      }

      if (assessment.questions.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot publish assessment without questions'
        });
      }

      assessment.isPublished = true;
      await assessment.save();

      await SystemLog.create({
        level: 'info',
        category: 'assessment',
        action: 'assessment_publish',
        message: 'Assessment published',
        details: { assessmentId, title: assessment.title },
        context: {
          organizationId: user.organizationId,
          assessmentId: assessment._id
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Assessment published successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Unpublish assessment
  async unpublishAssessment(req: AuthenticatedRequest, res: Response) {
    try {
      const { assessmentId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

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

      // Check for active invitations
      const { Invitation } = await import('../models');
      const activeInvitations = await Invitation.countDocuments({
        assessmentId: assessment._id,
        status: { $in: ['pending', 'started'] }
      });

      if (activeInvitations > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot unpublish assessment with active invitations'
        });
      }

      assessment.isPublished = false;
      await assessment.save();

      await SystemLog.create({
        level: 'info',
        category: 'assessment',
        action: 'assessment_unpublish',
        message: 'Assessment unpublished',
        details: { assessmentId, title: assessment.title },
        context: {
          organizationId: user.organizationId,
          assessmentId: assessment._id
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Assessment unpublished successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Delete assessment
  async deleteAssessment(req: AuthenticatedRequest, res: Response) {
    try {
      const { assessmentId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

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

      // Check for invitations
      const { Invitation } = await import('../models');
      const hasInvitations = await Invitation.countDocuments({
        assessmentId: assessment._id
      });

      if (hasInvitations > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete assessment with existing invitations. Deactivate instead.'
        });
      }

      // Soft delete
      assessment.isActive = false;
      await assessment.save();

      await SystemLog.create({
        level: 'info',
        category: 'assessment',
        action: 'assessment_delete',
        message: 'Assessment deleted',
        details: { assessmentId, title: assessment.title },
        context: {
          organizationId: user.organizationId,
          assessmentId: assessment._id
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Assessment deleted successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Get assessment statistics
  async getAssessmentStats(req: AuthenticatedRequest, res: Response) {
    try {
      const { assessmentId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

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

      const { Invitation, AssessmentResult } = await import('../models');

      // Get statistics
      const invitationStats = (Invitation as any).getAnalytics(assessmentId);
      const resultStats = (AssessmentResult as any).getAnalytics(assessmentId);

      const [invitationStatsResult, resultStatsResult] = await Promise.all([
        invitationStats,
        resultStats
      ]);

      const estimatedDuration = await assessment.getEstimatedDuration();

      res.json({
        success: true,
        data: {
          assessment: {
            id: assessment._id,
            title: assessment.title,
            type: assessment.type,
            questionCount: assessment.questions.length,
            totalPoints: assessment.getTotalPoints(),
            estimatedDuration,
            isPublished: assessment.isPublished,
            createdAt: assessment.createdAt
          },
          invitations: invitationStatsResult,
          results: resultStatsResult[0] || {
            avgScore: 0,
            maxScore: 0,
            minScore: 0,
            totalSubmissions: 0,
            avgDuration: 0
          }
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Duplicate/Clone assessment
  async duplicateAssessment(req: AuthenticatedRequest, res: Response) {
    try {
      const { assessmentId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const originalAssessment = await Assessment.findOne({
        _id: assessmentId,
        organizationId: user.organizationId,
        isActive: true
      });

      if (!originalAssessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found'
        });
      }

      // Create duplicate
      const duplicateAssessment = new Assessment({
        organizationId: user.organizationId,
        title: `${originalAssessment.title} (Copy)`,
        description: originalAssessment.description,
        type: originalAssessment.type,
        questions: originalAssessment.questions,
        settings: originalAssessment.settings,
        instructions: originalAssessment.instructions,
        tags: originalAssessment.tags,
        category: originalAssessment.category,
        department: originalAssessment.department,
        jobRole: originalAssessment.jobRole,
        status: 'draft', // Always start as draft
        isPublished: false,
        createdBy: user._id
      });

      await duplicateAssessment.save();

      await SystemLog.create({
        level: 'info',
        category: 'assessment',
        action: 'assessment_duplicate',
        message: 'Assessment duplicated',
        details: {
          originalAssessmentId: originalAssessment._id,
          newAssessmentId: duplicateAssessment._id
        },
        context: {
          organizationId: user.organizationId
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      const populatedAssessment = await Assessment.findById(duplicateAssessment._id)
        .populate('createdBy', 'firstName lastName email')
        .populate('questions.questionId', 'title type difficulty');

      res.status(201).json({
        success: true,
        message: 'Assessment duplicated successfully',
        data: populatedAssessment
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Preview assessment (without correct answers)
  async previewAssessment(req: AuthenticatedRequest, res: Response) {
    try {
      const { assessmentId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const assessment = await Assessment.findOne({
        _id: assessmentId,
        organizationId: user.organizationId,
        isActive: true
      })
        .populate('createdBy', 'firstName lastName email')
        .populate('questions.questionId');

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found'
        });
      }

      // Create preview without correct answers
      const preview: any = {
        id: assessment._id,
        title: assessment.title,
        description: assessment.description,
        type: assessment.type,
        instructions: assessment.instructions,
        status: assessment.status,
        tags: assessment.tags,
        category: assessment.category,
        department: assessment.department,
        jobRole: assessment.jobRole,
        settings: {
          timeLimit: assessment.settings.timeLimit,
          shuffleQuestions: assessment.settings.shuffleQuestions,
          shuffleOptions: assessment.settings.shuffleOptions,
          allowReviewAnswers: assessment.settings.allowReviewAnswers,
          attemptsAllowed: assessment.settings.attemptsAllowed,
          proctoringSettings: assessment.settings.proctoringSettings
        },
        questions: assessment.questions.map((qRef: any, index: number) => {
          const question = qRef.questionId;
          return {
            order: qRef.order,
            points: qRef.points,
            question: {
              id: question._id,
              title: question.title,
              description: question.description,
              type: question.type,
              difficulty: question.difficulty,
              estimatedTimeMinutes: question.estimatedTimeMinutes,
              // Remove correct answers for MCQ/MSQ
              options: (question.type === 'mcq' || question.type === 'msq') && question.options
                ? question.options.map((opt: any) => ({
                    id: opt.id,
                    text: opt.text
                  }))
                : undefined,
              // For coding, hide solution and hidden test cases
              codingDetails: question.type === 'coding' && question.codingDetails
                ? {
                    language: question.codingDetails.language,
                    starterCode: question.codingDetails.starterCode,
                    timeLimit: question.codingDetails.timeLimit,
                    memoryLimit: question.codingDetails.memoryLimit,
                    visibleTestCases: question.codingDetails.testCases
                      ?.filter((tc: any) => !tc.isHidden)
                      .map((tc: any) => ({
                        input: tc.input,
                        expectedOutput: tc.expectedOutput
                      }))
                  }
                : undefined
            }
          };
        }),
        totalPoints: assessment.getTotalPoints(),
        estimatedDuration: await assessment.getEstimatedDuration()
      };

      res.json({
        success: true,
        data: preview
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Validate assessment before publishing
  async validateAssessment(req: AuthenticatedRequest, res: Response) {
    try {
      const { assessmentId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

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

      const validation = await assessment.canBePublished();

      res.json({
        success: true,
        data: {
          canPublish: validation.valid,
          errors: validation.errors,
          warnings: [],
          info: {
            questionCount: assessment.questions.length,
            totalPoints: assessment.getTotalPoints(),
            estimatedDuration: await assessment.getEstimatedDuration(),
            hasScheduling: !!(assessment.scheduledStartDate || assessment.scheduledEndDate)
          }
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
};

export default assessmentController;