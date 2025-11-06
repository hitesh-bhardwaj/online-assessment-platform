import { Request, Response } from 'express';
import crypto from 'crypto';

import { Organization, SystemLog, User, IOrganizationDocument, OrganizationStatus } from '../models';
import type { ISubscription } from '../models/Organization';
import type { IPermissions } from '../models/User';
import logControllerError from '../utils/logger';
import { sendSignupVerificationEmail } from '../utils/email';

const TOKEN_TTL_MS = Number(process.env.SIGNUP_TOKEN_TTL_MS ?? 1000 * 60 * 60 * 24); // default 24h
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';

const PLAN_FEATURES: Record<ISubscription['plan'], string[]> = {
  free: ['basic_assessments', 'email_invitations'],
  basic: ['basic_assessments', 'email_invitations', 'team_management'],
  premium: ['basic_assessments', 'email_invitations', 'team_management', 'advanced_analytics', 'proctoring']
};

const buildVerificationLink = (token: string, email: string) => {
  const base = FRONTEND_URL.replace(/\/$/, '');
  const params = new URLSearchParams({ token, email });
  return `${base}/signup?${params.toString()}`;
};

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const generateTokenPayload = () => {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS)
  };
};

const getRequestIp = (req: Request) => req.ip || req.connection.remoteAddress || 'unknown';

const buildUserInfo = (req: Request, email?: string) => ({
  userId: undefined,
  email,
  role: 'guest',
  ipAddress: getRequestIp(req),
  userAgent: req.get('User-Agent') || 'unknown'
});

const ensurePendingOrganization = async (email: string, tokenHash: string, expiresAt: Date): Promise<IOrganizationDocument> => {
  const existingOrganization = await Organization.findOne({
    $or: [
      { 'signup.email': email },
      { contactEmail: email }
    ]
  });

  if (existingOrganization) {
    if (existingOrganization.status !== 'pending') {
      throw new Error('Organization already active');
    }

    existingOrganization.isActive = false;
    existingOrganization.status = 'pending' as OrganizationStatus;
    existingOrganization.signup = {
      ...(existingOrganization.signup ?? {}),
      email,
      tokenHash,
      expiresAt,
      source: existingOrganization.signup?.source ?? 'self_service',
      invitedBy: existingOrganization.signup?.invitedBy,
      createdAt: new Date(),
      completedAt: undefined
    };

    await existingOrganization.save();
    return existingOrganization;
  }

  const pendingOrg = new Organization({
    name: 'Pending Organization',
    contactEmail: email,
    domain: undefined,
    branding: {},
    subscription: {
      plan: 'free',
      startDate: new Date(),
      features: PLAN_FEATURES.free
    },
    settings: {},
    isActive: false,
    status: 'pending' as OrganizationStatus,
    signup: {
      email,
      tokenHash,
      expiresAt,
      source: 'self_service',
      createdAt: new Date()
    }
  });

  await pendingOrg.save();
  return pendingOrg;
};

const signupController = {
  async requestLink(req: Request, res: Response) {
    try {
      const email = (req.body.email as string).trim().toLowerCase();

      const existingUser = await User.findOne({ email }).lean();
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists. Please log in or contact your administrator.'
        });
      }

      const { token, tokenHash, expiresAt } = generateTokenPayload();
      let organization: IOrganizationDocument;

      try {
        organization = await ensurePendingOrganization(email, tokenHash, expiresAt);
      } catch (orgError) {
        if ((orgError as Error).message === 'Organization already active') {
          return res.status(409).json({
            success: false,
            message: 'This organization is already active. Try logging in or requesting access from your admin.'
          });
        }
        throw orgError;
      }

      const verificationLink = buildVerificationLink(token, email);

      await sendSignupVerificationEmail(email, verificationLink);

      if (!process.env.RESEND_API_KEY || process.env.NODE_ENV !== 'production') {
        console.log(`Signup verification link for ${email}: ${verificationLink}`);
      }

      await SystemLog.create({
        level: 'info',
        category: 'auth',
        action: 'signup_link_requested',
        message: 'Signup verification link requested',
        userInfo: buildUserInfo(req, email),
        context: {
          organizationId: organization._id
        },
        details: {
          expiresAt
        },
        timestamp: new Date()
      });

      return res.status(202).json({
        success: true,
        message: 'Verification link sent. Please check your email to continue signup.',
        ...(process.env.NODE_ENV !== 'production' ? { verificationLink } : {})
      });
    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'signup_request_link_error',
        message: 'Error requesting signup link',
        error,
        extra: {
          handler: 'signupController.requestLink'
        }
      });

      return res.status(500).json({
        success: false,
        message: 'Unable to process signup request right now. Please try again later.'
      });
    }
  },

  async complete(req: Request, res: Response) {
    try {
      const {
        token,
        organizationName,
        domain,
        plan = 'free',
        admin
      }: {
        token: string;
        organizationName: string;
        domain?: string;
        plan?: ISubscription['plan'];
        admin?: {
          firstName?: string;
          lastName?: string;
          password?: string;
        };
      } = req.body;

      const normalizedToken = token?.trim();
      if (!normalizedToken) {
        return res.status(400).json({ success: false, message: 'Verification token is required.' });
      }

      const tokenHash = hashToken(normalizedToken);
      const organization = await Organization.findOne({ 'signup.tokenHash': tokenHash });

      if (!organization || organization.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Invalid or expired verification token.' });
      }

      if (organization.signup?.expiresAt && organization.signup.expiresAt.getTime() < Date.now()) {
        return res.status(410).json({ success: false, message: 'Verification link has expired. Please request a new link.' });
      }

      const adminEmail = (organization.signup?.email ?? '').trim().toLowerCase();

      if (!adminEmail) {
        return res.status(400).json({ success: false, message: 'This signup link is missing an email address. Please request a new link.' });
      }

      const existingUser = await User.findOne({ email: adminEmail }).lean();
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists. Please log in instead.'
        });
      }

      if (!admin?.password) {
        return res.status(400).json({ success: false, message: 'Please provide a password to complete your account.' });
      }

      const selectedPlan: ISubscription['plan'] = ['free', 'basic', 'premium'].includes(plan) ? plan : 'free';
      organization.name = organizationName.trim();
      organization.contactEmail = organization.signup?.email ?? adminEmail;
      organization.domain = domain?.trim().toLowerCase() || organization.domain;
      organization.isActive = true;
      organization.status = 'active';
      organization.subscription = {
        plan: selectedPlan,
        startDate: new Date(),
        features: PLAN_FEATURES[selectedPlan],
        endDate: undefined,
        maxAssessments: organization.subscription?.maxAssessments,
        maxCandidatesPerMonth: organization.subscription?.maxCandidatesPerMonth
      };
      organization.signup = {
        ...(organization.signup ?? {}),
        tokenHash: undefined,
        expiresAt: undefined,
        completedAt: new Date()
      };

      const cleanedFirstName = admin?.firstName?.trim();
      const cleanedLastName = admin?.lastName?.trim();

      const derivedNames = (() => {
        const localPart = adminEmail.split('@')[0] ?? 'Admin';
        const segments = localPart
          .split(/[-_.\s]+/)
          .filter(Boolean)
          .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase());
        return {
          first: segments[0] ?? 'Admin',
          last: segments.length > 1 ? segments.slice(1).join(' ') : 'Owner'
        };
      })();

      const adminUser = new User({
        organizationId: organization._id,
        email: adminEmail,
        password: admin.password,
        firstName: cleanedFirstName || derivedNames.first,
        lastName: cleanedLastName || derivedNames.last,
        role: 'admin',
        permissions: {} as IPermissions,
        isActive: true,
        emailVerified: true,
        invitedAt: new Date(),
        lastLogin: undefined
      });

      await organization.save();
      await adminUser.save();

      await SystemLog.create({
        level: 'info',
        category: 'auth',
        action: 'signup_completed',
        message: 'Organization signup completed',
        userInfo: buildUserInfo(req, adminEmail),
        context: {
          organizationId: organization._id
        },
        timestamp: new Date()
      });

      return res.status(201).json({
        success: true,
        message: 'Organization setup complete. You can now log in with your credentials.'
      });
    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'signup_complete_error',
        message: 'Error completing signup',
        error,
        extra: {
          handler: 'signupController.complete'
        }
      });

      return res.status(500).json({
        success: false,
        message: 'Unable to complete signup right now. Please try again later.'
      });
    }
  }
};

export default signupController;
