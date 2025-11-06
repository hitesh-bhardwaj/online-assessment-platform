import { Router } from 'express';
import organizationController from '../controllers/organizationController';
import { authenticate, requireAdmin, requirePermission } from '../middleware/auth';
import { validateRequest, commonSchemas } from '../middleware/validation';

const router = Router();

// Validation schemas
const updateOrganizationSchema = {
  body: {
    name: {
      optional: true,
      ...commonSchemas.name
    },
    domain: {
      optional: true,
      isLength: { options: { min: 2, max: 100 } },
      matches: {
        options: /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/,
        errorMessage: 'Domain must be a valid domain format'
      },
      toLowerCase: true,
      trim: true,
      errorMessage: 'Domain must be between 2 and 100 characters'
    },
    contactEmail: {
      optional: true,
      ...commonSchemas.email
    },
    branding: {
      optional: true,
      isObject: true,
      custom: {
        options: (branding: Record<string, unknown>) => {
          const { logoUrl, primaryColor, secondaryColor } = branding;

          if (logoUrl && typeof logoUrl !== 'string') {
            throw new Error('Logo URL must be a string');
          }
          if (primaryColor && typeof primaryColor === 'string' && !/^#[0-9A-F]{6}$/i.test(primaryColor)) {
            throw new Error('Primary color must be a valid hex color');
          }
          if (secondaryColor && typeof secondaryColor === 'string' && !/^#[0-9A-F]{6}$/i.test(secondaryColor)) {
            throw new Error('Secondary color must be a valid hex color');
          }
          return true;
        }
      }
    },
    settings: {
      optional: true,
      isObject: true,
      custom: {
        options: (settings: Record<string, unknown>) => {
          const dataRetentionDays = settings.dataRetentionDays as number | undefined;
          const gdprCompliant = settings.gdprCompliant;

          if (dataRetentionDays !== undefined && (!Number.isInteger(dataRetentionDays) || dataRetentionDays < 30 || dataRetentionDays > 2555)) {
            throw new Error('Data retention days must be between 30 and 2555');
          }
          if (gdprCompliant !== undefined && typeof gdprCompliant !== 'boolean') {
            throw new Error('GDPR compliant must be a boolean');
          }
          return true;
        }
      }
    }
  }
};

const createOrganizationSchema = {
  body: {
    name: {
      ...commonSchemas.name
    },
    domain: {
      optional: true,
      isLength: { options: { min: 2, max: 100 } },
      matches: {
        options: /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/,
        errorMessage: 'Domain must be a valid domain format'
      },
      toLowerCase: true,
      trim: true
    },
    contactEmail: {
      ...commonSchemas.email
    },
    subscriptionPlan: {
      optional: true,
      isIn: {
        options: [['free', 'basic', 'premium']],
        errorMessage: 'Subscription plan must be free, basic, or premium'
      }
    },
    adminUser: {
      optional: true,
      isObject: true,
      custom: {
        options: (adminUser: Record<string, unknown>) => {
          const { email, password, firstName, lastName } = adminUser;

          if (!email || !password || !firstName || !lastName) {
            throw new Error('Admin user must have email, password, firstName, and lastName');
          }
          return true;
        }
      }
    }
  }
};

const featureParamSchema = {
  params: {
    feature: {
      isLength: { options: { min: 1, max: 50 } },
      trim: true,
      errorMessage: 'Feature name is required'
    }
  }
};

// Organization routes
/**
 * @route   GET /api/organizations/current
 * @desc    Get current user's organization details
 * @access  Private (Admin/Recruiter)
 */
router.get('/current', authenticate, organizationController.getOrganization);

/**
 * @route   PUT /api/organizations/current
 * @desc    Update current user's organization
 * @access  Private (Admin only)
 */
router.put(
  '/current',
  authenticate,
  requirePermission('organization', 'update'),
  validateRequest(updateOrganizationSchema),
  organizationController.updateOrganization
);

/**
 * @route   GET /api/organizations/subscription
 * @desc    Get organization subscription details
 * @access  Private (Admin/Recruiter)
 */
router.get('/subscription', authenticate, organizationController.getSubscription);

/**
 * @route   GET /api/organizations/feature/:feature
 * @desc    Check if organization has specific feature
 * @access  Private (Admin/Recruiter)
 */
router.get(
  '/feature/:feature',
  authenticate,
  validateRequest(featureParamSchema),
  organizationController.checkFeature
);

/**
 * @route   GET /api/organizations/usage-stats
 * @desc    Get organization usage statistics
 * @access  Private (Admin only)
 */
router.get(
  '/usage-stats',
  authenticate,
  requireAdmin,
  organizationController.getUsageStats
);

/**
 * @route   POST /api/organizations
 * @desc    Create new organization (System admin only)
 * @access  Private (System Admin)
 * @note    This endpoint would typically be restricted to system administrators
 */
router.post(
  '/',
  validateRequest(createOrganizationSchema),
  organizationController.createOrganization
);

export default router;
