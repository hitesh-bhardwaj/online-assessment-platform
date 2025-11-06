import { Router } from 'express';
import questionController from '../controllers/questionController';
import {
  authenticate,
  requirePermission,
  rateLimitByUser
} from '../middleware/auth';
import { validateRequest, validateObjectId, commonSchemas } from '../middleware/validation';

const router = Router();

// Validation schemas
const createQuestionSchema = {
  body: {
    title: {
      ...commonSchemas.title
    },
    description: {
      ...commonSchemas.description
    },
    type: {
      isIn: {
        options: [['mcq', 'msq', 'coding']],
        errorMessage: 'Type must be mcq, msq, or coding'
      }
    },
    difficulty: {
      isIn: {
        options: [['easy', 'medium', 'hard']],
        errorMessage: 'Difficulty must be easy, medium, or hard'
      }
    },
    category: {
      optional: true,
      isLength: { options: { min: 1, max: 100 } },
      trim: true,
      errorMessage: 'Category must be between 1 and 100 characters'
    },
    tags: {
      optional: true,
      isArray: true,
      custom: {
        options: (tags: any[]) => {
          if (!Array.isArray(tags)) return false;
          return tags.every(tag => typeof tag === 'string' && tag.trim().length > 0);
        }
      },
      errorMessage: 'Tags must be an array of non-empty strings'
    },
    options: {
      optional: true,
      isArray: true,
      custom: {
        options: (options: any[], { req }: any) => {
          const type = req.body.type;
          if (type === 'mcq' || type === 'msq') {
            if (!Array.isArray(options) || options.length < 2) return false;
            return options.every(opt =>
              opt.id && opt.text && typeof opt.isCorrect === 'boolean'
            );
          }
          return true;
        }
      },
      errorMessage: 'MCQ/MSQ questions must have valid options array'
    },
    explanation: {
      optional: true,
      isLength: { options: { max: 1000 } },
      trim: true,
      errorMessage: 'Explanation must be less than 1000 characters'
    },
    codingDetails: {
      optional: true,
      isObject: true,
      custom: {
        options: (codingDetails: any, { req }: any) => {
          const type = req.body.type;
          if (type === 'coding') {
            if (!codingDetails) return false;
            if (!codingDetails.language || !['javascript', 'python', 'java', 'cpp', 'csharp'].includes(codingDetails.language)) {
              return false;
            }
            if (!Array.isArray(codingDetails.testCases) || codingDetails.testCases.length === 0) {
              return false;
            }
            return codingDetails.testCases.every((tc: any) =>
              tc.input !== undefined && tc.expectedOutput !== undefined
            );
          }
          return true;
        }
      },
      errorMessage: 'Coding questions must have valid coding details with language and test cases'
    },
    points: {
      optional: true,
      isInt: { options: { min: 1, max: 100 } },
      toInt: true,
      errorMessage: 'Points must be between 1 and 100'
    },
    estimatedTimeMinutes: {
      optional: true,
      isInt: { options: { min: 1, max: 120 } },
      toInt: true,
      errorMessage: 'Estimated time must be between 1 and 120 minutes'
    },
    status: {
      optional: true,
      isIn: {
        options: [['draft', 'active', 'archived', 'under_review']],
        errorMessage: 'Status must be draft, active, archived, or under_review'
      }
    }
  }
};

const updateQuestionSchema = {
  body: {
    title: {
      optional: true,
      ...commonSchemas.title
    },
    description: {
      optional: true,
      ...commonSchemas.description
    },
    difficulty: {
      optional: true,
      isIn: {
        options: [['easy', 'medium', 'hard']],
        errorMessage: 'Difficulty must be easy, medium, or hard'
      }
    },
    category: {
      optional: true,
      isLength: { options: { min: 0, max: 100 } },
      trim: true,
      errorMessage: 'Category must be less than 100 characters'
    },
    tags: {
      optional: true,
      isArray: true,
      custom: {
        options: (tags: any[]) => {
          if (!Array.isArray(tags)) return false;
          return tags.every(tag => typeof tag === 'string' && tag.trim().length > 0);
        }
      },
      errorMessage: 'Tags must be an array of non-empty strings'
    },
    options: {
      optional: true,
      isArray: true,
      custom: {
        options: (options: any[], { req }: any) => {
          const question = (req as any).existingQuestion;
          const type = question?.type;
          if (type === 'mcq' || type === 'msq') {
            if (!Array.isArray(options) || options.length < 2) return false;
            return options.every(opt =>
              opt.id && opt.text && typeof opt.isCorrect === 'boolean'
            );
          }
          return true;
        }
      },
      errorMessage: 'MCQ/MSQ questions must have valid options array with at least 2 options'
    },
    explanation: {
      optional: true,
      isLength: { options: { max: 1000 } },
      trim: true,
      errorMessage: 'Explanation must be less than 1000 characters'
    },
    codingDetails: {
      optional: true,
      isObject: true,
      custom: {
        options: (codingDetails: any, { req }: any) => {
          const question = (req as any).existingQuestion;
          const type = question?.type;
          if (type === 'coding') {
            if (!codingDetails) return true; // Allow omitting if not changing
            if (codingDetails.language && !['javascript', 'python', 'java', 'cpp', 'csharp'].includes(codingDetails.language)) {
              return false;
            }
            if (codingDetails.testCases && (!Array.isArray(codingDetails.testCases) || codingDetails.testCases.length === 0)) {
              return false;
            }
            if (codingDetails.testCases) {
              return codingDetails.testCases.every((tc: any) =>
                tc.input !== undefined && tc.expectedOutput !== undefined
              );
            }
          }
          return true;
        }
      },
      errorMessage: 'Coding questions must have valid coding details with language and test cases'
    },
    points: {
      optional: true,
      isInt: { options: { min: 1, max: 100 } },
      toInt: true,
      errorMessage: 'Points must be between 1 and 100'
    },
    estimatedTimeMinutes: {
      optional: true,
      isInt: { options: { min: 1, max: 120 } },
      toInt: true,
      errorMessage: 'Estimated time must be between 1 and 120 minutes'
    },
    status: {
      optional: true,
      isIn: {
        options: [['draft', 'active', 'archived', 'under_review']],
        errorMessage: 'Status must be draft, active, archived, or under_review'
      }
    }
  }
};

const bulkImportSchema = {
  body: {
    questions: {
      isArray: { options: { min: 1, max: 100 } },
      errorMessage: 'Questions must be an array with 1-100 items'
    }
  }
};

const getQuestionsQuerySchema = {
  query: {
    page: {
      optional: true,
      isInt: { options: { min: 1 } },
      toInt: true,
      errorMessage: 'Page must be a positive integer'
    },
    limit: {
      optional: true,
      isInt: { options: { min: 1, max: 100 } },
      toInt: true,
      errorMessage: 'Limit must be between 1 and 100'
    },
    type: {
      optional: true,
      isIn: {
        options: [['mcq', 'msq', 'coding']],
        errorMessage: 'Type must be mcq, msq, or coding'
      }
    },
    difficulty: {
      optional: true,
      isIn: {
        options: [['easy', 'medium', 'hard']],
        errorMessage: 'Difficulty must be easy, medium, or hard'
      }
    },
    category: {
      optional: true,
      isLength: { options: { min: 1, max: 100 } },
      trim: true,
      errorMessage: 'Category must be between 1 and 100 characters'
    },
    tags: {
      optional: true,
      errorMessage: 'Tags parameter is optional'
    },
    search: {
      optional: true,
      isLength: { options: { min: 1, max: 100 } },
      trim: true,
      errorMessage: 'Search term must be between 1 and 100 characters'
    },
    status: {
      optional: true,
      isIn: {
        options: [['draft', 'active', 'archived', 'under_review']],
        errorMessage: 'Status must be draft, active, archived, or under_review'
      }
    }
  }
};

// Question routes
/**
 * @route   GET /api/questions
 * @desc    Get all questions for organization
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/',
  authenticate,
  requirePermission('questions', 'read'),
  validateRequest(getQuestionsQuerySchema),
  questionController.getQuestions
);

/**
 * @route   GET /api/questions/metadata
 * @desc    Get question categories and tags
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/metadata',
  authenticate,
  requirePermission('questions', 'read'),
  questionController.getMetadata
);

/**
 * @route   GET /api/questions/export
 * @desc    Export questions to JSON/CSV
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/export',
  authenticate,
  requirePermission('questions', 'read'),
  validateRequest({
    query: {
      format: {
        optional: true,
        isIn: {
          options: [['json', 'csv']],
          errorMessage: 'Format must be json or csv'
        }
      },
      questionIds: {
        optional: true,
        errorMessage: 'questionIds parameter is optional'
      }
    }
  }),
  questionController.exportQuestions
);

/**
 * @route   GET /api/questions/random
 * @desc    Get random questions by criteria
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/random',
  authenticate,
  requirePermission('questions', 'read'),
  validateRequest({
    query: {
      count: {
        optional: true,
        isInt: { options: { min: 1, max: 100 } },
        toInt: true,
        errorMessage: 'Count must be between 1 and 100'
      },
      type: {
        optional: true,
        isIn: {
          options: [['mcq', 'msq', 'coding']],
          errorMessage: 'Type must be mcq, msq, or coding'
        }
      },
      difficulty: {
        optional: true,
        isIn: {
          options: [['easy', 'medium', 'hard']],
          errorMessage: 'Difficulty must be easy, medium, or hard'
        }
      },
      category: {
        optional: true,
        errorMessage: 'Category parameter is optional'
      },
      tags: {
        optional: true,
        errorMessage: 'Tags parameter is optional'
      }
    }
  }),
  questionController.getRandomQuestions
);

/**
 * @route   GET /api/questions/:questionId
 * @desc    Get question by ID
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/:questionId',
  authenticate,
  requirePermission('questions', 'read'),
  validateRequest({ params: validateObjectId('questionId') }),
  questionController.getQuestionById
);

/**
 * @route   POST /api/questions
 * @desc    Create new question
 * @access  Private (Admin/Recruiter with create permission)
 */
router.post(
  '/',
  authenticate,
  requirePermission('questions', 'create'),
  rateLimitByUser(50, 60 * 60 * 1000), // 50 questions per hour
  validateRequest(createQuestionSchema),
  questionController.createQuestion
);

/**
 * @route   POST /api/questions/bulk-import
 * @desc    Bulk import questions
 * @access  Private (Admin/Recruiter with create permission)
 */
router.post(
  '/bulk-import',
  authenticate,
  requirePermission('questions', 'create'),
  rateLimitByUser(5, 60 * 60 * 1000), // 5 bulk imports per hour
  validateRequest(bulkImportSchema),
  questionController.bulkImportQuestions
);

/**
 * @route   PATCH /api/questions/batch
 * @desc    Batch update questions
 * @access  Private (Admin/Recruiter with update permission)
 */
router.patch(
  '/batch',
  authenticate,
  requirePermission('questions', 'update'),
  validateRequest({
    body: {
      questionIds: {
        isArray: { options: { min: 1, max: 100 } },
        errorMessage: 'questionIds must be an array with 1-100 items'
      },
      updates: {
        isObject: true,
        errorMessage: 'updates must be an object'
      }
    }
  }),
  questionController.batchUpdateQuestions
);

/**
 * @route   DELETE /api/questions/batch
 * @desc    Batch delete questions
 * @access  Private (Admin/Recruiter with delete permission)
 */
router.delete(
  '/batch',
  authenticate,
  requirePermission('questions', 'delete'),
  validateRequest({
    body: {
      questionIds: {
        isArray: { options: { min: 1, max: 100 } },
        errorMessage: 'questionIds must be an array with 1-100 items'
      }
    }
  }),
  questionController.batchDeleteQuestions
);

/**
 * @route   PUT /api/questions/:questionId
 * @desc    Update question
 * @access  Private (Admin/Recruiter with update permission)
 */
router.put(
  '/:questionId',
  authenticate,
  requirePermission('questions', 'update'),
  validateRequest({ params: validateObjectId('questionId') }),
  validateRequest(updateQuestionSchema),
  questionController.updateQuestion
);

/**
 * @route   DELETE /api/questions/:questionId
 * @desc    Delete question (soft delete)
 * @access  Private (Admin/Recruiter with delete permission)
 */
router.delete(
  '/:questionId',
  authenticate,
  requirePermission('questions', 'delete'),
  validateRequest({ params: validateObjectId('questionId') }),
  questionController.deleteQuestion
);

/**
 * @route   POST /api/questions/:questionId/duplicate
 * @desc    Duplicate/clone a question
 * @access  Private (Admin/Recruiter with create permission)
 */
router.post(
  '/:questionId/duplicate',
  authenticate,
  requirePermission('questions', 'create'),
  validateRequest({ params: validateObjectId('questionId') }),
  questionController.duplicateQuestion
);

/**
 * @route   GET /api/questions/:questionId/stats
 * @desc    Get question statistics and usage
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/:questionId/stats',
  authenticate,
  requirePermission('questions', 'read'),
  validateRequest({ params: validateObjectId('questionId') }),
  questionController.getQuestionStats
);

/**
 * @route   GET /api/questions/:questionId/preview
 * @desc    Get question preview without correct answers
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/:questionId/preview',
  authenticate,
  requirePermission('questions', 'read'),
  validateRequest({ params: validateObjectId('questionId') }),
  questionController.getQuestionPreview
);

export default router;
