import { Response } from 'express';
import { Question, SystemLog } from '../models';
import { AuthenticatedRequest } from '../middleware/auth';

// Helper function to get user info for logging
const getUserInfo = (req: AuthenticatedRequest) => ({
  userId: req.user?._id,
  email: req.user?.email,
  role: req.user?.role,
  ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
  userAgent: req.get('User-Agent') || 'unknown'
});

// Helper function to validate question data
const validateQuestionData = (questionData: any, index: number): { valid: boolean; error?: string } => {
  // Basic required fields
  if (!questionData.title || questionData.title.trim().length === 0) {
    return { valid: false, error: 'Title is required' };
  }
  if (!questionData.description || questionData.description.trim().length === 0) {
    return { valid: false, error: 'Description is required' };
  }
  if (!['mcq', 'msq', 'coding'].includes(questionData.type)) {
    return { valid: false, error: 'Type must be mcq, msq, or coding' };
  }
  if (!['easy', 'medium', 'hard'].includes(questionData.difficulty)) {
    return { valid: false, error: 'Difficulty must be easy, medium, or hard' };
  }

  // Type-specific validation
  if (questionData.type === 'mcq' || questionData.type === 'msq') {
    if (!questionData.options || !Array.isArray(questionData.options) || questionData.options.length < 2) {
      return { valid: false, error: 'MCQ/MSQ questions must have at least 2 options' };
    }

    const validOptions = questionData.options.every((opt: any) =>
      opt.id && opt.text && typeof opt.isCorrect === 'boolean'
    );
    if (!validOptions) {
      return { valid: false, error: 'All options must have id, text, and isCorrect fields' };
    }

    const correctOptions = questionData.options.filter((opt: any) => opt.isCorrect);
    if (questionData.type === 'mcq' && correctOptions.length !== 1) {
      return { valid: false, error: 'MCQ must have exactly one correct option' };
    }
    if (questionData.type === 'msq' && correctOptions.length === 0) {
      return { valid: false, error: 'MSQ must have at least one correct option' };
    }
  }

  if (questionData.type === 'coding') {
    if (!questionData.codingDetails) {
      return { valid: false, error: 'Coding questions must have codingDetails' };
    }
    if (!['javascript', 'python', 'java', 'cpp', 'csharp'].includes(questionData.codingDetails.language)) {
      return { valid: false, error: 'Invalid programming language' };
    }
    if (!Array.isArray(questionData.codingDetails.testCases) || questionData.codingDetails.testCases.length === 0) {
      return { valid: false, error: 'Coding questions must have at least one test case' };
    }
    const validTestCases = questionData.codingDetails.testCases.every((tc: any) =>
      tc.input !== undefined && tc.expectedOutput !== undefined
    );
    if (!validTestCases) {
      return { valid: false, error: 'All test cases must have input and expectedOutput' };
    }
  }

  return { valid: true };
};

export const questionController = {
  // Get all questions for organization
  async getQuestions(req: AuthenticatedRequest, res: Response) {
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
        difficulty,
        category,
        tags,
        search,
        status
      } = req.query;

      // Build query
      const query: any = {
        organizationId: user.organizationId,
        isActive: true
      };

      if (type) query.type = type;
      if (difficulty) query.difficulty = difficulty;
      if (category) query.category = category;
      if (status) query.status = status;
      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        query.tags = { $in: tagArray };
      }
      if (search) {
        // Use full-text search if available, fallback to regex
        query.$text = { $search: search as string };
      }

      const questions = await Question.find(query)
        .populate('createdBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(Number(limit) * 1)
        .skip((Number(page) - 1) * Number(limit));

      const total = await Question.countDocuments(query);

      res.json({
        success: true,
        data: {
          questions,
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
        category: 'question',
        action: 'get_questions_error',
        message: 'Error retrieving questions',
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

  // Get question by ID
  async getQuestionById(req: AuthenticatedRequest, res: Response) {
    try {
      const { questionId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const question = await Question.findOne({
        _id: questionId,
        organizationId: user.organizationId,
        isActive: true
      }).populate('createdBy', 'firstName lastName email');

      if (!question) {
        return res.status(404).json({
          success: false,
          message: 'Question not found'
        });
      }

      res.json({
        success: true,
        data: question
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Create new question
  async createQuestion(req: AuthenticatedRequest, res: Response) {
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
        difficulty,
        category,
        tags,
        options,
        explanation,
        codingDetails,
        points,
        estimatedTimeMinutes,
        status
      } = req.body;

      // Check for duplicate title within organization
      const existingQuestion = await Question.findOne({
        organizationId: user.organizationId,
        title: title.trim(),
        isActive: true
      });

      if (existingQuestion) {
        return res.status(409).json({
          success: false,
          message: 'A question with this title already exists in your organization',
          data: {
            existingQuestionId: existingQuestion._id,
            suggestion: 'Please use a different title or update the existing question'
          }
        });
      }

      // Validate question type specific data
      if (type === 'mcq' || type === 'msq') {
        if (!options || !Array.isArray(options) || options.length < 2) {
          return res.status(400).json({
            success: false,
            message: 'MCQ/MSQ questions must have at least 2 options'
          });
        }

        const correctOptions = options.filter(opt => opt.isCorrect);
        if (type === 'mcq' && correctOptions.length !== 1) {
          return res.status(400).json({
            success: false,
            message: 'MCQ questions must have exactly one correct option'
          });
        }

        if (type === 'msq' && correctOptions.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'MSQ questions must have at least one correct option'
          });
        }
      }

      if (type === 'coding') {
        if (!codingDetails || !codingDetails.language || !codingDetails.testCases || codingDetails.testCases.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Coding questions must have language and test cases'
          });
        }
      }

      // Create question
      const question = new Question({
        organizationId: user.organizationId,
        title: title.trim(),
        description: description.trim(),
        type,
        difficulty,
        category: category?.trim(),
        tags: tags?.map((tag: string) => tag.trim().toLowerCase()) || [],
        options,
        explanation: explanation?.trim(),
        codingDetails,
        points: points || 1,
        estimatedTimeMinutes, // Will use default from model if not provided
        status: status || 'active',
        createdBy: user._id
      });

      await question.save();

      // Log question creation
      await SystemLog.create({
        level: 'info',
        category: 'question',
        action: 'question_create',
        message: 'Question created',
        details: {
          questionId: question._id,
          title,
          type,
          difficulty
        },
        context: {
          organizationId: user.organizationId,
          questionId: question._id
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      // Return created question
      const populatedQuestion = await Question.findById(question._id)
        .populate('createdBy', 'firstName lastName email');

      res.status(201).json({
        success: true,
        message: 'Question created successfully',
        data: populatedQuestion
      });

    } catch (error) {
      await SystemLog.create({
        level: 'error',
        category: 'question',
        action: 'create_question_error',
        message: 'Error creating question',
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

  // Update question
  async updateQuestion(req: AuthenticatedRequest, res: Response) {
    try {
      const { questionId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const question = await Question.findOne({
        _id: questionId,
        organizationId: user.organizationId,
        isActive: true
      });

      if (!question) {
        return res.status(404).json({
          success: false,
          message: 'Question not found'
        });
      }

      // Attach question to request for validation middleware
      (req as any).existingQuestion = question;

      // Check if question is being used in published assessments
      const { Assessment } = await import('../models');
      const usedInPublishedAssessments = await Assessment.countDocuments({
        'questions.questionId': questionId,
        isPublished: true,
        isActive: true
      });

      if (usedInPublishedAssessments > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot modify question that is used in published assessments'
        });
      }

      const {
        title,
        description,
        difficulty,
        category,
        tags,
        options,
        explanation,
        codingDetails,
        points,
        estimatedTimeMinutes,
        status
      } = req.body;

      // Track changes
      const changes: any = {};

      if (title && title !== question.title) {
        changes.title = { from: question.title, to: title };
        question.title = title.trim();
      }

      if (description && description !== question.description) {
        changes.description = { updated: true };
        question.description = description.trim();
      }

      if (difficulty && difficulty !== question.difficulty) {
        changes.difficulty = { from: question.difficulty, to: difficulty };
        question.difficulty = difficulty;
      }

      if (category !== undefined) {
        changes.category = { from: question.category, to: category };
        question.category = category?.trim();
      }

      if (tags) {
        question.tags = tags.map((tag: string) => tag.trim().toLowerCase());
        changes.tags = { updated: true };
      }

      if (options && (question.type === 'mcq' || question.type === 'msq')) {
        // Validate options
        if (!Array.isArray(options) || options.length < 2) {
          return res.status(400).json({
            success: false,
            message: 'MCQ/MSQ questions must have at least 2 options'
          });
        }

        const correctOptions = options.filter(opt => opt.isCorrect);
        if (question.type === 'mcq' && correctOptions.length !== 1) {
          return res.status(400).json({
            success: false,
            message: 'MCQ questions must have exactly one correct option'
          });
        }

        if (question.type === 'msq' && correctOptions.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'MSQ questions must have at least one correct option'
          });
        }

        question.options = options;
        changes.options = { updated: true };
      }

      if (explanation !== undefined) {
        changes.explanation = { updated: true };
        question.explanation = explanation?.trim();
      }

      if (codingDetails && question.type === 'coding') {
        if (!codingDetails.language || !codingDetails.testCases || codingDetails.testCases.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Coding questions must have language and test cases'
          });
        }
        question.codingDetails = codingDetails;
        changes.codingDetails = { updated: true };
      }

      if (points && points !== question.points) {
        changes.points = { from: question.points, to: points };
        question.points = points;
      }

      if (estimatedTimeMinutes && estimatedTimeMinutes !== question.estimatedTimeMinutes) {
        changes.estimatedTimeMinutes = { from: question.estimatedTimeMinutes, to: estimatedTimeMinutes };
        question.estimatedTimeMinutes = estimatedTimeMinutes;
      }

      if (status && status !== question.status) {
        changes.status = { from: question.status, to: status };
        question.status = status;
      }

      await question.save();

      // Log the update
      await SystemLog.create({
        level: 'info',
        category: 'question',
        action: 'question_update',
        message: 'Question updated',
        details: { questionId, changes },
        context: {
          organizationId: user.organizationId,
          questionId: question._id
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      // Return updated question
      const updatedQuestion = await Question.findById(questionId)
        .populate('createdBy', 'firstName lastName email');

      res.json({
        success: true,
        message: 'Question updated successfully',
        data: updatedQuestion
      });

    } catch (error) {
      await SystemLog.create({
        level: 'error',
        category: 'question',
        action: 'update_question_error',
        message: 'Error updating question',
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

  // Delete question
  async deleteQuestion(req: AuthenticatedRequest, res: Response) {
    try {
      const { questionId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const question = await Question.findOne({
        _id: questionId,
        organizationId: user.organizationId,
        isActive: true
      });

      if (!question) {
        return res.status(404).json({
          success: false,
          message: 'Question not found'
        });
      }

      // Check if question is being used in assessments
      const { Assessment } = await import('../models');
      const usedInAssessments = await Assessment.countDocuments({
        'questions.questionId': questionId,
        isActive: true
      });

      if (usedInAssessments > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete question that is used in assessments. Deactivate instead.'
        });
      }

      // Soft delete
      question.isActive = false;
      await question.save();

      await SystemLog.create({
        level: 'info',
        category: 'question',
        action: 'question_delete',
        message: 'Question deleted',
        details: { questionId, title: question.title },
        context: {
          organizationId: user.organizationId,
          questionId: question._id
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Question deleted successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Bulk import questions
  async bulkImportQuestions(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const { questions } = req.body;

      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Questions array is required'
        });
      }

      // Pre-validate all questions first
      const validationErrors: any[] = [];
      for (let i = 0; i < questions.length; i++) {
        const validation = validateQuestionData(questions[i], i);
        if (!validation.valid) {
          validationErrors.push({
            index: i,
            question: questions[i].title || `Question ${i + 1}`,
            error: validation.error
          });
        }
      }

      // If any validation errors, return them all before attempting to save
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: `${validationErrors.length} questions failed validation`,
          errors: validationErrors
        });
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as any[]
      };

      // All questions are valid, now attempt to save them
      for (let i = 0; i < questions.length; i++) {
        try {
          const questionData = questions[i];

          const question = new Question({
            organizationId: user.organizationId,
            title: questionData.title?.trim(),
            description: questionData.description?.trim(),
            type: questionData.type,
            difficulty: questionData.difficulty,
            category: questionData.category?.trim(),
            tags: questionData.tags?.map((tag: string) => tag.trim().toLowerCase()) || [],
            options: questionData.options,
            explanation: questionData.explanation?.trim(),
            codingDetails: questionData.codingDetails,
            points: questionData.points || 1,
            estimatedTimeMinutes: questionData.estimatedTimeMinutes, // Will use model default if not provided
            status: questionData.status || 'active',
            createdBy: user._id
          });

          await question.save();
          results.success++;

        } catch (error) {
          results.failed++;
          results.errors.push({
            index: i,
            question: questions[i].title || `Question ${i + 1}`,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      await SystemLog.create({
        level: 'info',
        category: 'question',
        action: 'questions_bulk_import',
        message: 'Bulk import completed',
        details: {
          totalQuestions: questions.length,
          successful: results.success,
          failed: results.failed
        },
        context: { organizationId: user.organizationId },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: `Bulk import completed. ${results.success} questions imported, ${results.failed} failed.`,
        data: results
      });

    } catch (error) {
      await SystemLog.create({
        level: 'error',
        category: 'question',
        action: 'bulk_import_error',
        message: 'Error in bulk import',
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

  // Get question categories and tags with counts
  async getMetadata(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Get categories with counts
      const categoryAggregation = await Question.aggregate([
        {
          $match: {
            organizationId: user.organizationId,
            isActive: true,
            category: { $nin: [null, ''] }
          }
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);

      // Get tags with counts
      const tagAggregation = await Question.aggregate([
        {
          $match: {
            organizationId: user.organizationId,
            isActive: true
          }
        },
        {
          $unwind: '$tags'
        },
        {
          $group: {
            _id: '$tags',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      // Get statistics by type and difficulty
      const typeStats = await Question.aggregate([
        {
          $match: {
            organizationId: user.organizationId,
            isActive: true
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        }
      ]);

      const difficultyStats = await Question.aggregate([
        {
          $match: {
            organizationId: user.organizationId,
            isActive: true
          }
        },
        {
          $group: {
            _id: '$difficulty',
            count: { $sum: 1 }
          }
        }
      ]);

      const statusStats = await Question.aggregate([
        {
          $match: {
            organizationId: user.organizationId,
            isActive: true
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          categories: categoryAggregation.map(c => ({ name: c._id, count: c.count })),
          tags: tagAggregation.map(t => ({ name: t._id, count: t.count })),
          statistics: {
            byType: typeStats.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
            byDifficulty: difficultyStats.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
            byStatus: statusStats.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {})
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

  // Duplicate/Clone a question
  async duplicateQuestion(req: AuthenticatedRequest, res: Response) {
    try {
      const { questionId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const originalQuestion = await Question.findOne({
        _id: questionId,
        organizationId: user.organizationId,
        isActive: true
      });

      if (!originalQuestion) {
        return res.status(404).json({
          success: false,
          message: 'Question not found'
        });
      }

      // Create duplicate with modified title
      const duplicateQuestion = new Question({
        organizationId: user.organizationId,
        title: `${originalQuestion.title} (Copy)`,
        description: originalQuestion.description,
        type: originalQuestion.type,
        difficulty: originalQuestion.difficulty,
        category: originalQuestion.category,
        tags: originalQuestion.tags,
        options: originalQuestion.options,
        explanation: originalQuestion.explanation,
        codingDetails: originalQuestion.codingDetails,
        points: originalQuestion.points,
        estimatedTimeMinutes: originalQuestion.estimatedTimeMinutes,
        status: 'draft', // New duplicates start as draft
        createdBy: user._id
      });

      await duplicateQuestion.save();

      await SystemLog.create({
        level: 'info',
        category: 'question',
        action: 'question_duplicate',
        message: 'Question duplicated',
        details: {
          originalQuestionId: originalQuestion._id,
          newQuestionId: duplicateQuestion._id
        },
        context: {
          organizationId: user.organizationId
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      const populatedQuestion = await Question.findById(duplicateQuestion._id)
        .populate('createdBy', 'firstName lastName email');

      res.status(201).json({
        success: true,
        message: 'Question duplicated successfully',
        data: populatedQuestion
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Get question statistics
  async getQuestionStats(req: AuthenticatedRequest, res: Response) {
    try {
      const { questionId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const question = await Question.findOne({
        _id: questionId,
        organizationId: user.organizationId,
        isActive: true
      });

      if (!question) {
        return res.status(404).json({
          success: false,
          message: 'Question not found'
        });
      }

      // Get usage in assessments
      const { Assessment, AssessmentResult } = await import('../models');

      const assessmentCount = await Assessment.countDocuments({
        'questions.questionId': questionId,
        organizationId: user.organizationId,
        isActive: true
      });

      const publishedAssessmentCount = await Assessment.countDocuments({
        'questions.questionId': questionId,
        organizationId: user.organizationId,
        isPublished: true,
        isActive: true
      });

      // Get performance statistics from assessment results
      const performanceStats = await AssessmentResult.aggregate([
        {
          $match: {
            organizationId: user.organizationId,
            'answers.questionId': question._id
          }
        },
        {
          $unwind: '$answers'
        },
        {
          $match: {
            'answers.questionId': question._id
          }
        },
        {
          $group: {
            _id: null,
            totalAttempts: { $sum: 1 },
            correctAnswers: {
              $sum: { $cond: ['$answers.isCorrect', 1, 0] }
            },
            averageScore: { $avg: '$answers.score' },
            averageTimeSpent: { $avg: '$answers.timeSpent' }
          }
        }
      ]);

      const stats = performanceStats[0] || {
        totalAttempts: 0,
        correctAnswers: 0,
        averageScore: 0,
        averageTimeSpent: 0
      };

      res.json({
        success: true,
        data: {
          question: {
            id: question._id,
            title: question.title,
            type: question.type,
            difficulty: question.difficulty,
            status: question.status
          },
          usage: {
            assessmentCount,
            publishedAssessmentCount,
            canDelete: assessmentCount === 0,
            canEdit: publishedAssessmentCount === 0
          },
          performance: {
            totalAttempts: stats.totalAttempts,
            correctAnswers: stats.correctAnswers,
            successRate: stats.totalAttempts > 0 ? (stats.correctAnswers / stats.totalAttempts * 100).toFixed(2) + '%' : 'N/A',
            averageScore: stats.averageScore ? stats.averageScore.toFixed(2) : 'N/A',
            averageTimeSpent: stats.averageTimeSpent ? Math.round(stats.averageTimeSpent) + 's' : 'N/A'
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

  // Get question preview (without correct answers)
  async getQuestionPreview(req: AuthenticatedRequest, res: Response) {
    try {
      const { questionId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const question = await Question.findOne({
        _id: questionId,
        organizationId: user.organizationId,
        isActive: true
      });

      if (!question) {
        return res.status(404).json({
          success: false,
          message: 'Question not found'
        });
      }

      // Create preview object without correct answers
      const preview: any = {
        id: question._id,
        title: question.title,
        description: question.description,
        type: question.type,
        difficulty: question.difficulty,
        category: question.category,
        tags: question.tags,
        points: question.points,
        estimatedTimeMinutes: question.estimatedTimeMinutes
      };

      // Remove correct answer indicators for MCQ/MSQ
      if (question.type === 'mcq' || question.type === 'msq') {
        preview.options = question.options?.map(opt => ({
          id: opt.id,
          text: opt.text
          // isCorrect is intentionally omitted
        }));
      }

      // For coding questions, include starter code but not solution or hidden test cases
      if (question.type === 'coding' && question.codingDetails) {
        preview.codingDetails = {
          language: question.codingDetails.language,
          starterCode: question.codingDetails.starterCode,
          timeLimit: question.codingDetails.timeLimit,
          memoryLimit: question.codingDetails.memoryLimit,
          visibleTestCases: question.codingDetails.testCases
            .filter(tc => !tc.isHidden)
            .map(tc => ({
              input: tc.input,
              expectedOutput: tc.expectedOutput
            }))
        };
      }

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

  // Batch update questions
  async batchUpdateQuestions(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const { questionIds, updates } = req.body;

      if (!Array.isArray(questionIds) || questionIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'questionIds array is required'
        });
      }

      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'updates object is required'
        });
      }

      // Only allow certain fields to be batch updated
      const allowedFields = ['status', 'category', 'tags', 'difficulty'];
      const updateFields: any = {};

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          updateFields[field] = updates[field];
        }
      }

      if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({
          success: false,
          message: `No valid update fields provided. Allowed fields: ${allowedFields.join(', ')}`
        });
      }

      const result = await Question.updateMany(
        {
          _id: { $in: questionIds },
          organizationId: user.organizationId,
          isActive: true
        },
        { $set: updateFields }
      );

      await SystemLog.create({
        level: 'info',
        category: 'question',
        action: 'questions_batch_update',
        message: 'Questions updated in batch',
        details: {
          count: result.modifiedCount,
          questionIds,
          updates: updateFields
        },
        context: {
          organizationId: user.organizationId
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: `${result.modifiedCount} questions updated successfully`,
        data: {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Batch delete questions
  async batchDeleteQuestions(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const { questionIds } = req.body;

      if (!Array.isArray(questionIds) || questionIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'questionIds array is required'
        });
      }

      // Check if any questions are used in assessments
      const { Assessment } = await import('../models');
      const usedInAssessments = await Assessment.countDocuments({
        'questions.questionId': { $in: questionIds },
        isActive: true
      });

      if (usedInAssessments > 0) {
        return res.status(400).json({
          success: false,
          message: 'Some questions are used in active assessments and cannot be deleted'
        });
      }

      // Soft delete
      const result = await Question.updateMany(
        {
          _id: { $in: questionIds },
          organizationId: user.organizationId,
          isActive: true
        },
        { $set: { isActive: false } }
      );

      await SystemLog.create({
        level: 'info',
        category: 'question',
        action: 'questions_batch_delete',
        message: 'Questions deleted in batch',
        details: {
          count: result.modifiedCount,
          questionIds
        },
        context: {
          organizationId: user.organizationId
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: `${result.modifiedCount} questions deleted successfully`,
        data: {
          deletedCount: result.modifiedCount
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Export questions to JSON/CSV
  async exportQuestions(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const { format = 'json', questionIds } = req.query;

      const query: any = {
        organizationId: user.organizationId,
        isActive: true
      };

      if (questionIds) {
        const ids = Array.isArray(questionIds) ? questionIds : [questionIds];
        query._id = { $in: ids };
      }

      const questions = await Question.find(query)
        .select('-__v -createdAt -updatedAt -isActive')
        .lean();

      if (format === 'csv') {
        // Simple CSV export for MCQ/MSQ questions
        const csvRows = [
          ['Title', 'Description', 'Type', 'Difficulty', 'Category', 'Tags', 'Points'].join(',')
        ];

        for (const question of questions) {
          csvRows.push([
            `"${question.title}"`,
            `"${question.description}"`,
            question.type,
            question.difficulty,
            question.category || '',
            `"${question.tags?.join(';') || ''}"`,
            question.points
          ].join(','));
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=questions.csv');
        res.send(csvRows.join('\n'));

      } else {
        // JSON export (default)
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=questions.json');
        res.json({
          exportDate: new Date().toISOString(),
          organizationId: user.organizationId,
          questionCount: questions.length,
          questions
        });
      }

      await SystemLog.create({
        level: 'info',
        category: 'question',
        action: 'questions_export',
        message: 'Questions exported',
        details: {
          format,
          count: questions.length
        },
        context: {
          organizationId: user.organizationId
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Get random questions
  async getRandomQuestions(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const {
        count = 10,
        type,
        difficulty,
        category,
        tags
      } = req.query;

      const query: any = {
        organizationId: user.organizationId,
        isActive: true,
        status: 'active' // Only select active questions
      };

      if (type) query.type = type;
      if (difficulty) query.difficulty = difficulty;
      if (category) query.category = category;
      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        query.tags = { $in: tagArray };
      }

      const questions = await Question.aggregate([
        { $match: query },
        { $sample: { size: Number(count) } }
      ]);

      res.json({
        success: true,
        data: {
          questions,
          count: questions.length,
          requestedCount: Number(count)
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

export default questionController;
