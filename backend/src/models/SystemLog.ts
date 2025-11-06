import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ILogContext {
  organizationId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  assessmentId?: mongoose.Types.ObjectId;
  invitationId?: mongoose.Types.ObjectId;
  resultId?: mongoose.Types.ObjectId;
  sessionId?: string;
  requestId?: string;
}

export interface IRequestDetails {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  query?: Record<string, any>;
  params?: Record<string, any>;
}

export interface IUserInfo {
  userId?: mongoose.Types.ObjectId;
  email?: string;
  role?: string;
  ipAddress: string;
  userAgent: string;
  geolocation?: {
    country?: string;
    region?: string;
    city?: string;
  };
}

export interface ISystemLog {
  level: 'info' | 'warn' | 'error' | 'debug' | 'security';
  category: 'auth' | 'assessment' | 'question' | 'invitation' | 'result' | 'code_execution' | 'proctoring' | 'system' | 'security';
  action: string;
  message: string;
  details?: any;
  context: ILogContext;
  userInfo?: IUserInfo;
  requestDetails?: IRequestDetails;
  responseStatus?: number;
  executionTime?: number; // in milliseconds
  errorStack?: string;
  timestamp: Date;
  createdAt: Date;
}

export interface ISystemLogDocument extends ISystemLog, Document {
  isSecurityEvent(): boolean;
  isCritical(): boolean;
}

type HealthMetric = {
  _id: string;
  categories: Array<{
    category: string;
    count: number;
    avgExecutionTime: number;
  }>;
  totalCount: number;
};

export interface ISystemLogModel extends Model<ISystemLogDocument> {
  logAuth(action: string, userInfo: IUserInfo, context?: ILogContext, details?: unknown): Promise<ISystemLogDocument>;
  logSecurity(action: string, message: string, userInfo?: IUserInfo, context?: ILogContext, details?: unknown): Promise<ISystemLogDocument>;
  logRequest(
    method: string,
    url: string,
    status: number,
    executionTime: number,
    userInfo?: IUserInfo,
    context?: ILogContext,
    requestDetails?: Partial<IRequestDetails>
  ): Promise<ISystemLogDocument>;
  findByFilters(filters: {
    level?: string[];
    category?: string[];
    organizationId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    skip?: number;
  }): Promise<ISystemLogDocument[]>;
  getSecurityEvents(organizationId?: string, days?: number): Promise<ISystemLogDocument[]>;
  getHealthMetrics(hours?: number): mongoose.Aggregate<HealthMetric[]>;
}

const LogContextSchema = new Schema<ILogContext>({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization'
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  assessmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Assessment'
  },
  invitationId: {
    type: Schema.Types.ObjectId,
    ref: 'Invitation'
  },
  resultId: {
    type: Schema.Types.ObjectId,
    ref: 'AssessmentResult'
  },
  sessionId: {
    type: String,
    trim: true
  },
  requestId: {
    type: String,
    trim: true
  }
});

const RequestDetailsSchema = new Schema<IRequestDetails>({
  method: {
    type: String,
    required: true,
    uppercase: true
  },
  url: {
    type: String,
    required: true,
    maxlength: 500
  },
  headers: {
    type: Map,
    of: String
  },
  body: {
    type: Schema.Types.Mixed
  },
  query: {
    type: Map,
    of: Schema.Types.Mixed
  },
  params: {
    type: Map,
    of: String
  }
});

const UserInfoSchema = new Schema<IUserInfo>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  role: {
    type: String,
    trim: true
  },
  ipAddress: {
    type: String,
    required: true,
    trim: true
  },
  userAgent: {
    type: String,
    required: true,
    trim: true
  },
  geolocation: {
    country: { type: String, trim: true },
    region: { type: String, trim: true },
    city: { type: String, trim: true }
  }
});

const SystemLogSchema = new Schema<ISystemLogDocument, ISystemLogModel>({
  level: {
    type: String,
    enum: ['info', 'warn', 'error', 'debug', 'security'],
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['auth', 'assessment', 'question', 'invitation', 'result', 'code_execution', 'proctoring', 'system', 'security'],
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  details: {
    type: Schema.Types.Mixed
  },
  context: {
    type: LogContextSchema,
    required: true,
    default: () => ({})
  },
  userInfo: {
    type: UserInfoSchema
  },
  requestDetails: {
    type: RequestDetailsSchema
  },
  responseStatus: {
    type: Number,
    min: 100,
    max: 599
  },
  executionTime: {
    type: Number,
    min: 0
  },
  errorStack: {
    type: String,
    select: false // Don't include in normal queries for security
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }, // Only track creation
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      // Don't expose sensitive information
      if (ret.requestDetails?.headers) {
        delete ret.requestDetails.headers.authorization;
        delete ret.requestDetails.headers.cookie;
      }
      if (ret.requestDetails?.body?.password) {
        delete ret.requestDetails.body.password;
      }
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for performance and querying
SystemLogSchema.index({ level: 1, timestamp: -1 });
SystemLogSchema.index({ category: 1, timestamp: -1 });
SystemLogSchema.index({ 'context.organizationId': 1, timestamp: -1 });
SystemLogSchema.index({ 'context.userId': 1, timestamp: -1 });
SystemLogSchema.index({ 'userInfo.ipAddress': 1, timestamp: -1 });
SystemLogSchema.index({ action: 1, timestamp: -1 });

// TTL index for automatic log cleanup (keep logs for 1 year)
SystemLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Compound indexes for common queries
SystemLogSchema.index({ level: 1, category: 1, timestamp: -1 });
SystemLogSchema.index({ 'context.organizationId': 1, level: 1, timestamp: -1 });

// Virtual for log age in hours
SystemLogSchema.virtual('ageHours').get(function(this: ISystemLogDocument) {
  return Math.round((Date.now() - this.timestamp.getTime()) / (1000 * 60 * 60));
});

// Instance method to check if this is a security event
SystemLogSchema.methods.isSecurityEvent = function(this: ISystemLogDocument): boolean {
  return this.level === 'security' ||
         this.category === 'security' ||
         this.action.includes('security') ||
         this.action.includes('violation') ||
          this.action.includes('breach');
};

// Instance method to check if this is a critical event
SystemLogSchema.methods.isCritical = function(this: ISystemLogDocument): boolean {
  const responseStatus = this.responseStatus ?? 0;

  return this.level === 'error' ||
         this.isSecurityEvent() ||
         responseStatus >= 500;
};

// Static method to log authentication events
SystemLogSchema.statics.logAuth = function (this: ISystemLogModel, action: string, userInfo: IUserInfo, context: ILogContext = {}, details?: unknown) {
  return this.create({
    level: 'info',
    category: 'auth',
    action,
    message: `Authentication event: ${action}`,
    details,
    context,
    userInfo,
    timestamp: new Date()
  });
};

// Static method to log security events
SystemLogSchema.statics.logSecurity = function (this: ISystemLogModel, action: string, message: string, userInfo?: IUserInfo, context: ILogContext = {}, details?: unknown) {
  return this.create({
    level: 'security',
    category: 'security',
    action,
    message,
    details,
    context,
    userInfo,
    timestamp: new Date()
  });
};

// Static method to log API requests
SystemLogSchema.statics.logRequest = function (
  this: ISystemLogModel,
  method: string,
  url: string,
  status: number,
  executionTime: number,
  userInfo?: IUserInfo,
  context: ILogContext = {},
  requestDetails?: Partial<IRequestDetails>
): Promise<ISystemLogDocument> {
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  const action = `${method.toUpperCase()}_${url.split('/')[2] || 'unknown'}`;

  return this.create({
    level,
    category: 'system',
    action,
    message: `${method.toUpperCase()} ${url} - ${status}`,
    context,
    userInfo,
    requestDetails: requestDetails ? {
      method,
      url,
      ...requestDetails
    } : undefined,
    responseStatus: status,
    executionTime,
    timestamp: new Date()
  });
};

// Static method to get logs by filters
SystemLogSchema.statics.findByFilters = function (this: ISystemLogModel, filters: {
  level?: string[];
  category?: string[];
  organizationId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  skip?: number;
}): Promise<ISystemLogDocument[]> {
  const query: Record<string, unknown> & {
    timestamp?: { $gte?: Date; $lte?: Date };
  } = {};

  if (filters.level && filters.level.length > 0) {
    query.level = { $in: filters.level };
  }

  if (filters.category && filters.category.length > 0) {
    query.category = { $in: filters.category };
  }

  if (filters.organizationId) {
    query['context.organizationId'] = filters.organizationId;
  }

  if (filters.userId) {
    query['context.userId'] = filters.userId;
  }

  if (filters.startDate || filters.endDate) {
    query.timestamp = {};
    if (filters.startDate) {
      query.timestamp.$gte = filters.startDate;
    }
    if (filters.endDate) {
      query.timestamp.$lte = filters.endDate;
    }
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(filters.limit || 100)
    .skip(filters.skip || 0)
    .exec();
};

// Static method to get security events
SystemLogSchema.statics.getSecurityEvents = function (this: ISystemLogModel, organizationId?: string, days: number = 7) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const query: {
    timestamp: { $gte: Date };
    $or: Array<Record<string, unknown>>;
    [key: string]: unknown;
  } = {
    timestamp: { $gte: startDate },
    $or: [
      { level: 'security' },
      { category: 'security' },
      { action: /security|violation|breach/i }
    ]
  };

  if (organizationId) {
    query['context.organizationId'] = organizationId;
  }

  return this.find(query).sort({ timestamp: -1 }).exec();
};

// Static method to get system health metrics
SystemLogSchema.statics.getHealthMetrics = function (this: ISystemLogModel, hours: number = 24) {
  const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

  return this.aggregate([
    { $match: { timestamp: { $gte: startDate } } },
    {
      $group: {
        _id: {
          level: '$level',
          category: '$category'
        },
        count: { $sum: 1 },
        avgExecutionTime: { $avg: '$executionTime' }
      }
    },
    {
      $group: {
        _id: '$_id.level',
        categories: {
          $push: {
            category: '$_id.category',
            count: '$count',
            avgExecutionTime: '$avgExecutionTime'
          }
        },
        totalCount: { $sum: '$count' }
      }
    }
  ]);
};

const SystemLogModel = mongoose.model<ISystemLogDocument, ISystemLogModel>('SystemLog', SystemLogSchema);

export default SystemLogModel;
