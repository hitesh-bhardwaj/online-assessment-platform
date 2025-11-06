import { Router } from 'express';
import invitationController from '../controllers/invitationController';
import {
  authenticate,
  requirePermission,
  rateLimitByUser
} from '../middleware/auth';
import { validateRequest, validateObjectId, commonSchemas } from '../middleware/validation';

const router = Router();

// Validation schemas
const withOptional = <T extends Record<string, unknown>>(schema: T) => ({
  ...schema,
  optional: true as const
});

const candidateSchema = {
  firstName: {
    ...commonSchemas.name,
    isLength: { options: { min: 1, max: 50 } },
    errorMessage: 'First name must be between 1 and 50 characters'
  },
  lastName: {
    ...commonSchemas.name,
    isLength: { options: { min: 1, max: 50 } },
    errorMessage: 'Last name must be between 1 and 50 characters'
  },
  email: {
    ...commonSchemas.email
  },
  phone: {
    optional: true,
    matches: {
      options: /^[\+]?[1-9][\d]{0,15}$/,
      errorMessage: 'Phone number must be a valid format'
    }
  },
  resumeUrl: {
    optional: true,
    isURL: true,
    errorMessage: 'Resume URL must be a valid URL'
  },
  position: {
    optional: true,
    isLength: { options: { min: 1, max: 100 } },
    trim: true,
    errorMessage: 'Position must be between 1 and 100 characters'
  }
};

const createInvitationSchema = {
  body: {
    assessmentId: {
      ...commonSchemas.objectId
    },
    candidate: {
      isObject: true,
      custom: {
        options: (candidate: any) => {
          return candidate.firstName && candidate.lastName && candidate.email;
        }
      },
      errorMessage: 'Candidate must be an object with firstName, lastName, and email'
    },
    'candidate.firstName': candidateSchema.firstName,
    'candidate.lastName': candidateSchema.lastName,
    'candidate.email': candidateSchema.email,
    'candidate.phone': candidateSchema.phone,
    'candidate.resumeUrl': candidateSchema.resumeUrl,
    'candidate.position': candidateSchema.position,
    validFrom: {
      optional: true,
      isISO8601: true,
      toDate: true,
      errorMessage: 'Valid from must be a valid date'
    },
    validUntil: {
      isISO8601: true,
      toDate: true,
      custom: {
        options: (validUntil: Date, { req }: any) => {
          const validFrom = req.body.validFrom ? new Date(req.body.validFrom) : new Date();
          return new Date(validUntil) > validFrom;
        }
      },
      errorMessage: 'Valid until must be a future date after valid from'
    },
    customMessage: {
      optional: true,
      isLength: { options: { max: 500 } },
      trim: true,
      errorMessage: 'Custom message must be less than 500 characters'
    }
  }
};

const bulkCreateInvitationsSchema = {
  body: {
    assessmentId: {
      ...commonSchemas.objectId
    },
    candidates: {
      isArray: { options: { min: 1, max: 100 } },
      custom: {
        options: (candidates: any[]) => {
          return candidates.every(candidate =>
            candidate.firstName && candidate.lastName && candidate.email
          );
        }
      },
      errorMessage: 'Candidates must be an array (1-100 items) with firstName, lastName, and email for each'
    },
    validFrom: {
      optional: true,
      isISO8601: true,
      toDate: true,
      errorMessage: 'Valid from must be a valid date'
    },
    validUntil: {
      isISO8601: true,
      toDate: true,
      custom: {
        options: (validUntil: Date, { req }: any) => {
          const validFrom = req.body.validFrom ? new Date(req.body.validFrom) : new Date();
          return new Date(validUntil) > validFrom;
        }
      },
      errorMessage: 'Valid until must be a future date after valid from'
    },
    customMessage: {
      optional: true,
      isLength: { options: { max: 500 } },
      trim: true,
      errorMessage: 'Custom message must be less than 500 characters'
    }
  }
};

const updateInvitationSchema = {
  body: {
    validFrom: {
      optional: true,
      isISO8601: true,
      toDate: true,
      errorMessage: 'Valid from must be a valid date'
    },
    validUntil: {
      optional: true,
      isISO8601: true,
      toDate: true,
      custom: {
        options: (validUntil: Date, { req }: any) => {
          if (!validUntil) return true;
          const validFrom = req.body.validFrom ? new Date(req.body.validFrom) : new Date();
          return new Date(validUntil) > validFrom;
        }
      },
      errorMessage: 'Valid until must be a future date after valid from'
    },
    customMessage: {
      optional: true,
      isLength: { options: { max: 500 } },
      trim: true,
      errorMessage: 'Custom message must be less than 500 characters'
    },
    candidate: {
      optional: true,
      isObject: true,
      errorMessage: 'Candidate must be an object'
    },
    'candidate.firstName': withOptional(candidateSchema.firstName),
    'candidate.lastName': withOptional(candidateSchema.lastName),
    'candidate.phone': candidateSchema.phone,
    'candidate.resumeUrl': candidateSchema.resumeUrl,
    'candidate.position': candidateSchema.position
  }
};

const getInvitationsQuerySchema = {
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
        options: [['pending', 'started', 'submitted', 'expired', 'cancelled']],
        errorMessage: 'Status must be pending, started, submitted, expired, or cancelled'
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
    }
  }
};

// Invitation routes
/**
 * @route   GET /api/invitations
 * @desc    Get all invitations for organization
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/',
  authenticate,
  requirePermission('invitations', 'read'),
  validateRequest(getInvitationsQuerySchema),
  invitationController.getInvitations
);

/**
 * @route   GET /api/invitations/:invitationId
 * @desc    Get invitation by ID
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/:invitationId',
  authenticate,
  requirePermission('invitations', 'read'),
  validateRequest({ params: validateObjectId('invitationId') }),
  invitationController.getInvitationById
);

/**
 * @route   POST /api/invitations
 * @desc    Create new invitation
 * @access  Private (Admin/Recruiter with create permission)
 */
router.post(
  '/',
  authenticate,
  requirePermission('invitations', 'create'),
  rateLimitByUser(100, 60 * 60 * 1000), // 100 invitations per hour
  validateRequest(createInvitationSchema),
  invitationController.createInvitation
);

/**
 * @route   POST /api/invitations/bulk
 * @desc    Bulk create invitations
 * @access  Private (Admin/Recruiter with create permission)
 */
router.post(
  '/bulk',
  authenticate,
  requirePermission('invitations', 'create'),
  rateLimitByUser(10, 60 * 60 * 1000), // 10 bulk operations per hour
  validateRequest(bulkCreateInvitationsSchema),
  invitationController.bulkCreateInvitations
);

/**
 * @route   PUT /api/invitations/:invitationId
 * @desc    Update invitation
 * @access  Private (Admin/Recruiter with update permission)
 */
router.put(
  '/:invitationId',
  authenticate,
  requirePermission('invitations', 'update'),
  validateRequest({ params: validateObjectId('invitationId') }),
  validateRequest(updateInvitationSchema),
  invitationController.updateInvitation
);

/**
 * @route   POST /api/invitations/:invitationId/cancel
 * @desc    Cancel invitation
 * @access  Private (Admin/Recruiter with update permission)
 */
router.post(
  '/:invitationId/cancel',
  authenticate,
  requirePermission('invitations', 'update'),
  validateRequest({ params: validateObjectId('invitationId') }),
  invitationController.cancelInvitation
);

/**
 * @route   POST /api/invitations/:invitationId/resend
 * @desc    Resend invitation
 * @access  Private (Admin/Recruiter with create permission)
 */
router.post(
  '/:invitationId/resend',
  authenticate,
  requirePermission('invitations', 'create'),
  rateLimitByUser(50, 60 * 60 * 1000), // 50 resends per hour
  validateRequest({ params: validateObjectId('invitationId') }),
  invitationController.resendInvitation
);

/**
 * @route   GET /api/invitations/analytics/:assessmentId
 * @desc    Get invitation analytics for assessment
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/analytics/:assessmentId',
  authenticate,
  requirePermission('invitations', 'read'),
  validateRequest({ params: validateObjectId('assessmentId') }),
  invitationController.getInvitationAnalytics
);

export default router;
