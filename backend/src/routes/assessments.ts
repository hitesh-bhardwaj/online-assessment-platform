import { Router } from 'express';
import assessmentController from '../controllers/assessmentController';
import {
  authenticate,
  requirePermission,
  rateLimitByUser
} from '../middleware/auth';
import { validateRequest, validateObjectId, commonSchemas } from '../middleware/validation';

const router = Router();

// Validation schemas (no duplicate optional, wrapped for express-validator)
const createAssessmentSchema = {
  title: {
    ...commonSchemas.title
  },
  description: {
    ...commonSchemas.description
  },
  type: {
    isIn: {
      options: [['mcq', 'coding', 'mixed']],
      errorMessage: 'Type must be mcq, coding, or mixed'
    }
  },
  questions: {
    isArray: { options: { min: 1 } },
    custom: {
      options: (questions: any[]) => {
        return questions.every((q: any) =>
          q.questionId &&
          typeof q.order === 'number' &&
          typeof q.points === 'number' &&
          q.order > 0 &&
          q.points > 0
        );
      }
    },
    errorMessage: 'Questions must be an array with valid questionId, order, and points'
  },
  settings: {
    isObject: true,
    custom: {
      options: (settings: any) => {
        if (typeof settings.timeLimit !== 'number' || settings.timeLimit < 5 || settings.timeLimit > 480) {
          throw new Error('Time limit must be between 5 and 480 minutes');
        }
        if (typeof settings.attemptsAllowed !== 'number' || settings.attemptsAllowed < 1 || settings.attemptsAllowed > 10) {
          throw new Error('Attempts allowed must be between 1 and 10');
        }
        return true;
      }
    }
  },
  instructions: {
    isLength: { options: { max: 2000 } },
    trim: true,
    errorMessage: 'Instructions must be less than 2000 characters',
    optional: true
  },
  status: {
    isIn: {
      options: [['draft', 'active', 'archived', 'scheduled', 'under_review']],
      errorMessage: 'Status must be draft, active, archived, scheduled, or under_review'
    },
    optional: true
  },
  tags: {
    isArray: true,
    custom: {
      options: (tags: any[]) => {
        if (!Array.isArray(tags)) return false;
        return tags.every(tag => typeof tag === 'string' && tag.trim().length > 0);
      }
    },
    errorMessage: 'Tags must be an array of non-empty strings',
    optional: true
  },
  category: {
    isLength: { options: { max: 100 } },
    trim: true,
    errorMessage: 'Category must be less than 100 characters',
    optional: true
  },
  department: {
    isLength: { options: { max: 100 } },
    trim: true,
    errorMessage: 'Department must be less than 100 characters',
    optional: true
  },
  jobRole: {
    isLength: { options: { max: 100 } },
    trim: true,
    errorMessage: 'Job role must be less than 100 characters',
    optional: true
  },
  scheduledStartDate: {
    isISO8601: true,
    toDate: true,
    errorMessage: 'Scheduled start date must be a valid ISO 8601 date',
    optional: true
  },
  scheduledEndDate: {
    isISO8601: true,
    toDate: true,
    errorMessage: 'Scheduled end date must be a valid ISO 8601 date',
    optional: true
  }
};

const updateAssessmentSchema = {
  title: {
    ...commonSchemas.title,
    optional: true
  },
  description: {
    ...commonSchemas.description,
    optional: true
  },
  questions: {
    isArray: { options: { min: 1 } },
    custom: {
      options: (questions: any[]) => {
        return questions.every((q: any) =>
          q.questionId &&
          typeof q.order === 'number' &&
          typeof q.points === 'number' &&
          q.order > 0 &&
          q.points > 0
        );
      }
    },
    errorMessage: 'Questions must be an array with valid questionId, order, and points',
    optional: true
  },
  settings: {
    isObject: true,
    custom: {
      options: (settings: any) => {
        if (settings.timeLimit && (typeof settings.timeLimit !== 'number' || settings.timeLimit < 5 || settings.timeLimit > 480)) {
          throw new Error('Time limit must be between 5 and 480 minutes');
        }
        if (settings.attemptsAllowed && (typeof settings.attemptsAllowed !== 'number' || settings.attemptsAllowed < 1 || settings.attemptsAllowed > 10)) {
          throw new Error('Attempts allowed must be between 1 and 10');
        }
        return true;
      }
    },
    optional: true
  },
  instructions: {
    isLength: { options: { max: 2000 } },
    trim: true,
    errorMessage: 'Instructions must be less than 2000 characters',
    optional: true
  },
  status: {
    isIn: {
      options: [['draft', 'active', 'archived', 'scheduled', 'under_review']],
      errorMessage: 'Status must be draft, active, archived, scheduled, or under_review'
    },
    optional: true
  },
  tags: {
    isArray: true,
    custom: {
      options: (tags: any[]) => {
        if (!Array.isArray(tags)) return false;
        return tags.every(tag => typeof tag === 'string' && tag.trim().length > 0);
      }
    },
    errorMessage: 'Tags must be an array of non-empty strings',
    optional: true
  },
  category: {
    isLength: { options: { max: 100 } },
    trim: true,
    errorMessage: 'Category must be less than 100 characters',
    optional: true
  },
  department: {
    isLength: { options: { max: 100 } },
    trim: true,
    errorMessage: 'Department must be less than 100 characters',
    optional: true
  },
  jobRole: {
    isLength: { options: { max: 100 } },
    trim: true,
    errorMessage: 'Job role must be less than 100 characters',
    optional: true
  },
  scheduledStartDate: {
    isISO8601: true,
    toDate: true,
    errorMessage: 'Scheduled start date must be a valid ISO 8601 date',
    optional: true
  },
  scheduledEndDate: {
    isISO8601: true,
    toDate: true,
    errorMessage: 'Scheduled end date must be a valid ISO 8601 date',
    optional: true
  }
};

const getAssessmentsQuerySchema = {
  page: {
    isInt: { options: { min: 1 } },
    toInt: true,
    errorMessage: 'Page must be a positive integer',
    optional: true
  },
  limit: {
    isInt: { options: { min: 1, max: 100 } },
    toInt: true,
    errorMessage: 'Limit must be between 1 and 100',
    optional: true
  },
  type: {
    isIn: {
      options: [['mcq', 'coding', 'mixed']],
      errorMessage: 'Type must be mcq, coding, or mixed'
    },
    optional: true
  },
  isPublished: {
    isIn: {
      options: [['true', 'false']],
      errorMessage: 'isPublished must be true or false'
    },
    optional: true
  },
  search: {
    isLength: { options: { min: 1, max: 100 } },
    trim: true,
    errorMessage: 'Search term must be between 1 and 100 characters',
    optional: true
  },
  createdBy: {
    isMongoId: true,
    errorMessage: 'createdBy must be a valid MongoDB ObjectId',
    optional: true
  },
  status: {
    isIn: {
      options: [['draft', 'active', 'archived', 'scheduled', 'under_review']],
      errorMessage: 'Status must be draft, active, archived, scheduled, or under_review'
    },
    optional: true
  }
};

// Assessment routes
/**
 * @route   GET /api/assessments
 * @desc    Get all assessments for organization
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/',
  authenticate,
  requirePermission('assessments', 'read'),
  ...validateRequest({ query: getAssessmentsQuerySchema }),
  assessmentController.getAssessments
);

/**
 * @route   GET /api/assessments/:assessmentId
 * @desc    Get assessment by ID
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/:assessmentId',
  authenticate,
  requirePermission('assessments', 'read'),
  ...validateRequest({ params: validateObjectId('assessmentId') }),
  assessmentController.getAssessmentById
);

/**
 * @route   POST /api/assessments
 * @desc    Create new assessment
 * @access  Private (Admin/Recruiter with create permission)
 */
router.post(
  '/',
  authenticate,
  requirePermission('assessments', 'create'),
  rateLimitByUser(20, 60 * 60 * 1000), // 20 assessments per hour
  ...validateRequest({ body: createAssessmentSchema }),
  assessmentController.createAssessment
);

/**
 * @route   PUT /api/assessments/:assessmentId
 * @desc    Update assessment
 * @access  Private (Admin/Recruiter with update permission)
 */
router.put(
  '/:assessmentId',
  authenticate,
  requirePermission('assessments', 'update'),
  ...validateRequest({ params: validateObjectId('assessmentId') }),
  ...validateRequest({ body: updateAssessmentSchema }),
  assessmentController.updateAssessment
);

/**
 * @route   POST /api/assessments/:assessmentId/publish
 * @desc    Publish assessment
 * @access  Private (Admin/Recruiter with update permission)
 */
router.post(
  '/:assessmentId/publish',
  authenticate,
  requirePermission('assessments', 'update'),
  ...validateRequest({ params: validateObjectId('assessmentId') }),
  assessmentController.publishAssessment
);

/**
 * @route   POST /api/assessments/:assessmentId/unpublish
 * @desc    Unpublish assessment
 * @access  Private (Admin/Recruiter with update permission)
 */
router.post(
  '/:assessmentId/unpublish',
  authenticate,
  requirePermission('assessments', 'update'),
  ...validateRequest({ params: validateObjectId('assessmentId') }),
  assessmentController.unpublishAssessment
);

/**
 * @route   DELETE /api/assessments/:assessmentId
 * @desc    Delete assessment (soft delete)
 * @access  Private (Admin/Recruiter with delete permission)
 */
router.delete(
  '/:assessmentId',
  authenticate,
  requirePermission('assessments', 'delete'),
  ...validateRequest({ params: validateObjectId('assessmentId') }),
  assessmentController.deleteAssessment
);

/**
 * @route   GET /api/assessments/:assessmentId/stats
 * @desc    Get assessment statistics
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/:assessmentId/stats',
  authenticate,
  requirePermission('assessments', 'read'),
  ...validateRequest({ params: validateObjectId('assessmentId') }),
  assessmentController.getAssessmentStats
);

/**
 * @route   POST /api/assessments/:assessmentId/duplicate
 * @desc    Duplicate/clone an assessment
 * @access  Private (Admin/Recruiter with create permission)
 */
router.post(
  '/:assessmentId/duplicate',
  authenticate,
  requirePermission('assessments', 'create'),
  ...validateRequest({ params: validateObjectId('assessmentId') }),
  assessmentController.duplicateAssessment
);

/**
 * @route   GET /api/assessments/:assessmentId/preview
 * @desc    Preview assessment without correct answers
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/:assessmentId/preview',
  authenticate,
  requirePermission('assessments', 'read'),
  ...validateRequest({ params: validateObjectId('assessmentId') }),
  assessmentController.previewAssessment
);

/**
 * @route   GET /api/assessments/:assessmentId/validate
 * @desc    Validate assessment before publishing
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/:assessmentId/validate',
  authenticate,
  requirePermission('assessments', 'read'),
  ...validateRequest({ params: validateObjectId('assessmentId') }),
  assessmentController.validateAssessment
);

export default router;