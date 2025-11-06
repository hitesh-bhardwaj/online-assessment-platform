import { Router } from 'express';
import authController from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validateRequest, commonSchemas } from '../middleware/validation';

const router = Router();

// Validation schemas
const loginSchema = {
  body: {
    email: {
      isEmail: true,
      normalizeEmail: true,
      errorMessage: 'Valid email is required'
    },
    password: {
      isLength: { options: { min: 1 } },
      errorMessage: 'Password is required'
    },
    organizationDomain: {
      optional: true,
      isLength: { options: { min: 2, max: 100 } },
      errorMessage: 'Organization domain must be between 2 and 100 characters'
    }
  }
};

const refreshTokenSchema = {
  body: {
    refreshToken: {
      isLength: { options: { min: 1 } },
      errorMessage: 'Refresh token is required'
    }
  }
};

const updateProfileSchema = {
  body: {
    firstName: {
      optional: true,
      isLength: { options: { min: 1, max: 50 } },
      trim: true,
      errorMessage: 'First name must be between 1 and 50 characters'
    },
    lastName: {
      optional: true,
      isLength: { options: { min: 1, max: 50 } },
      trim: true,
      errorMessage: 'Last name must be between 1 and 50 characters'
    }
  }
};

const changePasswordSchema = {
  body: {
    currentPassword: {
      isLength: { options: { min: 1 } },
      errorMessage: 'Current password is required'
    },
    newPassword: {
      isLength: { options: { min: 8, max: 128 } },
      matches: {
        options: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        errorMessage: 'New password must contain at least one lowercase letter, one uppercase letter, and one number'
      },
      errorMessage: 'New password must be between 8 and 128 characters'
    }
  }
};

const candidateAuthSchema = {
  body: {
    token: {
      isLength: { options: { min: 1 } },
      errorMessage: 'Invitation token is required'
    }
  }
};

const requestOtpSchema = {
  body: {
    email: {
      ...commonSchemas.email,
      errorMessage: 'Email is required'
    }
  }
};

const forgotPasswordSchema = {
  body: {
    email: {
      ...commonSchemas.email,
      errorMessage: 'Email is required'
    }
  }
};

const verifyResetTokenSchema = {
  body: {
    token: {
      isLength: { options: { min: 1 } },
      errorMessage: 'Reset token is required'
    }
  }
};

const resetPasswordSchema = {
  body: {
    token: {
      isLength: { options: { min: 1 } },
      errorMessage: 'Reset token is required'
    },
    newPassword: {
      isLength: { options: { min: 8, max: 128 } },
      matches: {
        options: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        errorMessage: 'New password must contain at least one lowercase letter, one uppercase letter, and one number'
      },
      errorMessage: 'New password must be between 8 and 128 characters'
    }
  }
};

const verifyOtpSchema = {
  body: {
    email: {
      ...commonSchemas.email,
      errorMessage: 'Email is required'
    },
    code: {
      isLength: { options: { min: 6, max: 6 } },
      trim: true,
      errorMessage: 'Code must be a 6-digit value'
    },
    organizationDomain: {
      optional: true,
      isLength: { options: { min: 2, max: 100 } },
      trim: true,
      errorMessage: 'Domain must be between 2 and 100 characters'
    }
  }
};

// Authentication routes
/**
 * @route   POST /api/auth/login
 * @desc    Login user with email and password
 * @access  Public
 */
router.post('/login', validateRequest(loginSchema), authController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', validateRequest(refreshTokenSchema), authController.refreshToken);

/**
 * @route   POST /api/auth/request-otp
 * @desc    Send a one-time code to the user's email
 * @access  Public
 */
router.post('/request-otp', validateRequest(requestOtpSchema), authController.requestOtp);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify OTP and exchange for access tokens
 * @access  Public
 */
router.post('/verify-otp', validateRequest(verifyOtpSchema), authController.verifyOtp);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate tokens
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   POST /api/auth/logout-all-devices
 * @desc    Logout user from all devices and revoke all refresh tokens
 * @access  Private
 */
router.post('/logout-all-devices', authenticate, authController.logoutAllDevices);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email with token
 * @access  Public
 */
router.post('/verify-email', authController.verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification link
 * @access  Private
 */
router.post('/resend-verification', authenticate, authController.resendVerification);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate, authController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticate, validateRequest(updateProfileSchema), authController.updateProfile);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password', authenticate, validateRequest(changePasswordSchema), authController.changePassword);

/**
 * @route   POST /api/auth/candidate
 * @desc    Authenticate candidate with invitation token
 * @access  Public
 */
router.post('/candidate', validateRequest(candidateAuthSchema), authController.candidateAuth);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
router.post('/forgot-password', validateRequest(forgotPasswordSchema), authController.forgotPassword);

/**
 * @route   POST /api/auth/verify-reset-token
 * @desc    Verify password reset token is valid
 * @access  Public
 */
router.post('/verify-reset-token', validateRequest(verifyResetTokenSchema), authController.verifyResetToken);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', validateRequest(resetPasswordSchema), authController.resetPassword);

export default router;
