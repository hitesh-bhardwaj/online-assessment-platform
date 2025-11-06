import { Router } from 'express';
import resultController from '../controllers/resultController';
import {
  authenticate,
  requirePermission,
  rateLimitByUser
} from '../middleware/auth';
import { validateRequest, validateObjectId } from '../middleware/validation';

const router = Router();

// Validation schemas
const reviewResultSchema = {
  body: {
    feedback: {
      optional: true,
      isLength: { options: { max: 2000 } },
      trim: true,
      errorMessage: 'Feedback must be less than 2000 characters'
    },
    isPublic: {
      optional: true,
      isBoolean: true,
      errorMessage: 'isPublic must be a boolean'
    }
  }
};

const getResultsQuerySchema = {
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
    status: {
      optional: true,
      isIn: {
        options: [['in_progress', 'completed', 'auto_submitted', 'disqualified']],
        errorMessage: 'Status must be in_progress, completed, auto_submitted, or disqualified'
      }
    },
    assessmentId: {
      optional: true,
      isMongoId: true,
      errorMessage: 'Assessment ID must be a valid MongoDB ObjectId'
    },
    search: {
      optional: true,
      isLength: { options: { min: 1, max: 100 } },
      trim: true,
      errorMessage: 'Search term must be between 1 and 100 characters'
    },
    minScore: {
      optional: true,
      isInt: { options: { min: 0, max: 100 } },
      toInt: true,
      errorMessage: 'Minimum score must be between 0 and 100'
    },
    maxScore: {
      optional: true,
      isInt: { options: { min: 0, max: 100 } },
      toInt: true,
      errorMessage: 'Maximum score must be between 0 and 100'
    }
  }
};

const exportResultsQuerySchema = {
  query: {
    assessmentId: {
      optional: true,
      isMongoId: true,
      errorMessage: 'Assessment ID must be a valid MongoDB ObjectId'
    },
    format: {
      optional: true,
      isIn: {
        options: [['json', 'csv']],
        errorMessage: 'Format must be json or csv'
      }
    }
  }
};

const proctoringMediaParamsSchema = {
  params: {
    ...validateObjectId('resultId'),
    segmentId: {
      in: ['params'],
      isString: true,
      trim: true,
      notEmpty: true,
      errorMessage: 'segmentId is required'
    }
  }
};

// Result routes
/**
 * @route   GET /api/results
 * @desc    Get all results for organization
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/',
  authenticate,
  requirePermission('results', 'read'),
  validateRequest(getResultsQuerySchema),
  resultController.getResults
);

/**
 * @route   GET /api/results/:resultId
 * @desc    Get result by ID
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/:resultId',
  authenticate,
  requirePermission('results', 'read'),
  validateRequest({ params: validateObjectId('resultId') }),
  resultController.getResultById
);

/**
 * @route   GET /api/results/:resultId/proctoring
 * @desc    Get detailed proctoring timeline for a result
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/:resultId/proctoring',
  authenticate,
  requirePermission('results', 'read'),
  validateRequest({ params: validateObjectId('resultId') }),
  resultController.getProctoringDetails
);

/**
 * @route   GET /api/results/:resultId/proctoring/media/:segmentId
 * @desc    Stream a recorded media segment for recruiter review
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/:resultId/proctoring/media/:segmentId',
  authenticate,
  requirePermission('results', 'read'),
  validateRequest(proctoringMediaParamsSchema),
  resultController.streamProctoringMedia
);

/**
 * @route   PUT /api/results/:resultId/review
 * @desc    Review result (add feedback, set visibility)
 * @access  Private (Admin/Recruiter with read permission)
 */
router.put(
  '/:resultId/review',
  authenticate,
  requirePermission('results', 'read'),
  validateRequest({ params: validateObjectId('resultId') }),
  validateRequest(reviewResultSchema),
  resultController.reviewResult
);

/**
 * @route   GET /api/results/export
 * @desc    Export results (JSON or CSV)
 * @access  Private (Admin/Recruiter with export permission)
 */
router.get(
  '/export',
  authenticate,
  requirePermission('results', 'export'),
  rateLimitByUser(10, 60 * 60 * 1000), // 10 exports per hour
  validateRequest(exportResultsQuerySchema),
  resultController.exportResults
);

/**
 * @route   GET /api/results/analytics/:assessmentId
 * @desc    Get results analytics for assessment
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/analytics/:assessmentId',
  authenticate,
  requirePermission('results', 'read'),
  validateRequest({ params: validateObjectId('assessmentId') }),
  resultController.getResultsAnalytics
);

/**
 * @route   DELETE /api/results/:resultId
 * @desc    Delete result
 * @access  Private (Admin/Recruiter with delete permission)
 */
router.delete(
  '/:resultId',
  authenticate,
  requirePermission('results', 'delete'),
  validateRequest({ params: validateObjectId('resultId') }),
  resultController.deleteResult
);

export default router;
