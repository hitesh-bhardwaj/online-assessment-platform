import { Response } from 'express';
import { Invitation, Assessment, SystemLog, Organization } from '../models';
import { AuthenticatedRequest } from '../middleware/auth';
import logControllerError from '../utils/logger';
import { sendCandidateInvitationEmail } from '../utils/email';

const buildCandidateInvitationUrl = (token: string, organizationDomain?: string | null) => {
  const configuredBase = process.env.CANDIDATE_PORTAL_URL?.trim();
  let base = configuredBase;

  if (!base && organizationDomain) {
    const trimmedDomain = organizationDomain.trim();
    base = trimmedDomain.startsWith('http://') || trimmedDomain.startsWith('https://')
      ? trimmedDomain
      : `https://${trimmedDomain}`;
  }

  if (!base) {
    base = process.env.FRONTEND_URL?.trim() || 'http://localhost:3000';
  }

  const normalizedBase = base.replace(/\/+$/, '');
  return `${normalizedBase}/candidate/invitations/${encodeURIComponent(token)}`;
};

// Helper function to get user info for logging
const getUserInfo = (req: AuthenticatedRequest) => ({
  userId: req.user?._id,
  email: req.user?.email,
  role: req.user?.role,
  ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
  userAgent: req.get('User-Agent') || 'unknown'
});

export const invitationController = {
  // Get all invitations for organization
  async getInvitations(req: AuthenticatedRequest, res: Response) {
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
        status,
        assessmentId,
        search
      } = req.query;

      // Get assessments for the organization to filter invitations
      const organizationAssessments = await Assessment.find({
        organizationId: user.organizationId,
        isActive: true
      }).select('_id');

      const assessmentIds = organizationAssessments.map(a => a._id);

      // Build query
      const query: any = {
        assessmentId: { $in: assessmentIds }
      };

      if (status) query.status = status;
      if (assessmentId) query.assessmentId = assessmentId;
      if (search) {
        query.$or = [
          { 'candidate.firstName': { $regex: search, $options: 'i' } },
          { 'candidate.lastName': { $regex: search, $options: 'i' } },
          { 'candidate.email': { $regex: search, $options: 'i' } }
        ];
      }

      const invitations = await Invitation.find(query)
        .populate('assessmentId', 'title type')
        .populate('createdBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(Number(limit) * 1)
        .skip((Number(page) - 1) * Number(limit));

      const total = await Invitation.countDocuments(query);

      res.json({
        success: true,
        data: {
          invitations,
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
        category: 'invitation',
        action: 'get_invitations_error',
        message: 'Error retrieving invitations',
        error,
        extra: {
          handler: 'invitationController.getInvitations'
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Get invitation by ID
  async getInvitationById(req: AuthenticatedRequest, res: Response) {
    try {
      const { invitationId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const invitation = await Invitation.findById(invitationId)
        .populate({
          path: 'assessmentId',
          match: { organizationId: user.organizationId }
        })
        .populate('createdBy', 'firstName lastName email');

      if (!invitation || !invitation.assessmentId) {
        return res.status(404).json({
          success: false,
          message: 'Invitation not found'
        });
      }

      res.json({
        success: true,
        data: invitation
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'invitation',
        action: 'get_invitation_error',
        message: 'Error retrieving invitation',
        error,
        extra: {
          handler: 'invitationController.getInvitationById',
          requestedInvitationId: req.params.invitationId
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Create new invitation
  async createInvitation(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const {
        assessmentId,
        candidate,
        validFrom,
        validUntil,
        customMessage
      } = req.body;

      // Verify assessment belongs to organization and is published
      const assessment = await Assessment.findOne({
        _id: assessmentId,
        organizationId: user.organizationId,
        isActive: true,
        isPublished: true
      });

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found or not published'
        });
      }

      // Check if invitation already exists for this candidate and assessment
      const existingInvitation = await Invitation.findOne({
        assessmentId,
        'candidate.email': candidate.email.toLowerCase(),
        status: { $ne: 'cancelled' }
      });

      if (existingInvitation) {
        return res.status(400).json({
          success: false,
          message: 'Invitation already exists for this candidate and assessment'
        });
      }

      const organization = user.organizationId
        ? await Organization.findById(user.organizationId).select('name domain').lean()
        : null;

      // Create invitation
      const invitation = new Invitation({
        assessmentId,
        candidate: {
          firstName: candidate.firstName.trim(),
          lastName: candidate.lastName.trim(),
          email: candidate.email.toLowerCase().trim(),
          phone: candidate.phone?.trim(),
          resumeUrl: candidate.resumeUrl?.trim(),
          position: candidate.position?.trim()
        },
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: new Date(validUntil),
        customMessage: customMessage?.trim(),
        createdBy: user._id
      });

      await invitation.save();

      // Log invitation creation
      await SystemLog.create({
        level: 'info',
        category: 'invitation',
        action: 'invitation_create',
        message: 'Invitation created',
        details: {
          invitationId: invitation._id,
          assessmentId,
          candidateEmail: candidate.email
        },
        context: {
          organizationId: user.organizationId,
          invitationId: invitation._id,
          assessmentId
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      // TODO: Send invitation email
      // This would typically integrate with an email service

      // Populate the created invitation
      const populatedInvitation = await Invitation.findById(invitation._id)
        .populate('assessmentId', 'title type settings')
        .populate('createdBy', 'firstName lastName email');

      const candidateName = [invitation.candidate.firstName, invitation.candidate.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();

      const invitationUrl = buildCandidateInvitationUrl(invitation.token, organization?.domain);

      await sendCandidateInvitationEmail({
        to: invitation.candidate.email,
        candidateName: candidateName || undefined,
        assessmentTitle: assessment.title,
        invitationUrl,
        expiresAt: invitation.validUntil,
        organizationName: organization?.name || 'Online Assessment Platform',
        customMessage: invitation.customMessage,
      });

      res.status(201).json({
        success: true,
        message: 'Invitation created successfully',
        data: populatedInvitation
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'invitation',
        action: 'create_invitation_error',
        message: 'Error creating invitation',
        error,
        extra: {
          handler: 'invitationController.createInvitation',
          assessmentId: req.body?.assessmentId
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Bulk create invitations
  async bulkCreateInvitations(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const {
        assessmentId,
        candidates,
        validFrom,
        validUntil,
        customMessage
      } = req.body;

      // Verify assessment
      const assessment = await Assessment.findOne({
        _id: assessmentId,
        organizationId: user.organizationId,
        isActive: true,
        isPublished: true
      });

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found or not published'
        });
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as any[],
        invitations: [] as any[]
      };

      for (let i = 0; i < candidates.length; i++) {
        try {
          const candidate = candidates[i];

          // Check for existing invitation
          const existingInvitation = await Invitation.findOne({
            assessmentId,
            'candidate.email': candidate.email.toLowerCase()
          });

          if (existingInvitation) {
            results.failed++;
            results.errors.push({
              index: i,
              email: candidate.email,
              error: 'Invitation already exists for this candidate'
            });
            continue;
          }

          const invitation = new Invitation({
            assessmentId,
            candidate: {
              firstName: candidate.firstName.trim(),
              lastName: candidate.lastName.trim(),
              email: candidate.email.toLowerCase().trim(),
              phone: candidate.phone?.trim(),
              resumeUrl: candidate.resumeUrl?.trim(),
              position: candidate.position?.trim()
            },
            validFrom: validFrom ? new Date(validFrom) : new Date(),
            validUntil: new Date(validUntil),
            customMessage: customMessage?.trim(),
            createdBy: user._id
          });

          await invitation.save();
          results.success++;
          results.invitations.push(invitation._id);

        } catch (error) {
          results.failed++;
          results.errors.push({
            index: i,
            email: candidates[i]?.email || `Candidate ${i + 1}`,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      await SystemLog.create({
        level: 'info',
        category: 'invitation',
        action: 'invitations_bulk_create',
        message: 'Bulk invitation creation completed',
        details: {
          assessmentId,
          totalCandidates: candidates.length,
          successful: results.success,
          failed: results.failed
        },
        context: {
          organizationId: user.organizationId,
          assessmentId
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: `Bulk invitation completed. ${results.success} invitations sent, ${results.failed} failed.`,
        data: results
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'invitation',
        action: 'bulk_create_error',
        message: 'Error in bulk invitation creation',
        error,
        extra: {
          handler: 'invitationController.bulkCreateInvitations',
          assessmentId: req.body?.assessmentId,
          candidateCount: Array.isArray(req.body?.candidates) ? req.body.candidates.length : undefined
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Update invitation
  async updateInvitation(req: AuthenticatedRequest, res: Response) {
    try {
      const { invitationId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const invitation = await Invitation.findById(invitationId)
        .populate({
          path: 'assessmentId',
          match: { organizationId: user.organizationId }
        });

      if (!invitation || !invitation.assessmentId) {
        return res.status(404).json({
          success: false,
          message: 'Invitation not found'
        });
      }

      // Can't update started or submitted invitations
      if (invitation.status === 'started' || invitation.status === 'submitted') {
        return res.status(400).json({
          success: false,
          message: 'Cannot update invitation that has been started or submitted'
        });
      }

      const {
        validFrom,
        validUntil,
        customMessage,
        candidate
      } = req.body;

      // Track changes
      const changes: any = {};

      if (validFrom && new Date(validFrom).getTime() !== invitation.validFrom.getTime()) {
        changes.validFrom = { from: invitation.validFrom, to: new Date(validFrom) };
        invitation.validFrom = new Date(validFrom);
      }

      if (validUntil && new Date(validUntil).getTime() !== invitation.validUntil.getTime()) {
        changes.validUntil = { from: invitation.validUntil, to: new Date(validUntil) };
        invitation.validUntil = new Date(validUntil);
      }

      if (customMessage !== undefined && customMessage !== invitation.customMessage) {
        changes.customMessage = { from: !!invitation.customMessage, to: !!customMessage };
        invitation.customMessage = customMessage?.trim();
      }

      if (candidate) {
        if (candidate.firstName && candidate.firstName !== invitation.candidate.firstName) {
          changes.candidateName = { updated: true };
          invitation.candidate.firstName = candidate.firstName.trim();
        }
        if (candidate.lastName && candidate.lastName !== invitation.candidate.lastName) {
          changes.candidateName = { updated: true };
          invitation.candidate.lastName = candidate.lastName.trim();
        }
        if (candidate.phone !== undefined) {
          invitation.candidate.phone = candidate.phone?.trim();
        }
        if (candidate.resumeUrl !== undefined) {
          invitation.candidate.resumeUrl = candidate.resumeUrl?.trim();
        }
        if (candidate.position !== undefined) {
          invitation.candidate.position = candidate.position?.trim();
        }
      }

      await invitation.save();

      // Log the update
      await SystemLog.create({
        level: 'info',
        category: 'invitation',
        action: 'invitation_update',
        message: 'Invitation updated',
        details: { invitationId, changes },
        context: {
          organizationId: user.organizationId,
          invitationId: invitation._id
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      const updatedInvitation = await Invitation.findById(invitationId)
        .populate('assessmentId', 'title type settings')
        .populate('createdBy', 'firstName lastName email');

      res.json({
        success: true,
        message: 'Invitation updated successfully',
        data: updatedInvitation
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'invitation',
        action: 'update_invitation_error',
        message: 'Error updating invitation',
        error,
        extra: {
          handler: 'invitationController.updateInvitation',
          targetInvitationId: req.params.invitationId
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Cancel invitation
  async cancelInvitation(req: AuthenticatedRequest, res: Response) {
    try {
      const { invitationId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const invitation = await Invitation.findById(invitationId)
        .populate({
          path: 'assessmentId',
          match: { organizationId: user.organizationId }
        });

      if (!invitation || !invitation.assessmentId) {
        return res.status(404).json({
          success: false,
          message: 'Invitation not found'
        });
      }

      if (invitation.status === 'submitted') {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel completed invitation'
        });
      }

      invitation.status = 'cancelled';
      await invitation.save();

      await SystemLog.create({
        level: 'info',
        category: 'invitation',
        action: 'invitation_cancel',
        message: 'Invitation cancelled',
        details: {
          invitationId,
          candidateEmail: invitation.candidate.email
        },
        context: {
          organizationId: user.organizationId,
          invitationId: invitation._id
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Invitation cancelled successfully'
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'invitation',
        action: 'cancel_invitation_error',
        message: 'Error canceling invitation',
        error,
        extra: {
          handler: 'invitationController.cancelInvitation',
          targetInvitationId: req.params.invitationId
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Resend invitation
  async resendInvitation(req: AuthenticatedRequest, res: Response) {
    try {
      const { invitationId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const invitation = await Invitation.findById(invitationId)
        .populate({
          path: 'assessmentId',
          match: { organizationId: user.organizationId }
        });

      if (!invitation || !invitation.assessmentId) {
        return res.status(404).json({
          success: false,
          message: 'Invitation not found'
        });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Can only resend pending invitations'
        });
      }

      // Update reminder count
      invitation.remindersSent += 1;
      invitation.lastReminderAt = new Date();
      await invitation.save();

      const organization = user.organizationId
        ? await Organization.findById(user.organizationId).select('name domain').lean()
        : null;

      const candidateName = [invitation.candidate.firstName, invitation.candidate.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();

      const invitationUrl = buildCandidateInvitationUrl(invitation.token, organization?.domain);

      await sendCandidateInvitationEmail({
        to: invitation.candidate.email,
        candidateName: candidateName || undefined,
        assessmentTitle: (invitation.assessmentId as any)?.title ?? 'Assessment',
        invitationUrl,
        expiresAt: invitation.validUntil,
        organizationName: organization?.name || 'Online Assessment Platform',
        customMessage: invitation.customMessage,
        isReminder: true
      });

      await SystemLog.create({
        level: 'info',
        category: 'invitation',
        action: 'invitation_resend',
        message: 'Invitation reminder sent',
        details: {
          invitationId,
          candidateEmail: invitation.candidate.email,
          reminderCount: invitation.remindersSent
        },
        context: {
          organizationId: user.organizationId,
          invitationId: invitation._id
        },
        userInfo: getUserInfo(req),
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Invitation reminder sent successfully'
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'invitation',
        action: 'resend_invitation_error',
        message: 'Error resending invitation',
        error,
        extra: {
          handler: 'invitationController.resendInvitation',
          targetInvitationId: req.params.invitationId
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Get invitation analytics for assessment
  async getInvitationAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const { assessmentId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Verify assessment belongs to organization
      const assessment = await Assessment.findOne({
        _id: assessmentId,
        organizationId: user.organizationId,
        isActive: true
      });

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found'
        });
      }

      // Get invitation analytics
      const analytics = await Invitation.aggregate([
        { $match: { assessmentId: assessment._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            candidates: {
              $push: {
                name: { $concat: ['$candidate.firstName', ' ', '$candidate.lastName'] },
                email: '$candidate.email',
                createdAt: '$createdAt'
              }
            }
          }
        }
      ]);

      // Calculate summary statistics
      const summary = {
        total: 0,
        pending: 0,
        started: 0,
        submitted: 0,
        expired: 0,
        cancelled: 0
      };

      analytics.forEach(item => {
        summary.total += item.count;
        summary[item._id as keyof typeof summary] = item.count;
      });

      res.json({
        success: true,
        data: {
          assessment: {
            id: assessment._id,
            title: assessment.title,
            type: assessment.type
          },
          summary,
          breakdown: analytics
        }
      });

    } catch (error) {
      await logControllerError(req, {
        category: 'invitation',
        action: 'get_invitation_analytics_error',
        message: 'Error retrieving invitation analytics',
        error,
        extra: {
          handler: 'invitationController.getInvitationAnalytics',
          assessmentId: req.params.assessmentId
        }
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
};

export default invitationController;
