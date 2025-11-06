import { Request, Response } from 'express';
import { Organization, SystemLog } from '../models';
import { IOrganizationDocument, IOrganization } from '../models/Organization';
import { IUserInfo } from '../models/SystemLog';
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

export const organizationController = {
  // Get organization details
  async getOrganization(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const organizationId = toObjectId(user.organizationId);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier'
        });
      }

      const organization = await Organization.findById(organizationId).exec();

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      res.json({
        success: true,
        data: organization
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'get_organization_error',
        message: 'Error retrieving organization',
        error,
        extra: {
          handler: 'organizationController.getOrganization'
        }
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Update organization details (admin only)
  async updateOrganization(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const {
        name,
        domain,
        contactEmail,
        branding,
        settings
      }: {
        name?: string;
        domain?: string;
        contactEmail?: string;
        branding?: Partial<IOrganizationDocument['branding']>;
        settings?: Partial<IOrganizationDocument['settings']>;
      } = req.body;

      const organizationId = toObjectId(user.organizationId);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier'
        });
      }

      const organization = await Organization.findById(organizationId).exec();

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      // Track changes for audit
      const changes: Record<string, { from: unknown; to: unknown }> = {};

      if (name && name !== organization.name) {
        changes.name = { from: organization.name, to: name };
        organization.name = name;
      }

      if (domain && domain !== organization.domain) {
        // Check if domain is already taken
        const existingOrg = await Organization.findOne({
          domain: domain.toLowerCase(),
          _id: { $ne: organization._id }
        });

        if (existingOrg) {
          return res.status(400).json({
            success: false,
            message: 'Domain is already taken by another organization'
          });
        }

        changes.domain = { from: organization.domain, to: domain };
        organization.domain = domain.toLowerCase();
      }

      if (contactEmail && contactEmail !== organization.contactEmail) {
        changes.contactEmail = { from: organization.contactEmail, to: contactEmail };
        organization.contactEmail = contactEmail;
      }

      if (branding) {
        if (branding.logoUrl !== undefined) {
          changes.logoUrl = { from: organization.branding.logoUrl, to: branding.logoUrl };
          organization.branding.logoUrl = branding.logoUrl;
        }
        if (branding.primaryColor !== undefined) {
          changes.primaryColor = { from: organization.branding.primaryColor, to: branding.primaryColor };
          organization.branding.primaryColor = branding.primaryColor;
        }
        if (branding.secondaryColor !== undefined) {
          changes.secondaryColor = { from: organization.branding.secondaryColor, to: branding.secondaryColor };
          organization.branding.secondaryColor = branding.secondaryColor;
        }
        if (branding.emailTemplates) {
          organization.branding.emailTemplates = {
            ...(organization.branding.emailTemplates ?? {}),
            ...branding.emailTemplates
          };
          changes.emailTemplates = {
            from: organization.branding.emailTemplates,
            to: organization.branding.emailTemplates
          };
        }
      }

      if (settings) {
        if (settings.dataRetentionDays !== undefined) {
          changes.dataRetentionDays = { from: organization.settings.dataRetentionDays, to: settings.dataRetentionDays };
          organization.settings.dataRetentionDays = settings.dataRetentionDays;
        }
        if (settings.gdprCompliant !== undefined) {
          changes.gdprCompliant = { from: organization.settings.gdprCompliant, to: settings.gdprCompliant };
          organization.settings.gdprCompliant = settings.gdprCompliant;
        }
        if (settings.allowCandidateDataDownload !== undefined) {
          changes.allowCandidateDataDownload = { from: organization.settings.allowCandidateDataDownload, to: settings.allowCandidateDataDownload };
          organization.settings.allowCandidateDataDownload = settings.allowCandidateDataDownload;
        }
        if (settings.requireProctoringConsent !== undefined) {
          changes.requireProctoringConsent = { from: organization.settings.requireProctoringConsent, to: settings.requireProctoringConsent };
          organization.settings.requireProctoringConsent = settings.requireProctoringConsent;
        }
        if (settings.defaultAssessmentSettings) {
          organization.settings.defaultAssessmentSettings = {
            ...(organization.settings.defaultAssessmentSettings ?? {}),
            ...settings.defaultAssessmentSettings
          };
          changes.defaultAssessmentSettings = {
            from: organization.settings.defaultAssessmentSettings,
            to: organization.settings.defaultAssessmentSettings
          };
        }
      }

      await organization.save();

      // Log the update
      await SystemLog.logAuth('organization_update', getUserInfo(req), {
        organizationId
      }, { changes });

      res.json({
        success: true,
        message: 'Organization updated successfully',
        data: organization
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'update_organization_error',
        message: 'Error updating organization',
        error,
        extra: {
          handler: 'organizationController.updateOrganization'
        }
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Get organization subscription details
  async getSubscription(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const organizationId = toObjectId(user.organizationId);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier'
        });
      }

      const organization = await Organization.findById(organizationId).exec();

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      res.json({
        success: true,
        data: {
          subscription: organization.subscription,
          subscriptionStatus: organization.subscriptionStatus,
          features: organization.subscription.features
        }
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'get_subscription_error',
        message: 'Error retrieving subscription details',
        error,
        extra: {
          handler: 'organizationController.getSubscription'
        }
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Check if organization has specific feature
  async checkFeature(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      const { feature } = req.params;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const organization = await Organization.findById(user.organizationId).exec();

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      const hasFeature = organization.hasFeature(feature);

      res.json({
        success: true,
        data: {
          feature,
          available: hasFeature
        }
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'check_feature_error',
        message: 'Error checking feature availability',
        error,
        extra: {
          handler: 'organizationController.checkFeature'
        }
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Get organization usage statistics (admin only)
  async getUsageStats(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const organizationId = toObjectId(user.organizationId);

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization identifier'
        });
      }

      // Get usage statistics from different models
      const {
        Assessment,
        User: UserModel,
        Invitation,
        AssessmentResult
      } = await import('../models');

      const assessmentIds = await Assessment.find({ organizationId, isActive: true }, '_id').lean();
      const assessmentIdList = assessmentIds.map((doc) => doc._id);

      const [assessmentCount, userCount, invitationCount, resultCount] = await Promise.all([
        Assessment.countDocuments({ organizationId, isActive: true }),
        UserModel.countDocuments({ organizationId, isActive: true }),
        Invitation.countDocuments({ assessmentId: { $in: assessmentIdList } }),
        AssessmentResult.countDocuments({
          invitationId: {
            $in: await Invitation.find({ assessmentId: { $in: assessmentIdList } }, '_id')
          }
        })
      ]);

      // Get current month statistics
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      const monthlyInvitations = await Invitation.countDocuments({
        assessmentId: { $in: assessmentIdList },
        createdAt: { $gte: currentMonth }
      });

      const organizationDetails = await Organization.findById(organizationId).select('subscription').lean<IOrganization>();

      res.json({
        success: true,
        data: {
          assessments: assessmentCount,
          users: userCount,
          invitations: invitationCount,
          results: resultCount,
          currentMonthInvitations: monthlyInvitations,
          subscription: {
            plan: organizationDetails?.subscription.plan,
            features: organizationDetails?.subscription.features,
            limits: {
              maxAssessments: organizationDetails?.subscription.maxAssessments,
              maxCandidatesPerMonth: organizationDetails?.subscription.maxCandidatesPerMonth
            }
          }
        }
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'get_usage_stats_error',
        message: 'Error retrieving usage statistics',
        error,
        extra: {
          handler: 'organizationController.getUsageStats'
        }
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Create new organization (system admin only - placeholder)
  async createOrganization(req: Request, res: Response) {
    try {
      const {
        name,
        domain,
        contactEmail,
        subscriptionPlan = 'free',
        adminUser
      } = req.body;

      // Check if domain is already taken
      if (domain) {
        const existingOrg = await Organization.findOne({
          domain: domain.toLowerCase()
        });

        if (existingOrg) {
          return res.status(400).json({
            success: false,
            message: 'Domain is already taken'
          });
        }
      }

      // Create organization
      const organization = new Organization({
        name,
        domain: domain?.toLowerCase(),
        contactEmail,
        subscription: {
          plan: subscriptionPlan,
          startDate: new Date(),
          features: subscriptionPlan === 'free'
            ? ['basic_assessments', 'email_invitations']
            : ['basic_assessments', 'email_invitations', 'proctoring', 'analytics']
        }
      });

      await organization.save();

      // Create admin user if provided
      let adminUserData = null;
      if (adminUser) {
        const { User } = await import('../models');
        const newAdmin = new User({
          organizationId: organization._id,
          email: adminUser.email,
          password: adminUser.password,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          role: 'admin'
        });

        await newAdmin.save();
        const adminUserId = toObjectIdString(newAdmin._id);
        if (!adminUserId) {
          throw new Error('Failed to resolve administrator identifier');
        }

        adminUserData = {
          id: adminUserId,
          email: newAdmin.email,
          firstName: newAdmin.firstName,
          lastName: newAdmin.lastName
        };
      }

      const createdOrganizationId = toObjectId(organization._id);

      await SystemLog.logAuth('organization_create', getUserInfo(req), {
        organizationId: createdOrganizationId
      }, {
        name,
        domain
      });

      res.status(201).json({
        success: true,
        message: 'Organization created successfully',
        data: {
          organization: organization.toObject(),
          adminUser: adminUserData
        }
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'system',
        action: 'create_organization_error',
        message: 'Error creating organization',
        error,
        extra: {
          handler: 'organizationController.createOrganization'
        }
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
};

export default organizationController;
