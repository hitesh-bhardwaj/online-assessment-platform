import mongoose, { Document, Schema } from 'mongoose';

export interface ITestCaseResult {
  testCaseId: string;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  executionTime: number; // in milliseconds
  memoryUsed: number; // in KB
  error?: string;
}

export interface IExecutionEnvironment {
  containerId?: string;
  lambdaRequestId?: string;
  executionRegion?: string;
  resourceLimits: {
    cpuTime: number; // in seconds
    memory: number; // in MB
    diskSpace: number; // in MB
  };
}

export interface ISecurityMetrics {
  suspiciousPatterns: string[];
  forbiddenAPIs: string[];
  networkAttempts: number;
  fileSystemAccess: string[];
  riskScore: number; // 0-100
}

export interface ICodeExecution extends Document {
  resultId: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  code: string;
  language: 'javascript' | 'python' | 'java' | 'cpp' | 'csharp';
  status: 'pending' | 'running' | 'completed' | 'timeout' | 'error' | 'security_violation';
  testResults: ITestCaseResult[];
  overallScore: number; // percentage of test cases passed
  executionTime: number; // total execution time in milliseconds
  memoryUsed: number; // peak memory usage in KB
  compilationOutput?: string;
  runtimeError?: string;
  securityMetrics: ISecurityMetrics;
  environment: IExecutionEnvironment;
  executedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  calculateScore(): number;
  isSecure(): boolean;
  getPerformanceRating(): string;
}

const TestCaseResultSchema = new Schema<ITestCaseResult>({
  testCaseId: {
    type: String,
    required: true
  },
  input: {
    type: String,
    required: true
  },
  expectedOutput: {
    type: String,
    required: true
  },
  actualOutput: {
    type: String,
    required: true
  },
  passed: {
    type: Boolean,
    required: true
  },
  executionTime: {
    type: Number,
    required: true,
    min: 0
  },
  memoryUsed: {
    type: Number,
    required: true,
    min: 0
  },
  error: {
    type: String
  }
});

const ExecutionEnvironmentSchema = new Schema<IExecutionEnvironment>({
  containerId: {
    type: String,
    trim: true
  },
  lambdaRequestId: {
    type: String,
    trim: true
  },
  executionRegion: {
    type: String,
    trim: true,
    default: 'us-east-1'
  },
  resourceLimits: {
    cpuTime: {
      type: Number,
      required: true,
      default: 30,
      min: 1,
      max: 300
    },
    memory: {
      type: Number,
      required: true,
      default: 128,
      min: 32,
      max: 512
    },
    diskSpace: {
      type: Number,
      required: true,
      default: 50,
      min: 10,
      max: 200
    }
  }
});

const SecurityMetricsSchema = new Schema<ISecurityMetrics>({
  suspiciousPatterns: [{
    type: String,
    trim: true
  }],
  forbiddenAPIs: [{
    type: String,
    trim: true
  }],
  networkAttempts: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  fileSystemAccess: [{
    type: String,
    trim: true
  }],
  riskScore: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 100
  }
});

const CodeExecutionSchema = new Schema<ICodeExecution>({
  resultId: {
    type: Schema.Types.ObjectId,
    ref: 'AssessmentResult',
    required: true,
    index: true
  },
  questionId: {
    type: Schema.Types.ObjectId,
    ref: 'Question',
    required: true,
    index: true
  },
  code: {
    type: String,
    required: true,
    maxlength: 10000 // Limit code length
  },
  language: {
    type: String,
    enum: ['javascript', 'python', 'java', 'cpp', 'csharp'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'timeout', 'error', 'security_violation'],
    required: true,
    default: 'pending',
    index: true
  },
  testResults: {
    type: [TestCaseResultSchema],
    required: true
  },
  overallScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0
  },
  executionTime: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  memoryUsed: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  compilationOutput: {
    type: String,
    maxlength: 5000
  },
  runtimeError: {
    type: String,
    maxlength: 2000
  },
  securityMetrics: {
    type: SecurityMetricsSchema,
    required: true,
    default: () => ({})
  },
  environment: {
    type: ExecutionEnvironmentSchema,
    required: true,
    default: () => ({})
  },
  executedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
CodeExecutionSchema.index({ status: 1, executedAt: 1 });
CodeExecutionSchema.index({ language: 1, status: 1 });
CodeExecutionSchema.index({ overallScore: 1 });
CodeExecutionSchema.index({ 'securityMetrics.riskScore': 1 });

// Virtual for execution duration
CodeExecutionSchema.virtual('executionDuration').get(function() {
  if (!this.completedAt) return null;
  return this.completedAt.getTime() - this.executedAt.getTime();
});

// Virtual for success rate
CodeExecutionSchema.virtual('successRate').get(function() {
  if (this.testResults.length === 0) return 0;
  const passedTests = this.testResults.filter(result => result.passed).length;
  return Math.round((passedTests / this.testResults.length) * 100);
});

// Pre-save middleware to update completion time
CodeExecutionSchema.pre<ICodeExecution>('save', function(next) {
  if (this.isModified('status') && ['completed', 'timeout', 'error', 'security_violation'].includes(this.status) && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

// Instance method to calculate overall score
CodeExecutionSchema.methods.calculateScore = function(): number {
  if (this.testResults.length === 0) return 0;

  let weightedScore = 0;
  let totalWeight = 0;

  this.testResults.forEach((result: ITestCaseResult) => {
    // Get weight from test case (default to 1 if not specified)
    const weight = 1; // This would typically come from the question's test case configuration
    totalWeight += weight;

    if (result.passed) {
      weightedScore += weight;
    }
  });

  this.overallScore = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 0;
  return this.overallScore;
};

// Instance method to check if code execution is secure
CodeExecutionSchema.methods.isSecure = function(): boolean {
  return this.securityMetrics.riskScore < 50 &&
         this.securityMetrics.forbiddenAPIs.length === 0 &&
         this.securityMetrics.networkAttempts === 0;
};

// Instance method to get performance rating
CodeExecutionSchema.methods.getPerformanceRating = function(): string {
  const avgExecutionTime = this.testResults.length > 0
    ? this.testResults.reduce((sum: number, result: ITestCaseResult) => sum + result.executionTime, 0) / this.testResults.length
    : this.executionTime;

  const avgMemoryUsed = this.testResults.length > 0
    ? this.testResults.reduce((sum: number, result: ITestCaseResult) => sum + result.memoryUsed, 0) / this.testResults.length
    : this.memoryUsed;

  // Simple performance rating based on execution time and memory usage
  if (avgExecutionTime < 100 && avgMemoryUsed < 1024) return 'Excellent';
  if (avgExecutionTime < 500 && avgMemoryUsed < 5120) return 'Good';
  if (avgExecutionTime < 2000 && avgMemoryUsed < 10240) return 'Fair';
  return 'Poor';
};

// Static method to get execution statistics by language
CodeExecutionSchema.statics.getLanguageStats = function(timeframe: Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
  return this.aggregate([
    {
      $match: {
        executedAt: { $gte: timeframe },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$language',
        totalExecutions: { $sum: 1 },
        avgScore: { $avg: '$overallScore' },
        avgExecutionTime: { $avg: '$executionTime' },
        avgMemoryUsed: { $avg: '$memoryUsed' },
        securityViolations: {
          $sum: {
            $cond: [{ $gt: ['$securityMetrics.riskScore', 50] }, 1, 0]
          }
        }
      }
    },
    {
      $sort: { totalExecutions: -1 }
    }
  ]);
};

// Static method to find executions by result
CodeExecutionSchema.statics.findByResult = function(resultId: string) {
  return this.find({ resultId })
    .populate('questionId', 'title type difficulty')
    .sort({ executedAt: -1 });
};

// Static method to get security violations
CodeExecutionSchema.statics.getSecurityViolations = function(days: number = 7) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return this.find({
    executedAt: { $gte: startDate },
    $or: [
      { status: 'security_violation' },
      { 'securityMetrics.riskScore': { $gt: 70 } },
      { 'securityMetrics.forbiddenAPIs.0': { $exists: true } },
      { 'securityMetrics.networkAttempts': { $gt: 0 } }
    ]
  }).populate('resultId', 'invitationId')
    .populate('questionId', 'title');
};

export default mongoose.model<ICodeExecution>('CodeExecution', CodeExecutionSchema);
