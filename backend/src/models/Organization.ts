import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IBranding {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  emailTemplates?: {
    invitation?: string;
    reminder?: string;
    results?: string;
  };
}

export interface ISubscription {
  plan: 'free' | 'basic' | 'premium';
  startDate: Date;
  endDate?: Date;
  features: string[];
  maxAssessments?: number;
  maxCandidatesPerMonth?: number;
}

export interface ISettings {
  dataRetentionDays: number;
  gdprCompliant: boolean;
  allowCandidateDataDownload: boolean;
  requireProctoringConsent: boolean;
  defaultAssessmentSettings?: {
    timeLimit?: number;
    proctoringEnabled?: boolean;
    shuffleQuestions?: boolean;
    showResultsToCandidate?: boolean;
  };
}

export type OrganizationStatus = 'pending' | 'active' | 'suspended' | 'archived';

export interface ISignupMetadata {
  tokenHash?: string;
  email?: string;
  invitedBy?: mongoose.Types.ObjectId;
  source?: 'self_service' | 'manual' | 'import';
  expiresAt?: Date;
  completedAt?: Date;
  createdAt?: Date;
}

export interface IOrganization {
  name: string;
  domain?: string;
  contactEmail: string;
  branding: IBranding;
  subscription: ISubscription;
  settings: ISettings;
  isActive: boolean;
  status: OrganizationStatus;
  signup?: ISignupMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrganizationDocument extends IOrganization, Document {
  subscriptionStatus?: string;
  hasFeature(feature: string): boolean;
}

export interface IOrganizationModel extends Model<IOrganizationDocument> {}

const BrandingSchema = new Schema<IBranding>({
  logoUrl: { type: String },
  primaryColor: { type: String, default: '#007bff' },
  secondaryColor: { type: String, default: '#6c757d' },
  emailTemplates: {
    invitation: { type: String },
    reminder: { type: String },
    results: { type: String }
  }
});

const SubscriptionSchema = new Schema<ISubscription>({
  plan: {
    type: String,
    enum: ['free', 'basic', 'premium'],
    required: true,
    default: 'free'
  },
  startDate: { type: Date, required: true, default: Date.now },
  endDate: { type: Date },
  features: [{ type: String }],
  maxAssessments: { type: Number },
  maxCandidatesPerMonth: { type: Number }
});

const SettingsSchema = new Schema<ISettings>({
  dataRetentionDays: { type: Number, default: 365 },
  gdprCompliant: { type: Boolean, default: true },
  allowCandidateDataDownload: { type: Boolean, default: true },
  requireProctoringConsent: { type: Boolean, default: true },
  defaultAssessmentSettings: {
    timeLimit: { type: Number },
    proctoringEnabled: { type: Boolean, default: false },
    shuffleQuestions: { type: Boolean, default: true },
    showResultsToCandidate: { type: Boolean, default: false }
  }
});

const SignupMetadataSchema = new Schema<ISignupMetadata>({
  tokenHash: {
    type: String
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  source: {
    type: String,
    enum: ['self_service', 'manual', 'import'],
    default: 'self_service'
  },
  expiresAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const OrganizationSchema = new Schema<IOrganizationDocument, IOrganizationModel>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  domain: {
    type: String,
    trim: true,
    lowercase: true,
    match: /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/
  },
  contactEmail: {
    type: String,
    required: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  branding: {
    type: BrandingSchema,
    default: () => ({})
  },
  subscription: {
    type: SubscriptionSchema,
    required: true,
    default: () => ({
      plan: 'free',
      startDate: new Date(),
      features: ['basic_assessments', 'email_invitations']
    })
  },
  settings: {
    type: SettingsSchema,
    required: true,
    default: () => ({})
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'archived'],
    default: 'active',
    index: true
  },
  signup: {
    type: SignupMetadataSchema,
    default: () => ({})
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
OrganizationSchema.index({ name: 1 });
OrganizationSchema.index({ domain: 1 }, { unique: true, sparse: true });
OrganizationSchema.index({ contactEmail: 1 });
OrganizationSchema.index({ isActive: 1 });
OrganizationSchema.index({ status: 1 });
OrganizationSchema.index({ 'signup.tokenHash': 1 }, { sparse: true });
OrganizationSchema.index({ 'signup.email': 1 }, { sparse: true });

// Virtual for subscription status
OrganizationSchema.virtual('subscriptionStatus').get(function (this: IOrganizationDocument) {
  const subscription = this.subscription;
  if (!subscription) {
    return 'active';
  }

  const { endDate } = subscription as { endDate?: Date };
  if (endDate && new Date() > endDate) {
    return 'expired';
  }

  return 'active';
});

// Method to check if feature is available
OrganizationSchema.methods.hasFeature = function (this: IOrganizationDocument, feature: string): boolean {
  return this.subscription.features.includes(feature);
};

const OrganizationModel = mongoose.model<IOrganizationDocument, IOrganizationModel>('Organization', OrganizationSchema);

export default OrganizationModel;
