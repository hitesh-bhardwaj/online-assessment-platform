import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IPermissions {
  assessments: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
  questions: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
  invitations: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
  results: {
    read: boolean;
    export: boolean;
    delete: boolean;
  };
  users: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
  organization: {
    read: boolean;
    update: boolean;
  };
}

export interface ILoginOtp {
  codeHash?: string;
  expiresAt?: Date;
  attempts?: number;
  requestedAt?: Date;
}

export interface IUser extends Document {
  organizationId: mongoose.Types.ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'recruiter';
  permissions: IPermissions;
  isActive: boolean;
  emailVerified: boolean;
  invitedAt?: Date;
  lastLogin?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  loginOtp?: ILoginOtp;
  createdAt: Date;
  updatedAt: Date;

  // virtual
  status?: 'active' | 'suspended';

  comparePassword(candidatePassword: string): Promise<boolean>;
  getFullName(): string;
  hasPermission(resource: keyof IPermissions, action: string): boolean;
}

const LoginOtpSchema = new Schema<ILoginOtp>(
  {
    codeHash: { type: String },
    expiresAt: { type: Date },
    attempts: { type: Number, default: 0 },
    requestedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const PermissionsSchema = new Schema<IPermissions>({
  assessments: {
    create: { type: Boolean, default: true },
    read: { type: Boolean, default: true },
    update: { type: Boolean, default: true },
    delete: { type: Boolean, default: false }
  },
  questions: {
    create: { type: Boolean, default: true },
    read: { type: Boolean, default: true },
    update: { type: Boolean, default: true },
    delete: { type: Boolean, default: false }
  },
  invitations: {
    create: { type: Boolean, default: true },
    read: { type: Boolean, default: true },
    update: { type: Boolean, default: true },
    delete: { type: Boolean, default: false }
  },
  results: {
    read: { type: Boolean, default: true },
    export: { type: Boolean, default: true },
    delete: { type: Boolean, default: false }
  },
  users: {
    create: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
    update: { type: Boolean, default: false },
    delete: { type: Boolean, default: false }
  },
  organization: {
    read: { type: Boolean, default: false },
    update: { type: Boolean, default: false }
  }
});

const UserSchema = new Schema<IUser>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  email: {
    type: String,
    required: true,
    // IMPORTANT: no unique: true here; uniqueness is compound per org:
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: { type: String, required: true, minlength: 8, select: false },
  firstName: { type: String, required: true, trim: true, maxlength: 50 },
  lastName: { type: String, required: true, trim: true, maxlength: 50 },
  role: { type: String, enum: ['admin', 'recruiter'], required: true, default: 'recruiter' },
  permissions: {
    type: PermissionsSchema,
    required: true,
    // helpful default so validation passes even if controller doesn’t set it
    default: function (this: IUser) {
      const role = this.role || 'recruiter';
      return role === 'admin'
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
    }
  },
  isActive: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  invitedAt: { type: Date },
  loginOtp: { type: LoginOtpSchema, default: undefined },
  lastLogin: { type: Date },
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false }
}, {
  timestamps: true,
  toJSON: {
  virtuals: true,
  transform: (_doc, ret: any) => {
    delete ret.password;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    return ret;
  },
},
  toObject: { virtuals: true }
});

// Indexes
// Make email unique PER organization
UserSchema.index({ organizationId: 1, email: 1 }, { unique: true });
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ emailVerified: 1 });
UserSchema.index({ invitedAt: 1 }, { sparse: true });

// Virtual for full name
UserSchema.virtual('fullName').get(function() { return `${this.firstName} ${this.lastName}`; });
UserSchema.virtual('status').get(function (this: IUser) {
  return this.isActive ? 'active' : 'suspended';
});


// Pre-save middleware to hash password
UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Pre-save middleware to set default permissions based on role
UserSchema.pre<IUser>('save', function (next) {
  if (!this.isModified('role') && this.permissions) return next();

  const defaultPermissions: Record<string, Partial<IPermissions>> = {
    admin: {
      assessments: { create: true, read: true, update: true, delete: true },
      questions: { create: true, read: true, update: true, delete: true },
      invitations: { create: true, read: true, update: true, delete: true },
      results: { read: true, export: true, delete: true },
      users: { create: true, read: true, update: true, delete: true },
      organization: { read: true, update: true }
    },
    recruiter: {
      assessments: { create: true, read: true, update: true, delete: false },
      questions: { create: true, read: true, update: true, delete: false },
      invitations: { create: true, read: true, update: true, delete: false },
      results: { read: true, export: true, delete: false },
      users: { create: false, read: false, update: false, delete: false },
      organization: { read: true, update: false }
    }
  };

  const existingPermissions = this.permissions ? { ...this.permissions } : {};

  this.permissions = {
    ...existingPermissions,
    ...defaultPermissions[this.role]
  } as IPermissions;

  next();
});

// Instance methods
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.getFullName = function (): string {
  return `${this.firstName} ${this.lastName}`;
};

UserSchema.methods.hasPermission = function (resource: keyof IPermissions, action: string): boolean {
  return this.permissions[resource]?.[action as keyof IPermissions[keyof IPermissions]] || false;
};

// Static helper
UserSchema.statics.findByEmailAndOrg = function (email: string, organizationId: string) {
  return this.findOne({ email, organizationId, isActive: true });
};

export default mongoose.model<IUser>('User', UserSchema);
