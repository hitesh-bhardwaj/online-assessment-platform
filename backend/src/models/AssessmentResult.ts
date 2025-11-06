import mongoose, { Document, Schema } from 'mongoose';

export interface IQuestionResponse {
  questionId: mongoose.Types.ObjectId;
  answer: any; // Can be string, array of strings, or code for different question types
  timeTaken: number; // in seconds
  isCorrect: boolean;
  pointsEarned: number;
  submittedAt: Date;
  attempts: number; // For questions that allow multiple attempts
}

export interface IScore {
  total: number;
  earned: number;
  percentage: number;
  breakdown: {
    mcq: { total: number; earned: number; count: number };
    msq: { total: number; earned: number; count: number };
    coding: { total: number; earned: number; count: number };
  };
}

export interface IProctoringEvent {
  type:
    | 'tab_switch'
    | 'tab_hidden'
    | 'window_blur'
    | 'copy_paste'
    | 'copy_event'
    | 'right_click'
    | 'fullscreen_exit'
    | 'multiple_monitors'
    | 'suspicious_activity'
    | 'media_stream_error'
    | 'keyboard_shortcut'
    | 'devtools_attempt'
    | 'unknown';
  timestamp: Date;
  details?: any;
  severity: 'low' | 'medium' | 'high';
}

export interface IProctoringMediaSegment {
  segmentId: string;
  type: 'screen' | 'webcam' | 'microphone';
  filePath?: string;
  fileKey?: string;
  publicUrl?: string;
  storage?: 'local' | 'r2';
  mimeType: string;
  recordedAt: Date;
  durationMs?: number;
  size?: number;
  sequence?: number;
}

export interface IProctoringReport {
  events: IProctoringEvent[];
  trustScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  summary: string;
  recordingUrls?: {
    screen?: string;
    webcam?: string;
    microphone?: string;
  };
  mediaSegments?: IProctoringMediaSegment[];
}

export interface IPerformanceMetrics {
  totalTimeSpent: number; // in seconds
  averageTimePerQuestion: number;
  questionsAttempted: number;
  questionsSkipped: number;
  reviewCount: number; // How many times candidate reviewed questions
}

export interface IAssessmentResult extends Document {
  invitationId: mongoose.Types.ObjectId;
  responses: IQuestionResponse[];
  score: IScore;
  status: 'in_progress' | 'completed' | 'auto_submitted' | 'disqualified';
  startedAt: Date;
  submittedAt?: Date;
  proctoringReport?: IProctoringReport;
  performanceMetrics: IPerformanceMetrics;
  feedback?: string; // AI-generated or manual feedback
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  isPublic: boolean; // Whether candidate can view results
  createdAt: Date;
  updatedAt: Date;
  grade?: string;
  durationMinutes?: number | null;

  // Methods
  calculateScore(): void;
  generateFeedback(): string;
  isPassed(passingScore: number): boolean;
  getDuration(): number;
}

const QuestionResponseSchema = new Schema<IQuestionResponse>({
  questionId: {
    type: Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  answer: {
    type: Schema.Types.Mixed,
    required: true
  },
  timeTaken: {
    type: Number,
    required: true,
    min: 0
  },
  isCorrect: {
    type: Boolean,
    required: true,
    default: false
  },
  pointsEarned: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  submittedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  attempts: {
    type: Number,
    default: 1,
    min: 1
  }
});

const ScoreSchema = new Schema<IScore>({
  total: { type: Number, required: true, min: 0 },
  earned: { type: Number, required: true, min: 0 },
  percentage: { type: Number, required: true, min: 0, max: 100 },
  breakdown: {
    mcq: {
      total: { type: Number, default: 0, min: 0 },
      earned: { type: Number, default: 0, min: 0 },
      count: { type: Number, default: 0, min: 0 }
    },
    msq: {
      total: { type: Number, default: 0, min: 0 },
      earned: { type: Number, default: 0, min: 0 },
      count: { type: Number, default: 0, min: 0 }
    },
    coding: {
      total: { type: Number, default: 0, min: 0 },
      earned: { type: Number, default: 0, min: 0 },
      count: { type: Number, default: 0, min: 0 }
    }
  }
});

const proctoringEventTypes = [
  'tab_switch',
  'tab_hidden',
  'window_blur',
  'copy_paste',
  'copy_event',
  'right_click',
  'fullscreen_exit',
  'multiple_monitors',
  'suspicious_activity',
  'media_stream_error',
  'keyboard_shortcut',
  'devtools_attempt',
  'unknown'
] as const;

const ProctoringEventSchema = new Schema<IProctoringEvent>({
  type: {
    type: String,
    enum: proctoringEventTypes,
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  details: {
    type: Schema.Types.Mixed
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true,
    default: 'low'
  }
});

const ProctoringReportSchema = new Schema<IProctoringReport>({
  events: [ProctoringEventSchema],
  trustScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true,
    default: 100
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true,
    default: 'low'
  },
  summary: {
    type: String,
    required: true,
    maxlength: 500
  },
  recordingUrls: {
    screen: { type: String, trim: true },
    webcam: { type: String, trim: true },
    microphone: { type: String, trim: true }
  },
  mediaSegments: [
    new Schema<IProctoringMediaSegment>({
      segmentId: { type: String, required: true, trim: true },
      type: {
        type: String,
        enum: ['screen', 'webcam', 'microphone'],
        required: true
      },
      filePath: { type: String, trim: true },
      fileKey: { type: String, trim: true },
      publicUrl: { type: String, trim: true },
      storage: { type: String, enum: ['local', 'r2'], default: 'local' },
      mimeType: { type: String, required: true, default: 'video/webm' },
      recordedAt: { type: Date, required: true, default: Date.now },
      durationMs: { type: Number, min: 0 },
      size: { type: Number, min: 0 },
      sequence: { type: Number, min: 0 }
    }, { _id: false })
  ]
});

const PerformanceMetricsSchema = new Schema<IPerformanceMetrics>({
  totalTimeSpent: { type: Number, required: true, min: 0 },
  averageTimePerQuestion: { type: Number, required: true, min: 0 },
  questionsAttempted: { type: Number, required: true, min: 0 },
  questionsSkipped: { type: Number, required: true, min: 0 },
  reviewCount: { type: Number, required: true, min: 0 }
});

const AssessmentResultSchema = new Schema<IAssessmentResult>({
  invitationId: {
    type: Schema.Types.ObjectId,
    ref: 'Invitation',
    required: true,
    unique: true,
    index: true
  },
  responses: {
    type: [QuestionResponseSchema],
    required: true
  },
  score: {
    type: ScoreSchema,
    required: true
  },
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'auto_submitted', 'disqualified'],
    required: true,
    default: 'in_progress',
    index: true
  },
  startedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  submittedAt: {
    type: Date
  },
  proctoringReport: {
    type: ProctoringReportSchema
  },
  performanceMetrics: {
    type: PerformanceMetricsSchema,
    required: true
  },
  feedback: {
    type: String,
    maxlength: 2000
  },
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
AssessmentResultSchema.index({ status: 1, submittedAt: 1 });
AssessmentResultSchema.index({ 'score.percentage': 1 });
AssessmentResultSchema.index({ reviewedBy: 1 });
AssessmentResultSchema.index({ isPublic: 1 });

// Virtual for duration in minutes
AssessmentResultSchema.virtual('durationMinutes').get(function() {
  if (!this.submittedAt) return null;
  return Math.round((this.submittedAt.getTime() - this.startedAt.getTime()) / 60000);
});

// Virtual for grade
AssessmentResultSchema.virtual('grade').get(function() {
  const percentage = this.score.percentage;
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
});

// Pre-save middleware to update status and submitted time
AssessmentResultSchema.pre<IAssessmentResult>('save', function(next) {
  if (this.isModified('status') && (this.status === 'completed' || this.status === 'auto_submitted') && !this.submittedAt) {
    this.submittedAt = new Date();
  }
  next();
});

// Instance method to calculate score
AssessmentResultSchema.methods.calculateScore = async function(): Promise<void> {
  await this.populate('responses.questionId', 'type points');

  let totalPoints = 0;
  let earnedPoints = 0;
  const breakdown = { mcq: { total: 0, earned: 0, count: 0 }, msq: { total: 0, earned: 0, count: 0 }, coding: { total: 0, earned: 0, count: 0 } };

  this.responses.forEach((response: any) => {
    const question = response.questionId;
    const questionType = question.type as keyof typeof breakdown;

    totalPoints += question.points;
    earnedPoints += response.pointsEarned;

    breakdown[questionType].total += question.points;
    breakdown[questionType].earned += response.pointsEarned;
    breakdown[questionType].count += 1;
  });

  this.score = {
    total: totalPoints,
    earned: earnedPoints,
    percentage: totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0,
    breakdown
  };
};

// Instance method to generate AI feedback (placeholder for now)
AssessmentResultSchema.methods.generateFeedback = function(): string {
  const percentage = this.score.percentage;
  const breakdown = this.score.breakdown;

  let feedback = `Overall Performance: ${percentage}% (${this.score.earned}/${this.score.total} points)\n\n`;

  if (breakdown.mcq.count > 0) {
    const mcqPercent = Math.round((breakdown.mcq.earned / breakdown.mcq.total) * 100);
    feedback += `Multiple Choice: ${mcqPercent}% (${breakdown.mcq.earned}/${breakdown.mcq.total} points)\n`;
  }

  if (breakdown.msq.count > 0) {
    const msqPercent = Math.round((breakdown.msq.earned / breakdown.msq.total) * 100);
    feedback += `Multiple Select: ${msqPercent}% (${breakdown.msq.earned}/${breakdown.msq.total} points)\n`;
  }

  if (breakdown.coding.count > 0) {
    const codingPercent = Math.round((breakdown.coding.earned / breakdown.coding.total) * 100);
    feedback += `Coding Questions: ${codingPercent}% (${breakdown.coding.earned}/${breakdown.coding.total} points)\n`;
  }

  if (percentage >= 85) {
    feedback += '\nExcellent performance! You demonstrated strong understanding across all areas.';
  } else if (percentage >= 70) {
    feedback += '\nGood performance with room for improvement in some areas.';
  } else if (percentage >= 50) {
    feedback += '\nFair performance. Consider reviewing the topics where you struggled.';
  } else {
    feedback += '\nNeed significant improvement. Review fundamental concepts.';
  }

  return feedback;
};

// Instance method to check if passed
AssessmentResultSchema.methods.isPassed = function(passingScore: number): boolean {
  return this.score.percentage >= passingScore;
};

// Instance method to get duration in seconds
AssessmentResultSchema.methods.getDuration = function(): number {
  if (!this.submittedAt) return 0;
  return Math.round((this.submittedAt.getTime() - this.startedAt.getTime()) / 1000);
};

// Static method to get results by assessment
AssessmentResultSchema.statics.findByAssessment = function(assessmentId: string) {
  return this.find({})
    .populate({
      path: 'invitationId',
      match: { assessmentId },
      populate: {
        path: 'candidate'
      }
    })
    .populate('reviewedBy', 'firstName lastName');
};

// Static method to get analytics for an assessment
AssessmentResultSchema.statics.getAnalytics = function(assessmentId: string) {
  return this.aggregate([
    {
      $lookup: {
        from: 'invitations',
        localField: 'invitationId',
        foreignField: '_id',
        as: 'invitation'
      }
    },
    {
      $match: {
        'invitation.assessmentId': new mongoose.Types.ObjectId(assessmentId),
        status: { $in: ['completed', 'auto_submitted'] }
      }
    },
    {
      $group: {
        _id: null,
        avgScore: { $avg: '$score.percentage' },
        maxScore: { $max: '$score.percentage' },
        minScore: { $min: '$score.percentage' },
        totalSubmissions: { $sum: 1 },
        avgDuration: { $avg: '$performanceMetrics.totalTimeSpent' }
      }
    }
  ]);
};

export default mongoose.model<IAssessmentResult>('AssessmentResult', AssessmentResultSchema);
