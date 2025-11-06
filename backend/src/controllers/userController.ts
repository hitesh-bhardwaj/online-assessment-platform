import { Request, Response } from 'express';
import { User, SystemLog, IUserInfo } from '../models';
import { AuthenticatedRequest } from '../middleware/auth';
import logControllerError from '../utils/logger';
import { toObjectId, toObjectIdString } from '../utils/objectId';

// Helper function to get user info for logging
const getUserInfo = (req: Request): IUserInfo => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;

  return {
    userId: toObjectId(user?._id),
    email: user?.email,
    role: user?.role,
    ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown'
  };
};

export const userController = {
  // Get all users in organization
  async getUsers(req: AuthenticatedRequest, res: Response) {
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
        role,
        search,
        isActive
      } = req.query;

      const organizationId = toObjectId(user.organizationId);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier'
        });
      }

      // Build query
      const query: Record<string, unknown> = {
        organizationId
      };

      if (typeof role === 'string') {
        query.role = role;
      }
      if (typeof isActive === 'string') {
        query.isActive = isActive === 'true';
      }
      if (typeof search === 'string' && search.trim().length > 0) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      const users = await User.find(query)
        .select('-password -passwordResetToken -passwordResetExpires')
        .populate('organizationId', 'name')
        .sort({ createdAt: -1 })
        .limit(Number(limit) * 1)
        .skip((Number(page) - 1) * Number(limit));

      const total = await User.countDocuments(query);

      res.json({
        success: true,
        data: {
          users,
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
        category: 'system',
        action: 'get_users_error',
        message: 'Error retrieving users',
        error,
        extra: {
          handler: 'userController.getUsers'
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Get user by ID
  async getUserById(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      const currentUser = req.user;

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const organizationId = toObjectId(currentUser.organizationId);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier'
        });
      }

      const user = await User.findOne({
        _id: userId,
        organizationId
      })
        .select('-password -passwordResetToken -passwordResetExpires')
        .populate('organizationId', 'name');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: user
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'get_user_by_id_error',
        message: 'Error retrieving user by id',
        error,
        extra: {
          handler: 'userController.getUserById',
          requestedUserId: req.params.userId
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Create new user
  async createUser(req: AuthenticatedRequest, res: Response) {
    try {
      const currentUser = req.user;
      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const {
        email,
        password,
        firstName,
        lastName,
        role = 'recruiter'
      } = req.body;

      const organizationId = toObjectId(currentUser.organizationId);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier'
        });
      }

      // Check if user already exists in organization
      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        organizationId
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists in your organization'
        });
      }

      // Create new user
      const newUser = new User({
        organizationId,
        email: email.toLowerCase(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role
      });

      const defaultPermissions = role === 'admin'
        ? {
            assessments: { create: true, read: true, update: true, delete: true },
            questions: { create: true, read: true, update: true, delete: true },
            invitations: { create: true, read: true, update: true, delete: true },
            results: { read: true, export: true, delete: true },
            users: { create: true, read: true, update: true, delete: true },
            organization: { read: true, update: true }
          }
        : {
            assessments: { create: true, read: true, update: true, delete: false },
            questions: { create: true, read: true, update: true, delete: false },
            invitations: { create: true, read: true, update: true, delete: false },
            results: { read: true, export: true, delete: false },
            users: { create: false, read: false, update: false, delete: false },
            organization: { read: true, update: false }
          };

      newUser.permissions = defaultPermissions as IUser['permissions'];

      await newUser.save();

      // Log user creation
      await SystemLog.create({
        level: 'info',
        category: 'auth',
        action: 'user_create',
        message: 'New user created',
        details: {
          newUserId: toObjectIdString(newUser._id),
          email: newUser.email,
          role: newUser.role
        },
        context: { organizationId },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      // Return user data without password
      const userResponse = await User.findById(newUser._id)
        .select('-password -passwordResetToken -passwordResetExpires')
        .populate('organizationId', 'name');

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: userResponse
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'create_user_error',
        message: 'Error creating user',
        error,
        extra: {
          handler: 'userController.createUser'
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Update user
  async updateUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      const currentUser = req.user;

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const {
        firstName,
        lastName,
        role,
        isActive,
        permissions
      } = req.body;

      const organizationId = toObjectId(currentUser.organizationId);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier'
        });
      }

      // Find user in same organization
      const user = await User.findOne({
        _id: userId,
        organizationId
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Prevent users from modifying their own admin status
      const currentUserId = toObjectIdString(currentUser._id);
      if (currentUserId && userId === currentUserId && role && role !== currentUser.role) {
        return res.status(400).json({
          success: false,
          message: 'Cannot modify your own role'
        });
      }

      // Track changes
      const changes: any = {};

      if (firstName && firstName !== user.firstName) {
        changes.firstName = { from: user.firstName, to: firstName };
        user.firstName = firstName.trim();
      }

      if (lastName && lastName !== user.lastName) {
        changes.lastName = { from: user.lastName, to: lastName };
        user.lastName = lastName.trim();
      }

      if (role && role !== user.role) {
        changes.role = { from: user.role, to: role };
        user.role = role;
        // Permissions will be automatically updated by pre-save middleware
      }

      if (isActive !== undefined && isActive !== user.isActive) {
        changes.isActive = { from: user.isActive, to: isActive };
        user.isActive = isActive;
      }

      if (permissions && currentUser.role === 'admin') {
        changes.permissions = { from: user.permissions, to: permissions };
        user.permissions = { ...user.permissions, ...permissions };
      }

      await user.save();

      // Log the update
      await SystemLog.create({
        level: 'info',
        category: 'auth',
        action: 'user_update',
        message: 'User updated',
        details: { userId, changes },
        context: { organizationId },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      // Return updated user data
      const updatedUser = await User.findById(userId)
        .select('-password -passwordResetToken -passwordResetExpires')
        .populate('organizationId', 'name');

      res.json({
        success: true,
        message: 'User updated successfully',
        data: updatedUser
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'update_user_error',
        message: 'Error updating user',
        error,
        extra: {
          handler: 'userController.updateUser',
          targetUserId: req.params.userId
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Delete user (deactivate)
  async deleteUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      const currentUser = req.user;

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Prevent users from deleting themselves
      const organizationId = toObjectId(currentUser.organizationId);
      const currentUserId = toObjectIdString(currentUser._id);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier'
        });
      }

      if (currentUserId && userId === currentUserId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete your own account'
        });
      }

      // Find user in same organization
      const user = await User.findOne({
        _id: userId,
        organizationId
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Deactivate user instead of hard delete
      user.isActive = false;
      await user.save();

      // Log the deletion
      await SystemLog.create({
        level: 'info',
        category: 'auth',
        action: 'user_delete',
        message: 'User deactivated',
        details: {
          deletedUserId: userId,
          deletedUserEmail: user.email
        },
        context: { organizationId },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'User deactivated successfully'
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'delete_user_error',
        message: 'Error deactivating user',
        error,
        extra: {
          handler: 'userController.deleteUser',
          targetUserId: req.params.userId
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Reset user password (admin only)
  async resetUserPassword(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;
      const currentUser = req.user;

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const organizationId = toObjectId(currentUser.organizationId);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier'
        });
      }

      // Find user in same organization
      const user = await User.findOne({
        _id: userId,
        organizationId
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      // Log password reset
      await SystemLog.create({
        level: 'info',
        category: 'auth',
        action: 'password_reset_admin',
        message: 'User password reset by admin',
        details: { targetUserId: userId },
        context: { organizationId },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      // Log security event for the target user
      await SystemLog.logSecurity(
        'password_reset_by_admin',
        'Password was reset by an administrator',
        {
          userId: toObjectId(user._id),
          email: user.email,
          role: user.role,
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown'
        },
        {
          organizationId,
          userId: toObjectId(user._id)
        },
        { resetByAdmin: toObjectId(currentUser._id) }
      );

      res.json({
        success: true,
        message: 'Password reset successfully'
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'reset_password_error',
        message: 'Error resetting user password',
        error,
        extra: {
          handler: 'userController.resetUserPassword',
          targetUserId: req.params.userId
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Get user activity/statistics
  async getUserActivity(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      const currentUser = req.user;

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const organizationId = toObjectId(currentUser.organizationId);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier'
        });
      }

      // Find user in same organization
      const user = await User.findOne({
        _id: userId,
        organizationId
      }).select('-password -passwordResetToken -passwordResetExpires');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get user activity statistics
      const [assessmentCount, invitationCount, recentLogs] = await Promise.all([
        // Count assessments created by user
        (await import('../models')).Assessment.countDocuments({
          createdBy: userId,
          isActive: true
        }),

        // Count invitations created by user
        (await import('../models')).Invitation.countDocuments({
          createdBy: userId
        }),

        // Get recent activity logs
        SystemLog.find({
          'context.userId': userId
        })
          .sort({ timestamp: -1 })
          .limit(10)
          .select('action message timestamp category')
      ]);

      res.json({
        success: true,
        data: {
          user,
          statistics: {
            assessmentsCreated: assessmentCount,
            invitationsSent: invitationCount,
            lastLogin: user.lastLogin
          },
          recentActivity: recentLogs
        }
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'get_user_activity_error',
        message: 'Error retrieving user activity',
        error,
        extra: {
          handler: 'userController.getUserActivity',
          targetUserId: req.params.userId
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
};

export default userController;
