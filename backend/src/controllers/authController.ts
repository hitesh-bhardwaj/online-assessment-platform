import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User, Organization, SystemLog, RefreshToken } from '../models';
import { IUser } from '../models/User';
import crypto from 'crypto';
import { sendLoginOtpEmail } from '../utils/email';
import logControllerError from '../utils/logger';

interface AuthRequest extends Request {
  user?: IUser;
  organization?: any;
}

type PopulatedOrganization = {
  _id: mongoose.Types.ObjectId | string;
  name: string;
  domain: string;
  isActive: boolean;
};

export interface JWTPayload {
  userId: string;
  organizationId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_TOKEN_EXPIRES_DAYS = 7;
const REFRESH_TOKEN_EXPIRES_MS = REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
const LOGIN_OTP_TTL_MS = Number(process.env.LOGIN_OTP_TTL_MS ?? 1000 * 60 * 5);
const LOGIN_OTP_MAX_ATTEMPTS = Number(process.env.LOGIN_OTP_MAX_ATTEMPTS ?? 5);

const signOptions: SignOptions = { expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'] };

const toObjectIdString = (value: unknown): string => {
  if (value instanceof mongoose.Types.ObjectId) {
    return value.toHexString();
  }
  if (typeof value === 'string') {
    return value;
  }
  throw new Error('Expected ObjectId or string value');
};

const toOptionalObjectId = (value: unknown): mongoose.Types.ObjectId | undefined => {
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return undefined;
};

const resolveObjectId = (value: unknown): mongoose.Types.ObjectId | undefined => {
  if (!value) return undefined;
  if (value instanceof mongoose.Types.ObjectId || typeof value === 'string') {
    return toOptionalObjectId(value);
  }
  if (typeof value === 'object' && '_id' in (value as Record<string, unknown>)) {
    return toOptionalObjectId((value as { _id?: unknown })._id);
  }
  return undefined;
};

const resolveOrganizationId = (organization: unknown): mongoose.Types.ObjectId | undefined => {
  return resolveObjectId(organization);
};

const isPopulatedOrganization = (organization: unknown): organization is PopulatedOrganization => {
  return !!organization && typeof organization === 'object' &&
    'name' in organization && 'domain' in organization && '_id' in organization && 'isActive' in organization;
};

// Helper function to generate JWT token
const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, JWT_SECRET, signOptions);
};

// Helper function to generate refresh token
const generateRefreshToken = (): string => {
  return crypto.randomBytes(40).toString('hex');
};

const generateOtpCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const hashOtpCode = (code: string): string => {
  return crypto.createHash('sha256').update(code).digest('hex');
};

// Helper function to get user info for logging
const getUserInfo = (req: Request, user?: IUser) => ({
  userId: user?._id instanceof mongoose.Types.ObjectId ? user._id : undefined,
  email: user?.email,
  role: user?.role,
  ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
  userAgent: req.get('User-Agent') || 'unknown'
});

const sendAuthSuccessResponse = async ({
  req,
  res,
  user,
  userOrg,
  organizationObjectId,
  action = 'login_success',
  message = 'Login successful'
}: {
  req: Request;
  res: Response;
  user: IUser;
  userOrg: PopulatedOrganization;
  organizationObjectId: mongoose.Types.ObjectId;
  action?: 'login_success' | 'otp_login_success';
  message?: string;
}) => {
  const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId: toObjectIdString(user._id),
    organizationId: toObjectIdString(organizationObjectId),
    email: user.email,
    role: user.role
  };

  const token = generateToken(tokenPayload);
  const refreshTokenValue = generateRefreshToken();

  // Save refresh token to database
  const refreshTokenDoc = new RefreshToken({
    token: refreshTokenValue,
    userId: user._id,
    organizationId: organizationObjectId,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS),
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent')
  });
  await refreshTokenDoc.save();

  user.lastLogin = new Date();
  await user.save();

  await SystemLog.logAuth(action, getUserInfo(req, user), {
    organizationId: organizationObjectId
  });

  res.json({
    success: true,
    message,
    data: {
      token,
      refreshToken: refreshTokenValue,
      user: {
        id: toObjectIdString(user._id),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permissions: user.permissions,
        organization: {
          id: toObjectIdString(organizationObjectId),
          name: userOrg.name,
          domain: userOrg.domain
        }
      },
      expiresIn: JWT_EXPIRES_IN
    }
  });
};

export const authController = {
  // Login endpoint
  async login(req: Request, res: Response) {
    try {
      const { email, password, organizationDomain } = req.body;

      // Validate required fields
      if (!email || !password) {
        await SystemLog.logAuth('login_failed', getUserInfo(req), {}, { reason: 'missing_credentials' });
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Find organization if domain provided
      let organization = null;
      if (organizationDomain) {
        organization = await Organization.findOne({
          domain: organizationDomain.toLowerCase(),
          isActive: true
        });

        if (!organization) {
        await SystemLog.logAuth('login_failed', getUserInfo(req), {}, { reason: 'invalid_organization' });
          return res.status(400).json({
            success: false,
            message: 'Organization not found'
          });
        }
      }

      // Find user
      const query: any = { email: email.toLowerCase(), isActive: true };
      if (organization) {
        query.organizationId = organization._id;
      }

      const user = await User.findOne(query).select('+password').populate('organizationId', 'name domain isActive');

      if (!user) {
        await SystemLog.logAuth('login_failed', getUserInfo(req), {}, { reason: 'user_not_found', email });
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if organization is populated and active
      if (!user.organizationId) {
        console.error('User organizationId is null for user:', user.email);
        await SystemLog.logAuth('login_failed', getUserInfo(req, user), {}, { reason: 'organization_not_populated' });
        return res.status(401).json({
          success: false,
          message: 'Organization not found'
        });
      }

      if (!isPopulatedOrganization(user.organizationId)) {
        await SystemLog.logAuth('login_failed', getUserInfo(req, user), {}, { reason: 'organization_not_populated' });
        return res.status(401).json({
          success: false,
          message: 'Organization not found'
        });
      }

      const userOrg = user.organizationId;
      const organizationObjectId = resolveOrganizationId(userOrg);

      if (!organizationObjectId) {
        await SystemLog.logAuth('login_failed', getUserInfo(req, user), {}, { reason: 'organization_missing_id' });
        return res.status(401).json({
          success: false,
          message: 'Organization not found'
        });
      }

      if (!userOrg.isActive) {
        await SystemLog.logAuth('login_failed', getUserInfo(req, user), { organizationId: organizationObjectId }, { reason: 'organization_inactive' });
        return res.status(401).json({
          success: false,
          message: 'Organization is not active'
        });
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        await SystemLog.logAuth('login_failed', getUserInfo(req, user), { organizationId: organizationObjectId }, { reason: 'invalid_password' });
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      await sendAuthSuccessResponse({
        req,
        res,
        user,
        userOrg,
        organizationObjectId,
        action: 'login_success',
        message: 'Login successful'
      });

    } catch (error) {
      await SystemLog.logAuth('login_error', getUserInfo(req), {}, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Refresh token endpoint
  async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken: refreshTokenValue } = req.body;

      if (!refreshTokenValue) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      // Find refresh token in database
      const refreshTokenDoc = await RefreshToken.findOne({ token: refreshTokenValue });

      if (!refreshTokenDoc) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      // Check if token is valid (not revoked and not expired)
      if (!refreshTokenDoc.isValid()) {
        return res.status(401).json({
          success: false,
          message: refreshTokenDoc.isRevoked ? 'Refresh token has been revoked' : 'Refresh token has expired'
        });
      }

      // Get user data
      const user = await User.findById(refreshTokenDoc.userId).populate('organizationId', 'name domain');

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive'
        });
      }

      if (!isPopulatedOrganization(user.organizationId)) {
        return res.status(401).json({
          success: false,
          message: 'Organization not found'
        });
      }

      const userOrg = user.organizationId;

      // Generate new tokens
      const newTokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
        userId: toObjectIdString(user._id),
        organizationId: toObjectIdString(userOrg._id),
        email: user.email,
        role: user.role
      };

      const newToken = generateToken(newTokenPayload);
      const newRefreshTokenValue = generateRefreshToken();

      // Create new refresh token in database
      const newRefreshTokenDoc = new RefreshToken({
        token: newRefreshTokenValue,
        userId: user._id,
        organizationId: userOrg._id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      });
      await newRefreshTokenDoc.save();

      // Update last used time on old token and optionally revoke it
      refreshTokenDoc.lastUsedAt = new Date();
      await refreshTokenDoc.save();
      // Optionally revoke old token after use (more secure)
      // await refreshTokenDoc.revoke('Replaced with new token');

      await SystemLog.logAuth('token_refresh', getUserInfo(req, user), {
        organizationId: new mongoose.Types.ObjectId(userOrg._id)
      });

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          token: newToken,
          refreshToken: newRefreshTokenValue,
          expiresIn: JWT_EXPIRES_IN
        }
      });

    } catch (error) {
      await SystemLog.logAuth('refresh_error', getUserInfo(req), {}, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  async requestOtp(req: Request, res: Response) {
    try {
      const email = (req.body.email as string | undefined)?.trim().toLowerCase();

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const user = await User.findOne({ email, isActive: true }).populate('organizationId', 'name domain isActive');

      if (!user) {
        return res.status(202).json({
          success: true,
          message: 'If an account exists for this email, we just sent a one-time code.'
        });
      }

      if (!user.organizationId) {
        return res.status(400).json({
          success: false,
          message: 'This account is not linked to an organization. Contact support.'
        });
      }

      if (!isPopulatedOrganization(user.organizationId)) {
        await user.populate('organizationId', 'name domain isActive');
      }

      const org = user.organizationId as PopulatedOrganization;

      if (!isPopulatedOrganization(org) || !org.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Organization is inactive. Please contact your administrator.'
        });
      }

      const code = generateOtpCode();
      const codeHash = hashOtpCode(code);

      user.loginOtp = {
        codeHash,
        expiresAt: new Date(Date.now() + LOGIN_OTP_TTL_MS),
        attempts: 0,
        requestedAt: new Date()
      };

      user.markModified('loginOtp');
      await user.save();

      await sendLoginOtpEmail(email, code);

      await SystemLog.logAuth('otp_requested', getUserInfo(req, user), {
        organizationId: new mongoose.Types.ObjectId(org._id)
      }, {
        expiresAt: user.loginOtp?.expiresAt
      });

      return res.status(202).json({
        success: true,
        message: 'If an account exists for this email, we just sent a one-time code.'
      });
    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'otp_request_error',
        message: 'Error requesting login OTP',
        error,
        extra: {
          handler: 'authController.requestOtp'
        }
      });

      return res.status(500).json({
        success: false,
        message: 'Unable to send a code right now. Please try again later.'
      });
    }
  },

  async verifyOtp(req: Request, res: Response) {
    try {
      const email = (req.body.email as string | undefined)?.trim().toLowerCase();
      const code = (req.body.code as string | undefined)?.trim();
      const organizationDomain = (req.body.organizationDomain as string | undefined)?.trim().toLowerCase();

      if (!email || !code) {
        return res.status(400).json({
          success: false,
          message: 'Email and code are required.'
        });
      }

      let organizationFilter: mongoose.Types.ObjectId | undefined;

      if (organizationDomain) {
        const organization = await Organization.findOne({
          domain: organizationDomain,
          isActive: true
        }).select('_id');

        if (!organization) {
          return res.status(400).json({
            success: false,
            message: 'We could not find an active organization for that domain.'
          });
        }

        organizationFilter = organization._id;
      }

      const userQuery: Record<string, unknown> = {
        email,
        isActive: true
      };

      if (organizationFilter) {
        userQuery.organizationId = organizationFilter;
      }

      const user = await User.findOne(userQuery).populate('organizationId', 'name domain isActive');

      if (!user || !user.loginOtp) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired code.'
        });
      }

      if (!isPopulatedOrganization(user.organizationId)) {
        await user.populate('organizationId', 'name domain isActive');
      }

      const org = user.organizationId as PopulatedOrganization;

      if (!isPopulatedOrganization(org) || !org.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Organization not found or inactive.'
        });
      }

      if (!user.loginOtp.expiresAt || user.loginOtp.expiresAt.getTime() < Date.now()) {
        user.loginOtp = undefined;
        user.markModified('loginOtp');
        await user.save();
        return res.status(410).json({
          success: false,
          message: 'This code has expired. Request a new one to continue.'
        });
      }

      if ((user.loginOtp.attempts ?? 0) >= LOGIN_OTP_MAX_ATTEMPTS) {
        user.loginOtp = undefined;
        user.markModified('loginOtp');
        await user.save();
        return res.status(429).json({
          success: false,
          message: 'Too many incorrect attempts. Request a new code.'
        });
      }

      const hashedInput = hashOtpCode(code);

      if (hashedInput !== user.loginOtp.codeHash) {
        user.loginOtp.attempts = (user.loginOtp.attempts ?? 0) + 1;
        await user.save();

        await SystemLog.logSecurity('otp_invalid', 'Invalid OTP submitted', getUserInfo(req), {
          organizationId: new mongoose.Types.ObjectId(org._id)
        }, {
          attempts: user.loginOtp.attempts
        });

        return res.status(400).json({
          success: false,
          message: 'Invalid or expired code.'
        });
      }

      user.loginOtp = undefined;
      user.markModified('loginOtp');

      await sendAuthSuccessResponse({
        req,
        res,
        user,
        userOrg: org,
        organizationObjectId: new mongoose.Types.ObjectId(org._id),
        action: 'otp_login_success',
        message: 'Login successful'
      });
    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'otp_verify_error',
        message: 'Error verifying login OTP',
        error,
        extra: {
          handler: 'authController.verifyOtp'
        }
      });

      return res.status(500).json({
        success: false,
        message: 'Unable to verify the code right now. Please try again later.'
      });
    }
  },

  // Logout endpoint
  async logout(req: AuthRequest, res: Response) {
    try {
      const user = req.user;
      const { refreshToken: refreshTokenValue } = req.body;

      if (user) {
        const logoutOrgId = resolveOrganizationId(user.organizationId);

        // Revoke the specific refresh token if provided
        if (refreshTokenValue) {
          const refreshTokenDoc = await RefreshToken.findOne({
            token: refreshTokenValue,
            userId: user._id
          });

          if (refreshTokenDoc && !refreshTokenDoc.isRevoked) {
            await refreshTokenDoc.revoke('User logged out');
          }
        }

        await SystemLog.logAuth('logout', getUserInfo(req, user), logoutOrgId ? { organizationId: logoutOrgId } : {});
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Logout from all devices
  async logoutAllDevices(req: AuthRequest, res: Response) {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Revoke all refresh tokens for this user
      const result = await RefreshToken.revokeAllForUser(
        user._id as mongoose.Types.ObjectId,
        'User requested logout from all devices'
      );

      const logoutOrgId = resolveOrganizationId(user.organizationId);
      await SystemLog.logAuth('logout_all_devices', getUserInfo(req, user), logoutOrgId ? { organizationId: logoutOrgId } : {}, {
        tokensRevoked: result.modifiedCount
      });

      res.json({
        success: true,
        message: 'Logged out from all devices successfully',
        data: {
          devicesLoggedOut: result.modifiedCount
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Get current user profile
  async getProfile(req: AuthRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      await user.populate('organizationId', 'name domain branding');

      res.json({
        success: true,
        data: {
          id: toObjectIdString(user._id),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          permissions: user.permissions,
          lastLogin: user.lastLogin,
          organization: user.organizationId
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Update user profile
  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const { firstName, lastName } = req.body;

      if (firstName) user.firstName = firstName.trim();
      if (lastName) user.lastName = lastName.trim();

      await user.save();

      const profileOrgId = resolveOrganizationId(user.organizationId);
      await SystemLog.logAuth('profile_update', getUserInfo(req, user), profileOrgId ? { organizationId: profileOrgId } : {});

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          id: toObjectIdString(user._id),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Change password
  async changePassword(req: AuthRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      // Get user with password
      const userWithPassword = await User.findById(user._id).select('+password');
      if (!userWithPassword) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await userWithPassword.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        const passwordOrgId = resolveOrganizationId(user.organizationId);
        await SystemLog.logSecurity('password_change_failed', 'Invalid current password', getUserInfo(req, user), passwordOrgId ? { organizationId: passwordOrgId } : {});

        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Validate new password strength
      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 8 characters long'
        });
      }

      // Update password
      userWithPassword.password = newPassword;
      await userWithPassword.save();

      const passwordChangeOrgId = resolveOrganizationId(user.organizationId);
      await SystemLog.logAuth('password_change', getUserInfo(req, user), passwordChangeOrgId ? { organizationId: passwordChangeOrgId } : {});

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Verify email with token
  async verifyEmail(req: Request, res: Response) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification token is required'
        });
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        passwordResetToken: tokenHash,
        passwordResetExpires: { $gt: new Date() },
        isActive: true
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token'
        });
      }

      if (user.emailVerified) {
        return res.status(400).json({
          success: false,
          message: 'Email is already verified'
        });
      }

      // Mark email as verified
      user.emailVerified = true;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      const verifyOrgId = resolveOrganizationId(user.organizationId);
      await SystemLog.logAuth('email_verified', getUserInfo(req, user), verifyOrgId ? { organizationId: verifyOrgId } : {});

      return res.status(200).json({
        success: true,
        message: 'Email verified successfully',
        data: {
          email: user.email,
          emailVerified: true
        }
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Unable to verify email'
      });
    }
  },

  // Resend email verification
  async resendVerification(req: AuthRequest, res: Response) {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      if (user.emailVerified) {
        return res.status(400).json({
          success: false,
          message: 'Email is already verified'
        });
      }

      // Generate verification token (reuse password reset for now, or create separate verification token field)
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');

      user.passwordResetToken = verificationTokenHash; // Reusing this field temporarily
      user.passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await user.save();

      // Send verification email
      const { sendEmailVerificationEmail } = await import('../utils/email-password-reset');
      await sendEmailVerificationEmail(user.email, verificationToken);

      const verifyOrgId = resolveOrganizationId(user.organizationId);
      await SystemLog.logAuth('email_verification_resent', getUserInfo(req, user), verifyOrgId ? { organizationId: verifyOrgId } : {});

      return res.status(200).json({
        success: true,
        message: 'Verification email sent successfully'
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Unable to resend verification email'
      });
    }
  },

  // Forgot password - send reset email
  async forgotPassword(req: Request, res: Response) {
    try {
      const email = (req.body.email as string | undefined)?.trim().toLowerCase();

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const user = await User.findOne({ email, isActive: true }).populate('organizationId', 'name domain');

      // Always return success to prevent email enumeration
      if (!user) {
        return res.status(200).json({
          success: true,
          message: 'If an account exists for this email, we sent password reset instructions.'
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

      user.passwordResetToken = resetTokenHash;
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      // Send reset email
      const { sendPasswordResetEmail } = await import('../utils/email-password-reset');
      await sendPasswordResetEmail(email, resetToken);

      const resetOrgId = resolveOrganizationId(user.organizationId);
      await SystemLog.logAuth('password_reset_requested', getUserInfo(req, user), resetOrgId ? { organizationId: resetOrgId } : {});

      return res.status(200).json({
        success: true,
        message: 'If an account exists for this email, we sent password reset instructions.'
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'forgot_password_error',
        message: 'Error processing password reset request',
        error,
        extra: {
          handler: 'authController.forgotPassword'
        }
      });

      return res.status(500).json({
        success: false,
        message: 'Unable to process password reset request. Please try again later.'
      });
    }
  },

  // Verify password reset token
  async verifyResetToken(req: Request, res: Response) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Reset token is required'
        });
      }

      const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        passwordResetToken: resetTokenHash,
        passwordResetExpires: { $gt: new Date() },
        isActive: true
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Token is valid',
        data: {
          email: user.email
        }
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Unable to verify reset token'
      });
    }
  },

  // Reset password with token
  async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Reset token and new password are required'
        });
      }

      // Validate password strength
      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
      }

      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message: 'Password must contain at least one lowercase letter, one uppercase letter, and one number'
        });
      }

      const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        passwordResetToken: resetTokenHash,
        passwordResetExpires: { $gt: new Date() },
        isActive: true
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      // Update password and clear reset token
      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      const resetOrgId = resolveOrganizationId(user.organizationId);
      await SystemLog.logAuth('password_reset_success', getUserInfo(req, user), resetOrgId ? { organizationId: resetOrgId } : {});

      return res.status(200).json({
        success: true,
        message: 'Password reset successful. You can now log in with your new password.'
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'reset_password_error',
        message: 'Error resetting password',
        error,
        extra: {
          handler: 'authController.resetPassword'
        }
      });

      return res.status(500).json({
        success: false,
        message: 'Unable to reset password. Please try again later.'
      });
    }
  },

  // Candidate authentication (for assessment access)
  async candidateAuth(req: Request, res: Response) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Invitation token is required'
        });
      }

      // Find invitation by token
      const { Invitation } = await import('../models');
      const invitation = await Invitation.findByToken(token);

      if (!invitation) {
        await SystemLog.logSecurity('invalid_candidate_token', 'Invalid invitation token used', getUserInfo(req), {}, { token });

        return res.status(401).json({
          success: false,
          message: 'Invalid or expired invitation'
        });
      }

      const invitationObjectId = resolveObjectId(invitation._id);
      if (!invitationObjectId) {
        await SystemLog.logAuth('candidate_auth_error', getUserInfo(req), {}, { reason: 'invitation_missing_id' });
        return res.status(500).json({
          success: false,
          message: 'Invitation data invalid'
        });
      }

      const assessmentObjectId = resolveObjectId(invitation.assessmentId);
      if (!assessmentObjectId) {
        await SystemLog.logAuth('candidate_auth_error', getUserInfo(req), { invitationId: invitationObjectId }, { reason: 'assessment_missing_id' });
        return res.status(500).json({
          success: false,
          message: 'Assessment data invalid'
        });
      }

      // Check if invitation is valid
      if (!invitation.isValid()) {
        await SystemLog.logAuth('candidate_auth_failed', getUserInfo(req), {
          invitationId: invitationObjectId
        }, { reason: 'invitation_invalid' });

        return res.status(401).json({
          success: false,
          message: 'Invitation has expired or is no longer valid'
        });
      }

      // Check if candidate can start
      const canStart = await invitation.canStart();
      if (!canStart) {
        await SystemLog.logAuth('candidate_auth_failed', getUserInfo(req), {
          invitationId: invitationObjectId
        }, { reason: 'no_attempts_left' });

        return res.status(401).json({
          success: false,
          message: 'No attempts remaining for this assessment'
        });
      }

      const assessmentDoc = invitation.assessmentId as any;

      if (!assessmentDoc || typeof assessmentDoc !== 'object') {
        await SystemLog.logAuth('candidate_auth_error', getUserInfo(req), { invitationId: invitationObjectId }, { reason: 'assessment_not_populated' });
        return res.status(500).json({
          success: false,
          message: 'Assessment data unavailable'
        });
      }

      const organizationId = resolveOrganizationId(assessmentDoc.organizationId);
      const organization = organizationId
        ? await Organization.findById(organizationId).select('name domain contactEmail branding settings').lean()
        : null;

      const assessmentSettings = assessmentDoc.settings ?? {};
      const proctoringSettings = assessmentSettings.proctoringSettings ?? {};
      const questionCount = Array.isArray(assessmentDoc.questions) ? assessmentDoc.questions.length : 0;
      const totalPoints = Array.isArray(assessmentDoc.questions)
        ? assessmentDoc.questions.reduce((sum: number, question: any) => {
            const points = typeof question?.points === 'number' ? question.points : 0;
            return sum + points;
          }, 0)
        : 0;

      // Generate candidate session token
      const candidatePayload = {
        invitationId: toObjectIdString(invitationObjectId),
        candidateEmail: invitation.candidate.email,
        assessmentId: toObjectIdString(assessmentObjectId)
      };

      const candidateToken = jwt.sign(candidatePayload, JWT_SECRET, { expiresIn: '4h' });

      await SystemLog.logAuth('candidate_auth_success', getUserInfo(req), {
        invitationId: invitationObjectId,
        assessmentId: assessmentObjectId
      });

      res.json({
        success: true,
        message: 'Authentication successful',
        data: {
          token: candidateToken,
          expiresIn: '4h',
          candidate: {
            firstName: invitation.candidate.firstName,
            lastName: invitation.candidate.lastName,
            email: invitation.candidate.email,
            position: invitation.candidate.position
          },
          session: {
            invitationId: toObjectIdString(invitationObjectId),
            assessmentId: toObjectIdString(assessmentObjectId),
            status: invitation.status,
            validFrom: invitation.validFrom,
            validUntil: invitation.validUntil,
            attemptsUsed: invitation.sessionData?.attemptsUsed ?? 0,
            remindersSent: invitation.remindersSent,
            lastReminderAt: invitation.lastReminderAt
          },
          assessment: {
            id: toObjectIdString(assessmentObjectId),
            title: assessmentDoc.title,
            description: assessmentDoc.description,
            type: assessmentDoc.type,
            instructions: assessmentDoc.instructions,
            questionCount,
            totalPoints,
            settings: {
              timeLimit: assessmentSettings.timeLimit,
              shuffleQuestions: assessmentSettings.shuffleQuestions,
              shuffleOptions: assessmentSettings.shuffleOptions,
              allowReviewAnswers: assessmentSettings.allowReviewAnswers,
              showResultsToCandidate: assessmentSettings.showResultsToCandidate,
              autoSubmitOnTimeUp: assessmentSettings.autoSubmitOnTimeUp,
              passingScore: assessmentSettings.passingScore ?? null,
              attemptsAllowed: assessmentSettings.attemptsAllowed,
              proctoring: {
                enabled: proctoringSettings.enabled ?? false,
                recordScreen: proctoringSettings.recordScreen ?? false,
                recordWebcam: proctoringSettings.recordWebcam ?? false,
                detectTabSwitch: proctoringSettings.detectTabSwitch ?? false,
                detectCopyPaste: proctoringSettings.detectCopyPaste ?? false,
                detectMultipleMonitors: proctoringSettings.detectMultipleMonitors ?? false,
                allowedApps: proctoringSettings.allowedApps ?? [],
                blockedWebsites: proctoringSettings.blockedWebsites ?? []
              }
            }
          },
          organization: organization
            ? {
                id: toObjectIdString(organizationId),
                name: organization.name,
                domain: organization.domain,
                contactEmail: organization.contactEmail,
                branding: organization.branding,
                policies: {
                  dataRetentionDays: organization.settings?.dataRetentionDays,
                  requireProctoringConsent: organization.settings?.requireProctoringConsent,
                  allowCandidateDataDownload: organization.settings?.allowCandidateDataDownload
                }
              }
            : null
        }
      });

    } catch (error) {
      await SystemLog.logAuth('candidate_auth_error', getUserInfo(req), {}, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
};

export default authController;
