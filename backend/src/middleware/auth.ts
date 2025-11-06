import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, SystemLog } from '../models';
import { IUser } from '../models/User';
import { IPermissions } from '../models/User';
import { JWTPayload } from '../controllers/authController';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
  candidate?: {
    invitationId: string;
    email: string;
    assessmentId: string;
  };
}

// Helper function to get user info for logging
const getUserInfo = (req: Request, user?: IUser) => ({
  userId: user?._id,
  email: user?.email,
  role: user?.role,
  ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
  userAgent: req.get('User-Agent') || 'unknown'
});

// Middleware to authenticate users
export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

      // Find user and populate organization
      const user = await User.findById(decoded.userId)
        .populate('organizationId', 'name domain isActive')
        .exec();

      if (!user) {
        await SystemLog.create({
          level: 'security',
          category: 'security',
          action: 'invalid_token_user_not_found',
          message: 'Token valid but user not found',
          userInfo: getUserInfo(req),
          details: { userId: decoded.userId },
          timestamp: new Date()
        });
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if user is active
      if (!user.isActive) {
        await SystemLog.create({
          level: 'security',
          category: 'security',
          action: 'inactive_user_access',
          message: 'Inactive user attempted access',
          userInfo: getUserInfo(req, user),
          details: { organizationId: user.organizationId },
          timestamp: new Date()
        });
        return res.status(401).json({
          success: false,
          message: 'User account is deactivated'
        });
      }

      // Check if organization is active
      if (!user.organizationId || !(user.organizationId as any).isActive) {
        await SystemLog.create({
          level: 'security',
          category: 'security',
          action: 'inactive_org_access',
          message: 'User from inactive organization attempted access',
          userInfo: getUserInfo(req, user),
          details: { organizationId: user.organizationId },
          timestamp: new Date()
        });
        return res.status(401).json({
          success: false,
          message: 'Organization is not active'
        });
      }

      // Verify token data matches user
      if (user.email !== decoded.email || user.organizationId._id.toString() !== decoded.organizationId) {
        await SystemLog.create({
          level: 'security',
          category: 'security',
          action: 'token_user_mismatch',
          message: 'Token data does not match user',
          userInfo: getUserInfo(req, user),
          details: { organizationId: user.organizationId },
          timestamp: new Date()
        });
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }

      req.user = user;
      next();

    } catch (jwtError) {
      await SystemLog.create({
        level: 'security',
        category: 'security',
        action: 'invalid_token',
        message: 'Invalid JWT token provided',
        userInfo: getUserInfo(req),
        details: {},
        error: jwtError instanceof Error ? jwtError.message : 'JWT verification failed',
        timestamp: new Date()
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

  } catch (error) {
    await SystemLog.create({
      level: 'security',
      category: 'security',
      action: 'auth_middleware_error',
      message: 'Authentication middleware error',
      userInfo: getUserInfo(req),
      details: {},
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    });
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// Middleware to authenticate candidates
export const authenticateCandidate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      // Validate candidate token structure
      if (!decoded.invitationId || !decoded.candidateEmail || !decoded.assessmentId) {
        return res.status(401).json({
          success: false,
          message: 'Invalid candidate token'
        });
      }

      // Verify invitation still exists and is valid
      const { Invitation } = await import('../models');
      const invitation = await Invitation.findById(decoded.invitationId);

      if (!invitation || !invitation.isValid()) {
        await SystemLog.create({
          level: 'security',
          category: 'security',
          action: 'invalid_candidate_session',
          message: 'Invalid candidate session token',
          userInfo: getUserInfo(req),
          details: { invitationId: decoded.invitationId },
          timestamp: new Date()
        });
        return res.status(401).json({
          success: false,
          message: 'Session expired or invalid'
        });
      }

      req.candidate = {
        invitationId: decoded.invitationId,
        email: decoded.candidateEmail,
        assessmentId: decoded.assessmentId
      };

      next();

    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// Middleware to check if user has specific role
export const requireRole = (roles: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!roles.includes(user.role)) {
      await SystemLog.create({
        level: 'security',
        category: 'security',
        action: 'unauthorized_role_access',
        message: `User attempted to access resource requiring roles: ${roles.join(', ')}`,
        userInfo: getUserInfo(req, user),
        details: {
          organizationId: user.organizationId,
          requiredRoles: roles,
          userRole: user.role
        },
        timestamp: new Date()
      });
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Middleware to check if user has specific permission
export const requirePermission = (resource: keyof IPermissions, action: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!user.hasPermission(resource, action)) {
      await SystemLog.create({
        level: 'security',
        category: 'security',
        action: 'unauthorized_permission_access',
        message: `User attempted to access resource requiring permission: ${resource}.${action}`,
        userInfo: getUserInfo(req, user),
        details: {
          organizationId: user.organizationId,
          requiredPermission: `${resource}.${action}`,
          userPermissions: user.permissions[resource]
        },
        timestamp: new Date()
      });
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Middleware to check if user is admin
export const requireAdmin = requireRole(['admin']);

// Middleware to check if user can manage other users
export const requireUserManagement = requirePermission('users', 'create');

// Middleware to ensure user belongs to the same organization as the resource
export const requireSameOrganization = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Extract organization ID from request parameters or body
    const resourceOrgId = req.params.organizationId || req.body.organizationId;

    if (resourceOrgId && resourceOrgId !== user.organizationId._id.toString()) {
      await SystemLog.create({
        level: 'security',
        category: 'security',
        action: 'cross_org_access_attempt',
        message: 'User attempted to access resource from different organization',
        userInfo: getUserInfo(req, user),
        details: {
          organizationId: user.organizationId,
          attemptedOrgId: resourceOrgId
        },
        timestamp: new Date()
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    next();

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authorization error'
    });
  }
};

// Rate limiting middleware
export const rateLimitByUser = (maxRequests: number, windowMs: number) => {
  const userRequests = new Map<string, { count: number; resetTime: number }>();

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?._id?.toString() || req.ip || 'anonymous';
    const now = Date.now();

    const userRequest = userRequests.get(userId);

    if (!userRequest || now > userRequest.resetTime) {
      userRequests.set(userId, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (userRequest.count >= maxRequests) {
      await SystemLog.create({
        level: 'security',
        category: 'security',
        action: 'rate_limit_exceeded',
        message: 'User exceeded rate limit',
        userInfo: getUserInfo(req, req.user),
        details: {
          organizationId: req.user?.organizationId,
          requestCount: userRequest.count,
          maxRequests
        },
        timestamp: new Date()
      });
      return res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later'
      });
    }

    userRequest.count++;
    next();
  };
};

export default {
  authenticate,
  authenticateCandidate,
  requireRole,
  requirePermission,
  requireAdmin,
  requireUserManagement,
  requireSameOrganization,
  rateLimitByUser
};