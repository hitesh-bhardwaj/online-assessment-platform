import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User, SystemLog, IUserInfo, IUser } from '../models';
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
    userAgent: req.get('User-Agent') || 'unknown',
  };
};
const defaultPermissionsFor = (role: 'admin' | 'recruiter') =>
  role === 'admin'
    ? {
        assessments: { create: true, read: true, update: true, delete: true },
        questions:   { create: true, read: true, update: true, delete: true },
        invitations: { create: true, read: true, update: true, delete: true },
        results:     { read: true, export: true, delete: true },
        users:       { create: true, read: true, update: true, delete: true },
        organization:{ read: true, update: true },
      }
    : {
        assessments: { create: true, read: true, update: true, delete: false },
        questions:   { create: true, read: true, update: true, delete: false },
        invitations: { create: true, read: true, update: true, delete: false },
        results:     { read: true, export: true, delete: false },
        users:       { create: false, read: false, update: false, delete: false },
        organization:{ read: true, update: false },
      };

export const userController = {
  // Get all users in organization
   async getUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ success: false, message: 'User not authenticated' });

      const { page = 1, limit = 10, role, search, isActive } = req.query;
      const organizationId = toObjectId(user.organizationId);
      if (!organizationId) return res.status(400).json({ success: false, message: 'Invalid organization identifier' });

      const query: Record<string, unknown> = { organizationId };
      if (typeof role === 'string') query.role = role;
      if (typeof isActive === 'string') query.isActive = isActive === 'true';
      if (typeof search === 'string' && search.trim()) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName:  { $regex: search,  $options: 'i' } },
          { email:     { $regex: search,  $options: 'i' } },
        ];
      }

      const users = await User.find(query)
        .select('-password -passwordResetToken -passwordResetExpires')
        .populate('organizationId', 'name')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit));

      const total = await User.countDocuments(query);

      return res.json({
        success: true,
        data: {
          users, // includes virtual `status` => 'active' | 'suspended'
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      await logControllerError(req, { category: 'system', action: 'get_users_error', message: 'Error retrieving users', error, extra: { handler: 'userController.getUsers' } });
      return res.status(500).json({ success: false, message: 'Internal server error' });
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
          message: 'User not authenticated',
        });
      }

      const organizationId = toObjectId(currentUser.organizationId);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier',
        });
      }

      const user = await User.findOne({
        _id: userId,
        organizationId,
      })
        .select('-password -passwordResetToken -passwordResetExpires')
        .populate('organizationId', 'name');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'get_user_by_id_error',
        message: 'Error retrieving user by id',
        error,
        extra: {
          handler: 'userController.getUserById',
          requestedUserId: req.params.userId,
        },
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },

  // Create new user (per-org unique email)
   async createUser(req: AuthenticatedRequest, res: Response) {
    try {
      const currentUser = req.user;
      if (!currentUser) return res.status(401).json({ success: false, message: 'User not authenticated' });

      const { email, password, firstName, lastName } = req.body;
      const role: 'admin' | 'recruiter' = req.body.role || 'recruiter';
      const organizationId = toObjectId(currentUser.organizationId);
      if (!organizationId) return res.status(400).json({ success: false, message: 'Invalid organization identifier' });

      const emailLC = String(email).trim().toLowerCase();

      const existing = await User.findOne({ organizationId, email: emailLC }).lean();
      if (existing) {
        return res.status(409).json({ success: false, message: 'User with this email already exists in your organization' });
      }

      const user = await User.create({
        organizationId,
        email: emailLC,
        password,
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        role,
        permissions: defaultPermissionsFor(role), // defensive; schema also has a default
      });

      await SystemLog.create({
        level: 'info', category: 'auth', action: 'user_create', message: 'New user created',
        details: { newUserId: toObjectIdString(user._id), email: user.email, role: user.role },
        context: { organizationId }, userInfo: getUserInfo(req), timestamp: new Date()
      });

      const userResponse = await User.findById(user._id)
        .select('-password -passwordResetToken -passwordResetExpires')
        .populate('organizationId', 'name');

      return res.status(201).json({ success: true, message: 'User created successfully', data: userResponse });
    } catch (error: any) {
      if (error?.code === 11000) {
        const dupOrgEmail = error?.keyPattern?.organizationId === 1 && error?.keyPattern?.email === 1;
        return res.status(409).json({ success: false, message: dupOrgEmail ? 'User with this email already exists in your organization' : 'Email is already in use' });
      }
      await logControllerError(req, { category: 'system', action: 'create_user_error', message: 'Error creating user', error, extra: { handler: 'userController.createUser' } });
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },
  // Update user
  async updateUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      const currentUser = req.user;
      if (!currentUser) return res.status(401).json({ success: false, message: 'User not authenticated' });

      const organizationId = toObjectId(currentUser.organizationId);
      if (!organizationId) return res.status(400).json({ success: false, message: 'Invalid organization identifier' });

      const user = await User.findOne({ _id: userId, organizationId });
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const currentUserId = toObjectIdString(currentUser._id);
      const {
        email, password, firstName, lastName, role, isActive, status, permissions
      } = req.body as Partial<IUser> & { status?: 'active' | 'suspended' };

      const changes: any = {};

      // Email (per-org uniqueness)
      if (typeof email === 'string' && email.trim().toLowerCase() !== user.email) {
        const emailLC = email.trim().toLowerCase();
        const exists = await User.findOne({ organizationId, email: emailLC, _id: { $ne: user._id } }).lean();
        if (exists) return res.status(409).json({ success: false, message: 'User with this email already exists in your organization' });
        changes.email = { from: user.email, to: emailLC };
        user.email = emailLC;
      }

      if (typeof firstName === 'string' && firstName.trim() && firstName !== user.firstName) {
        changes.firstName = { from: user.firstName, to: firstName.trim() };
        user.firstName = firstName.trim();
      }
      if (typeof lastName === 'string' && lastName.trim() && lastName !== user.lastName) {
        changes.lastName = { from: user.lastName, to: lastName.trim() };
        user.lastName = lastName.trim();
      }

      // Role
      if (role && role !== user.role) {
        if (currentUserId && userId === currentUserId) {
          return res.status(400).json({ success: false, message: 'Cannot modify your own role' });
        }
        changes.role = { from: user.role, to: role };
        user.role = role as any;
        // let schema hook adjust permissions, but we can also update explicitly if you pass permissions
      }

      // Password
      if (typeof password === 'string' && password.length >= 8) {
        changes.password = { set: true };
        user.password = password; // will hash in pre-save
      }

      // Status or isActive
      if (status === 'active' || status === 'suspended') {
        const nextActive = status === 'active';
        if (user.isActive !== nextActive) {
          changes.status = { from: user.isActive ? 'active' : 'suspended', to: status };
          user.isActive = nextActive;
        }
      } else if (typeof isActive === 'boolean' && isActive !== user.isActive) {
        changes.isActive = { from: user.isActive, to: isActive };
        user.isActive = isActive;
      }

      // Permissions (admin only)
      if (permissions && currentUser.role === 'admin') {
        changes.permissions = { from: user.permissions, to: permissions };
        user.permissions = { ...user.permissions, ...permissions };
      }

      await user.save();

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

      const updatedUser = await User.findById(userId)
        .select('-password -passwordResetToken -passwordResetExpires')
        .populate('organizationId', 'name');

      return res.json({ success: true, message: 'User updated successfully', data: updatedUser });
    } catch (error) {
      await logControllerError(req, { category: 'system', action: 'update_user_error', message: 'Error updating user', error, extra: { handler: 'userController.updateUser', targetUserId: req.params.userId } });
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },

  // Optional small helper for PATCH /:userId/status
  async updateUserStatus(req: AuthenticatedRequest, res: Response) {
    req.body = { status: req.body.status }; // normalize
    return this.updateUser(req, res);
  },

  // Delete user (HARD DELETE with transaction)
  async deleteUser(req: AuthenticatedRequest, res: Response) {
    const session = await mongoose.startSession();
    try {
      const { userId } = req.params;
      const currentUser = req.user;

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      const organizationId = toObjectId(currentUser.organizationId);
      const currentUserId = toObjectIdString(currentUser._id);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier',
        });
      }

      if (currentUserId && userId === currentUserId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete your own account',
        });
      }

      await session.withTransaction(async () => {
        // Ensure the user exists and belongs to this org
        const user = await User.findOne({
          _id: userId,
          organizationId,
        }).session(session);
        if (!user) {
          const err: any = new Error('User not found');
          err.status = 404;
          throw err;
        }

        // OPTIONAL: cascade delete related docs IF those models exist
        // We cast to a loose type so TS won't error if a model isn't exported.
        const models = (await import('../models')) as Record<string, any>;

        // Define possible cascades here. Add/remove as your project needs.
        const cascades: Array<{
          modelKey: string;
          filter: Record<string, any>;
        }> = [
          {
            modelKey: 'Assessment',
            filter: { createdBy: userId, organizationId },
          },
          {
            modelKey: 'Invitation',
            filter: { createdBy: userId, organizationId },
          },
          // If you actually have a results collection, set the correct modelKey:
          // { modelKey: 'Result', filter: { userId, organizationId } },
          // or e.g. { modelKey: 'AssessmentResult', filter: { userId, organizationId } },
        ];

        for (const { modelKey, filter } of cascades) {
          const Model = models[modelKey];
          if (Model?.deleteMany) {
            await Model.deleteMany(filter).session(session);
          }
        }

        // HARD delete the user document
        await User.deleteOne({ _id: userId, organizationId }).session(session);

        // Log the deletion
        await SystemLog.create(
          [
            {
              level: 'info',
              category: 'auth',
              action: 'user_delete_hard',
              message: 'User hard-deleted',
              details: {
                deletedUserId: userId,
                deletedUserEmail: user.email,
              },
              context: { organizationId },
              userInfo: getUserInfo(req),
              timestamp: new Date(),
            },
          ],
          { session }
        );
      });

      return res.status(204).send();
    } catch (error: any) {
      const status = error?.status ?? 500;
      await logControllerError(req, {
        category: 'system',
        action: 'delete_user_error',
        message: 'Error hard-deleting user',
        error,
        extra: {
          handler: 'userController.deleteUser',
          targetUserId: req.params.userId,
        },
      });
      return res.status(status).json({
        success: false,
        message: error?.message || 'Internal server error',
      });
    } finally {
      session.endSession();
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
          message: 'User not authenticated',
        });
      }

      const organizationId = toObjectId(currentUser.organizationId);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier',
        });
      }

      // Find user in same organization
      const user = await User.findOne({
        _id: userId,
        organizationId,
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
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
        timestamp: new Date(),
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
          userAgent: req.get('User-Agent') || 'unknown',
        },
        {
          organizationId,
          userId: toObjectId(user._id),
        },
        { resetByAdmin: toObjectId(currentUser._id) }
      );

      res.json({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'reset_password_error',
        message: 'Error resetting user password',
        error,
        extra: {
          handler: 'userController.resetUserPassword',
          targetUserId: req.params.userId,
        },
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
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
          message: 'User not authenticated',
        });
      }

      const organizationId = toObjectId(currentUser.organizationId);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier',
        });
      }

      // Find user in same organization
      const user = await User.findOne({
        _id: userId,
        organizationId,
      }).select('-password -passwordResetToken -passwordResetExpires');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Get user activity statistics
      const [assessmentCount, invitationCount, recentLogs] = await Promise.all([
        // Count assessments created by user
        (
          await import('../models')
        ).Assessment.countDocuments({
          createdBy: userId,
          isActive: true,
        }),

        // Count invitations created by user
        (
          await import('../models')
        ).Invitation.countDocuments({
          createdBy: userId,
        }),

        // Get recent activity logs
        SystemLog.find({
          'context.userId': userId,
        })
          .sort({ timestamp: -1 })
          .limit(10)
          .select('action message timestamp category'),
      ]);

      res.json({
        success: true,
        data: {
          user,
          statistics: {
            assessmentsCreated: assessmentCount,
            invitationsSent: invitationCount,
            lastLogin: user.lastLogin,
          },
          recentActivity: recentLogs,
        },
      });
    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'get_user_activity_error',
        message: 'Error retrieving user activity',
        error,
        extra: {
          handler: 'userController.getUserActivity',
          targetUserId: req.params.userId,
        },
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },
};

export default userController;
