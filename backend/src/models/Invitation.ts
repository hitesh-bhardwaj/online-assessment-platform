import mongoose, { Document, Schema, Model } from 'mongoose';
import crypto from 'crypto';

export interface ICandidate {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
  position?: string;
}

export interface ISessionData {
  startedAt?: Date;
  lastActiveAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  browserFingerprint?: string;
  timeZone?: string;
  screenResolution?: string;
  attemptsUsed: number;
}

export interface IProctoringConsent {
  agreedAt?: Date;
  ipAddress?: string;
  consentText: string;
  version: string;
}

export interface IInvitation {
  assessmentId: mongoose.Types.ObjectId;
  candidate: ICandidate;
  token: string;
  status: 'pending' | 'started' | 'submitted' | 'expired' | 'cancelled';
  validFrom: Date;
  validUntil: Date;
  sessionData: ISessionData;
  proctoringConsent?: IProctoringConsent;
  customMessage?: string;
  remindersSent: number;
  lastReminderAt?: Date;
  submittedAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInvitationDocument extends IInvitation, Document {
  generateToken(): string;
  isValid(): boolean;
  isExpired(): boolean;
  canStart(): Promise<boolean>;
  hasAttemptsLeft(): Promise<boolean>;
}

type InvitationAnalytics = Array<{
  _id: string;
  count: number;
  candidates: Array<{ name: string; email: string; createdAt: Date }>;
}>;

export interface IInvitationModel extends Model<IInvitationDocument> {
  findByToken(token: string): Promise<IInvitationDocument | null>;
  findActiveByAssessment(assessmentId: string): Promise<IInvitationDocument[]>;
  findExpired(): Promise<IInvitationDocument[]>;
  getAnalytics(assessmentId: string): mongoose.Aggregate<InvitationAnalytics>;
}

const CandidateSchema = new Schema<ICandidate>({
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  phone: {
    type: String,
    trim: true,
    match: /^[\+]?[1-9][\d]{0,15}$/
  },
  resumeUrl: {
    type: String,
    trim: true
  },
  position: {
    type: String,
    trim: true,
    maxlength: 100
  }
});

const SessionDataSchema = new Schema<ISessionData>({
  startedAt: { type: Date },
  lastActiveAt: { type: Date },
  ipAddress: { type: String, trim: true },
  userAgent: { type: String, trim: true },
  browserFingerprint: { type: String, trim: true },
  timeZone: { type: String, trim: true },
  screenResolution: { type: String, trim: true },
  attemptsUsed: { type: Number, default: 0, min: 0 }
});

const ProctoringConsentSchema = new Schema<IProctoringConsent>({
  agreedAt: { type: Date },
  ipAddress: { type: String, trim: true },
  consentText: { type: String, required: true },
  version: { type: String, required: true, default: '1.0' }
});

const InvitationSchema = new Schema<IInvitationDocument, IInvitationModel>({
  assessmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Assessment',
    required: true,
    index: true
  },
  candidate: {
    type: CandidateSchema,
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: function(this: IInvitationDocument) {
      return this.generateToken();
    }
  },
  status: {
    type: String,
    enum: ['pending', 'started', 'submitted', 'expired', 'cancelled'],
    default: 'pending',
    index: true
  },
  validFrom: {
    type: Date,
    required: true,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true
  },
  sessionData: {
    type: SessionDataSchema,
    required: true,
    default: () => ({})
  },
  proctoringConsent: {
    type: ProctoringConsentSchema
  },
  customMessage: {
    type: String,
    maxlength: 500
  },
  remindersSent: {
    type: Number,
    default: 0,
    min: 0
  },
  lastReminderAt: {
    type: Date
  },
  submittedAt: {
    type: Date
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
InvitationSchema.index({ 'candidate.email': 1 });
InvitationSchema.index({ status: 1, validUntil: 1 });
InvitationSchema.index({ assessmentId: 1, status: 1 });
InvitationSchema.index({ createdBy: 1 });
InvitationSchema.index({ validUntil: 1 }); // For cleanup of expired invitations

// Pre-save middleware to generate token if not provided
InvitationSchema.pre<IInvitationDocument>('save', function(next) {
  if (!this.token) {
    this.token = this.generateToken();
  }
  next();
});

// Pre-save middleware to update status based on time
InvitationSchema.pre<IInvitationDocument>('save', function(next) {
  const now = new Date();

  if (this.status === 'pending' && now > this.validUntil) {
    this.status = 'expired';
  }

  if (this.status === 'submitted' && !this.submittedAt) {
    this.submittedAt = new Date();
  }

  next();
});

// Virtual for candidate full name
InvitationSchema.virtual('candidateFullName').get(function(this: IInvitationDocument) {
  return `${this.candidate.firstName} ${this.candidate.lastName}`;
});

// Virtual for invitation status description
InvitationSchema.virtual('statusDescription').get(function(this: IInvitationDocument) {
  const statusMap = {
    pending: 'Invitation sent, awaiting response',
    started: 'Assessment in progress',
    submitted: 'Assessment completed',
    expired: 'Invitation expired',
    cancelled: 'Invitation cancelled'
  };
  return statusMap[this.status] || 'Unknown status';
});

// Instance method to generate secure token
InvitationSchema.methods.generateToken = function(this: IInvitationDocument): string {
  return crypto.randomBytes(32).toString('hex');
};

// Instance method to check if invitation is valid
InvitationSchema.methods.isValid = function(this: IInvitationDocument): boolean {
  const now = new Date();
  return this.status === 'pending' && now >= this.validFrom && now <= this.validUntil;
};

// Instance method to check if invitation is expired
InvitationSchema.methods.isExpired = function(this: IInvitationDocument): boolean {
  return new Date() > this.validUntil || this.status === 'expired';
};

// Instance method to check if candidate can start assessment
const extractAttemptsAllowed = (assessment: unknown): number | undefined => {
  if (!assessment || typeof assessment !== 'object') {
    return undefined;
  }
  const settings = (assessment as { settings?: { attemptsAllowed?: unknown } }).settings;
  const attempts = settings?.attemptsAllowed;
  return typeof attempts === 'number' ? attempts : undefined;
};

InvitationSchema.methods.canStart = async function(this: IInvitationDocument): Promise<boolean> {
  if (!this.isValid()) return false;

  // Populate assessment to check attempts allowed
  await this.populate<{ assessmentId: mongoose.Document & { settings?: { attemptsAllowed?: number } } | mongoose.Types.ObjectId }>(
    'assessmentId',
    'settings.attemptsAllowed'
  );

  const attemptsAllowed = extractAttemptsAllowed(this.assessmentId);

  if (typeof attemptsAllowed !== 'number') {
    return false;
  }

  return this.sessionData.attemptsUsed < attemptsAllowed;
};

// Instance method to check if candidate has attempts left
InvitationSchema.methods.hasAttemptsLeft = async function(this: IInvitationDocument): Promise<boolean> {
  await this.populate<{ assessmentId: mongoose.Document & { settings?: { attemptsAllowed?: number } } | mongoose.Types.ObjectId }>(
    'assessmentId',
    'settings.attemptsAllowed'
  );

  const attemptsAllowed = extractAttemptsAllowed(this.assessmentId);

  if (typeof attemptsAllowed !== 'number') {
    return false;
  }

  return this.sessionData.attemptsUsed < attemptsAllowed;
};

// Static method to find by token
InvitationSchema.statics.findByToken = function (this: IInvitationModel, token: string) {
  return this.findOne({ token })
    .populate('assessmentId', 'title description type instructions settings questions organizationId')
    .exec();
};

// Static method to find active invitations for an assessment
InvitationSchema.statics.findActiveByAssessment = function (this: IInvitationModel, assessmentId: string) {
  return this.find({
    assessmentId,
    status: { $in: ['pending', 'started'] }
  })
    .populate('createdBy', 'firstName lastName email')
    .exec();
};

// Static method to find expired invitations for cleanup
InvitationSchema.statics.findExpired = function (this: IInvitationModel) {
  const now = new Date();
  return this.find({
    status: 'pending',
    validUntil: { $lt: now }
  }).exec();
};

// Static method to get invitation analytics for an assessment
InvitationSchema.statics.getAnalytics = function (this: IInvitationModel, assessmentId: string) {
  return this.aggregate([
    { $match: { assessmentId: new mongoose.Types.ObjectId(assessmentId) } },
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
};

const InvitationModel = mongoose.model<IInvitationDocument, IInvitationModel>('Invitation', InvitationSchema);

export default InvitationModel;
