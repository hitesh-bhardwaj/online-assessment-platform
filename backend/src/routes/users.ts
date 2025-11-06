import { Router } from 'express';
import userController from '../controllers/userController';
import {
  authenticate,
  requirePermission,
  requireUserManagement,
  requireAdmin,
  rateLimitByUser
} from '../middleware/auth';
import { validateRequest, validateObjectId, validatePagination, commonSchemas } from '../middleware/validation';

const router = Router();

// Validation schemas
const createUserSchema = {
  body: {
    email: {
      ...commonSchemas.email
    },
    password: {
      ...commonSchemas.password
    },
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
    role: {
      optional: true,
      isIn: {
        options: [['admin', 'recruiter']],
        errorMessage: 'Role must be admin or recruiter'
      }
    }
  }
};

const updateUserSchema = {
  body: {
    firstName: {
      optional: true,
      ...commonSchemas.name,
      isLength: { options: { min: 1, max: 50 } },
      errorMessage: 'First name must be between 1 and 50 characters'
    },
    lastName: {
      optional: true,
      ...commonSchemas.name,
      isLength: { options: { min: 1, max: 50 } },
      errorMessage: 'Last name must be between 1 and 50 characters'
    },
    role: {
      optional: true,
      isIn: {
        options: [['admin', 'recruiter']],
        errorMessage: 'Role must be admin or recruiter'
      }
    },
    isActive: {
      optional: true,
      isBoolean: true,
      errorMessage: 'isActive must be a boolean'
    },
    permissions: {
      optional: true,
      isObject: true,
      errorMessage: 'Permissions must be an object'
    }
  }
};

const resetPasswordSchema = {
  body: {
    newPassword: {
      ...commonSchemas.password
    }
  }
};

const getUsersQuerySchema = {
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
    role: {
      optional: true,
      isIn: {
        options: [['admin', 'recruiter']],
        errorMessage: 'Role must be admin or recruiter'
      }
    },
    search: {
      optional: true,
      isLength: { options: { min: 1, max: 100 } },
      trim: true,
      errorMessage: 'Search term must be between 1 and 100 characters'
    },
    isActive: {
      optional: true,
      isIn: {
        options: [['true', 'false']],
        errorMessage: 'isActive must be true or false'
      }
    }
  }
};

// User management routes
/**
 * @route   GET /api/users
 * @desc    Get all users in organization
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/',
  authenticate,
  requirePermission('users', 'read'),
  validateRequest(getUsersQuerySchema),
  userController.getUsers
);

/**
 * @route   GET /api/users/:userId
 * @desc    Get user by ID
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/:userId',
  authenticate,
  requirePermission('users', 'read'),
  validateRequest({ params: validateObjectId('userId') }),
  userController.getUserById
);

/**
 * @route   POST /api/users
 * @desc    Create new user
 * @access  Private (Admin only)
 */
router.post(
  '/',
  authenticate,
  requireUserManagement,
  rateLimitByUser(10, 60 * 60 * 1000), // 10 requests per hour
  validateRequest(createUserSchema),
  userController.createUser
);

/**
 * @route   PUT /api/users/:userId
 * @desc    Update user
 * @access  Private (Admin only)
 */
router.put(
  '/:userId',
  authenticate,
  requirePermission('users', 'update'),
  validateRequest({ params: validateObjectId('userId') }),
  validateRequest(updateUserSchema),
  userController.updateUser
);

/**
 * @route   DELETE /api/users/:userId
 * @desc    Delete user (deactivate)
 * @access  Private (Admin only)
 */
router.delete(
  '/:userId',
  authenticate,
  requirePermission('users', 'delete'),
  validateRequest({ params: validateObjectId('userId') }),
  userController.deleteUser
);

/**
 * @route   PUT /api/users/:userId/reset-password
 * @desc    Reset user password (admin only)
 * @access  Private (Admin only)
 */
router.put(
  '/:userId/reset-password',
  authenticate,
  requireAdmin,
  rateLimitByUser(5, 60 * 60 * 1000), // 5 password resets per hour
  validateRequest({ params: validateObjectId('userId') }),
  validateRequest(resetPasswordSchema),
  userController.resetUserPassword
);

/**
 * @route   GET /api/users/:userId/activity
 * @desc    Get user activity and statistics
 * @access  Private (Admin/Recruiter with read permission)
 */
router.get(
  '/:userId/activity',
  authenticate,
  requirePermission('users', 'read'),
  validateRequest({ params: validateObjectId('userId') }),
  userController.getUserActivity
);

export default router;