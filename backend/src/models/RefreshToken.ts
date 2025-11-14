import mongoose, { Document, Schema } from 'mongoose';

export interface IRefreshToken extends Document {
  token: string;
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  isRevoked: boolean;
  revokedAt?: Date;
  revokedReason?: string;
}

const RefreshTokenSchema = new Schema<IRefreshToken>({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUsedAt: {
    type: Date
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  isRevoked: {
    type: Boolean,
    default: false,
    index: true
  },
  revokedAt: {
    type: Date
  },
  revokedReason: {
    type: String
  }
});

// Index for cleanup of expired tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Methods
RefreshTokenSchema.methods.isValid = function(): boolean {
  return !this.isRevoked && this.expiresAt > new Date();
};

RefreshTokenSchema.methods.revoke = async function(reason?: string): Promise<void> {
  this.isRevoked = true;
  this.revokedAt = new Date();
  this.revokedReason = reason;
  await this.save();
};

// Statics
RefreshTokenSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isRevoked: true, revokedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } // Keep revoked tokens for 30 days
    ]
  });
  return result.deletedCount;
};

RefreshTokenSchema.statics.revokeAllForUser = async function(userId: mongoose.Types.ObjectId, reason?: string) {
  return this.updateMany(
    { userId, isRevoked: false },
    {
      $set: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason || 'User requested logout from all devices'
      }
    }
  );
};

export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);
export default RefreshToken;
