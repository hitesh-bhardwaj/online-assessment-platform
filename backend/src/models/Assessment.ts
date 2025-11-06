import mongoose, { Document, Schema } from 'mongoose';

export interface IQuestionRef {
  questionId: mongoose.Types.ObjectId;
  order: number;
  points: number;
}

export interface IProctoringSettings {
  enabled: boolean;
  recordScreen: boolean;
  recordWebcam: boolean;
  detectTabSwitch: boolean;
  detectCopyPaste: boolean;
  detectMultipleMonitors: boolean;
  allowedApps?: string[];
  blockedWebsites?: string[];
}

export interface IAssessmentSettings {
  timeLimit: number; // in minutes
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  allowReviewAnswers: boolean;
  showResultsToCandidate: boolean;
  autoSubmitOnTimeUp: boolean;
  proctoringSettings: IProctoringSettings;
  passingScore?: number; // percentage
  attemptsAllowed: number;
}

export interface IAssessment extends Document {
  organizationId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  type: 'mcq' | 'coding' | 'mixed';
  questions: IQuestionRef[];
  settings: IAssessmentSettings;
  instructions?: string;

  // Status workflow
  status: 'draft' | 'active' | 'archived' | 'scheduled' | 'under_review';
  isActive: boolean;
  isPublished: boolean;
  publishedAt?: Date;

  // Metadata
  tags: string[];
  category?: string;
  department?: string;
  jobRole?: string;

  // Scheduling
  scheduledStartDate?: Date;
  scheduledEndDate?: Date;

  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  getTotalPoints(): number;
  getEstimatedDuration(): number;
  isExpired(): boolean;
  canBePublished(): Promise<{valid: boolean; errors: string[]}>;
}

const QuestionRefSchema = new Schema<IQuestionRef>({
  questionId: {
    type: Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  order: {
    type: Number,
    required: true,
    min: 1
  },
  points: {
    type: Number,
    required: true,
    min: 1,
    max: 100
  }
});

const ProctoringSettingsSchema = new Schema<IProctoringSettings>({
  enabled: { type: Boolean, default: false },
  recordScreen: { type: Boolean, default: false },
  recordWebcam: { type: Boolean, default: false },
  detectTabSwitch: { type: Boolean, default: true },
  detectCopyPaste: { type: Boolean, default: true },
  detectMultipleMonitors: { type: Boolean, default: false },
  allowedApps: [{ type: String, trim: true }],
  blockedWebsites: [{ type: String, trim: true, lowercase: true }]
});

const AssessmentSettingsSchema = new Schema<IAssessmentSettings>({
  timeLimit: {
    type: Number,
    required: true,
    min: 5,
    max: 480 // 8 hours max
  },
  shuffleQuestions: { type: Boolean, default: true },
  shuffleOptions: { type: Boolean, default: true },
  allowReviewAnswers: { type: Boolean, default: true },
  showResultsToCandidate: { type: Boolean, default: false },
  autoSubmitOnTimeUp: { type: Boolean, default: true },
  proctoringSettings: {
    type: ProctoringSettingsSchema,
    required: true,
    default: () => ({})
  },
  passingScore: {
    type: Number,
    min: 0,
    max: 100
  },
  attemptsAllowed: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  }
});

const AssessmentSchema = new Schema<IAssessment>({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  type: {
    type: String,
    enum: ['mcq', 'coding', 'mixed'],
    required: true,
    index: true
  },
  questions: {
    type: [QuestionRefSchema],
    required: true,
    validate: {
      validator: function(questions: IQuestionRef[]) {
        if (questions.length === 0) return false;

        // Check for duplicate question IDs
        const questionIds = questions.map(q => q.questionId.toString());
        const uniqueIds = new Set(questionIds);
        if (uniqueIds.size !== questionIds.length) return false;

        // Check for duplicate orders
        const orders = questions.map(q => q.order);
        const uniqueOrders = new Set(orders);
        return uniqueOrders.size === orders.length;
      },
      message: 'Questions must be unique and have unique order values'
    }
  },
  settings: {
    type: AssessmentSettingsSchema,
    required: true
  },
  instructions: {
    type: String,
    maxlength: 2000
  },
  // Status workflow
  status: {
    type: String,
    enum: ['draft', 'active', 'archived', 'scheduled', 'under_review'],
    default: 'draft',
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: {
    type: Date
  },
  // Metadata
  tags: {
    type: [String],
    default: [],
    index: true
  },
  category: {
    type: String,
    trim: true,
    maxlength: 100,
    index: true
  },
  department: {
    type: String,
    trim: true,
    maxlength: 100,
    index: true
  },
  jobRole: {
    type: String,
    trim: true,
    maxlength: 100,
    index: true
  },
  // Scheduling
  scheduledStartDate: {
    type: Date,
    index: true
  },
  scheduledEndDate: {
    type: Date,
    index: true
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
AssessmentSchema.index({ organizationId: 1, type: 1 });
AssessmentSchema.index({ organizationId: 1, isPublished: 1 });
AssessmentSchema.index({ organizationId: 1, status: 1 });
AssessmentSchema.index({ createdBy: 1 });
AssessmentSchema.index({ isActive: 1 });
AssessmentSchema.index({ scheduledStartDate: 1, scheduledEndDate: 1 });
// Full-text search index
AssessmentSchema.index({ title: 'text', description: 'text', category: 'text', tags: 'text' });

// Pre-save middleware to set publishedAt and sync status
AssessmentSchema.pre<IAssessment>('save', function(next) {
  // Set publishedAt when publishing
  if (this.isModified('isPublished') && this.isPublished && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  // Auto-update status based on isPublished and scheduling
  if (this.isPublished) {
    const now = new Date();
    if (this.scheduledStartDate && this.scheduledStartDate > now) {
      this.status = 'scheduled';
    } else if (this.scheduledEndDate && this.scheduledEndDate < now) {
      this.status = 'archived';
    } else if (this.status === 'draft' || this.status === 'scheduled') {
      this.status = 'active';
    }
  } else {
    // If unpublished, default to draft unless archived
    if (this.status === 'active' || this.status === 'scheduled') {
      this.status = 'draft';
    }
  }

  // Validate scheduling dates
  if (this.scheduledStartDate && this.scheduledEndDate) {
    if (this.scheduledStartDate >= this.scheduledEndDate) {
      return next(new Error('Scheduled start date must be before end date'));
    }
  }

  next();
});

// Virtual for question count
AssessmentSchema.virtual('questionCount').get(function() {
  const questions = Array.isArray(this.questions) ? this.questions : [];
  return questions.length;
});

// Instance method to get total points
AssessmentSchema.methods.getTotalPoints = function(): number {
  return this.questions.reduce((total: number, question: IQuestionRef) => total + question.points, 0);
};

// Instance method to get estimated duration
AssessmentSchema.methods.getEstimatedDuration = async function(): Promise<number> {
  await this.populate('questions.questionId', 'estimatedTimeMinutes');

  const questionDuration = this.questions.reduce((total: number, questionRef: any) => {
    return total + (questionRef.questionId.estimatedTimeMinutes || 5);
  }, 0);

  // Add buffer time (20% of question time or time limit, whichever is lower)
  const bufferTime = Math.min(questionDuration * 0.2, this.settings.timeLimit * 0.2);

  return Math.min(questionDuration + bufferTime, this.settings.timeLimit);
};

// Instance method to check if assessment is expired
AssessmentSchema.methods.isExpired = function(): boolean {
  if (!this.isActive || !this.isPublished) return true;

  const now = new Date();

  // Check if past scheduled end date
  if (this.scheduledEndDate && this.scheduledEndDate < now) {
    return true;
  }

  return false;
};

// Instance method to validate if assessment can be published
AssessmentSchema.methods.canBePublished = async function(): Promise<{valid: boolean; errors: string[]}> {
  const errors: string[] = [];

  // Check if already published
  if (this.isPublished) {
    errors.push('Assessment is already published');
  }

  // Check if has questions
  if (!this.questions || this.questions.length === 0) {
    errors.push('Assessment must have at least one question');
  }

  // Check if all questions are active
  if (this.questions && this.questions.length > 0) {
    const { Question } = await import('./index');
    const questionIds = this.questions.map(q => q.questionId);
    const activeQuestions = await Question.countDocuments({
      _id: { $in: questionIds },
      isActive: true,
      status: 'active'
    });

    if (activeQuestions !== this.questions.length) {
      errors.push('Some questions are inactive or not in active status');
    }
  }

  // Check required settings
  if (!this.settings || !this.settings.timeLimit) {
    errors.push('Assessment must have a time limit');
  }

  if (!this.settings || !this.settings.attemptsAllowed) {
    errors.push('Assessment must specify attempts allowed');
  }

  // Check scheduling validity
  if (this.scheduledStartDate) {
    const now = new Date();
    if (this.scheduledStartDate < now) {
      errors.push('Scheduled start date cannot be in the past');
    }
  }

  if (this.scheduledStartDate && this.scheduledEndDate) {
    if (this.scheduledStartDate >= this.scheduledEndDate) {
      errors.push('Scheduled start date must be before end date');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// Static method to find active assessments by organization
AssessmentSchema.statics.findActiveByOrg = function(organizationId: string) {
  return this.find({
    organizationId,
    isActive: true,
    isPublished: true
  }).populate('createdBy', 'firstName lastName email');
};

// Static method to get assessment with questions populated
AssessmentSchema.statics.findWithQuestions = function(assessmentId: string, includeCorrectAnswers: boolean = false) {
  const selectFields = includeCorrectAnswers
    ? 'title description type difficulty options codingDetails points estimatedTimeMinutes'
    : 'title description type difficulty options points estimatedTimeMinutes';

  return this.findById(assessmentId)
    .populate('questions.questionId', selectFields)
    .populate('createdBy', 'firstName lastName email');
};

export default mongoose.model<IAssessment>('Assessment', AssessmentSchema);
