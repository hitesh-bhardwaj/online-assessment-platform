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
    email: { optional: true, ...commonSchemas.email },
    password: { optional: true, ...commonSchemas.password },
    firstName: { optional: true, ...commonSchemas.name, isLength: { options: { min: 1, max: 50 } } },
    lastName: { optional: true, ...commonSchemas.name, isLength: { options: { min: 1, max: 50 } } },
    role: { optional: true, isIn: { options: [['admin', 'recruiter']], errorMessage: 'Role must be admin or recruiter' } },
    isActive: { optional: true, isBoolean: true },
    status: { optional: true, isIn: { options: [['active', 'suspended']], errorMessage: 'status must be active or suspended' } },
    permissions: { optional: true, isObject: true }
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
router.get('/', authenticate, requirePermission('users', 'read'), validateRequest(getUsersQuerySchema), userController.getUsers);
router.get('/:userId', authenticate, requirePermission('users', 'read'), validateRequest({ params: validateObjectId('userId') }), userController.getUserById);
router.post('/', authenticate, requireUserManagement, rateLimitByUser(10, 60 * 60 * 1000), validateRequest(createUserSchema), userController.createUser);

router.put('/:userId',
  authenticate,
  requirePermission('users', 'update'),
  validateRequest({ params: validateObjectId('userId') }),
  validateRequest(updateUserSchema),
  userController.updateUser
);

// router.patch('/:userId/status',
//   authenticate,
//   requirePermission('users', 'update'),
//   validateRequest({ params: validateObjectId('userId') }),
//   validateRequest({ body: { status: { isIn: { options: [['active', 'suspended']], errorMessage: 'status must be active or suspended' } } } }),
//   userController.updateUserStatus // add this small helper below
// );

/**
 * @route   DELETE /api/users/:userId
 * @desc    Hard delete user (permanently removes the document)
 * @access  Private (Admin only)
 */
router.delete(
  '/:userId',
  authenticate,
  requirePermission('users', 'delete'),
  validateRequest({ params: validateObjectId('userId') }),
  userController.deleteUser // <-- now hard-deletes
);

router.put(
  '/:userId/reset-password',
  authenticate,
  requireAdmin,
  rateLimitByUser(5, 60 * 60 * 1000),
  validateRequest({ params: validateObjectId('userId') }),
  userController.resetUserPassword
);

router.get(
  '/:userId/activity',
  authenticate,
  requirePermission('users', 'read'),
  validateRequest({ params: validateObjectId('userId') }),
  userController.getUserActivity
);

export default router;
