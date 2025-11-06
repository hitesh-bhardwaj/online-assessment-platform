import mongoose, { Document, Schema } from 'mongoose';

export interface IOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface ITestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  weight: number;
}

export interface ICodingDetails {
  language: 'javascript' | 'python' | 'java' | 'cpp' | 'csharp';
  starterCode?: string;
  solution?: string;
  testCases: ITestCase[];
  timeLimit: number; // in seconds
  memoryLimit: number; // in MB
}

export interface IQuestion extends Document {
  organizationId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  type: 'mcq' | 'msq' | 'coding';
  difficulty: 'easy' | 'medium' | 'hard';
  category?: string;
  tags: string[];

  // For MCQ/MSQ questions
  options?: IOption[];
  explanation?: string;

  // For coding questions
  codingDetails?: ICodingDetails;

  points: number;
  estimatedTimeMinutes: number;
  isActive: boolean;
  status: 'draft' | 'active' | 'archived' | 'under_review';
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  validateAnswer(answer: any): boolean;
  getCorrectAnswers(): string[] | null;
}

const OptionSchema = new Schema<IOption>({
  id: { type: String, required: true },
  text: { type: String, required: true, maxlength: 500 },
  isCorrect: { type: Boolean, required: true, default: false }
});

const TestCaseSchema = new Schema<ITestCase>({
  input: { type: String, required: true },
  expectedOutput: { type: String, required: true },
  isHidden: { type: Boolean, default: false },
  weight: { type: Number, default: 1, min: 0.1 }
});

const CodingDetailsSchema = new Schema<ICodingDetails>({
  language: {
    type: String,
    enum: ['javascript', 'python', 'java', 'cpp', 'csharp'],
    required: true
  },
  starterCode: { type: String },
  solution: { type: String, select: false },
  testCases: {
    type: [TestCaseSchema],
    required: true,
    validate: {
      validator: function(testCases: ITestCase[]) {
        if (testCases.length === 0) return false;
        // Validate that total weight is greater than 0
        const totalWeight = testCases.reduce((sum, tc) => sum + tc.weight, 0);
        return totalWeight > 0;
      },
      message: 'At least one test case is required and total weight must be greater than 0'
    }
  },
  timeLimit: { type: Number, required: true, default: 30, min: 1, max: 300 },
  memoryLimit: { type: Number, required: true, default: 128, min: 32, max: 512 }
});

const QuestionSchema = new Schema<IQuestion>({
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
    required: true,
    maxlength: 2000
  },
  type: {
    type: String,
    enum: ['mcq', 'msq', 'coding'],
    required: true,
    index: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    required: true,
    index: true
  },
  category: {
    type: String,
    trim: true,
    maxlength: 100,
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 50
  }],
  options: {
    type: [OptionSchema],
    validate: {
      validator: function(options: IOption[]) {
        if (this.type === 'mcq' || this.type === 'msq') {
          if (!options || options.length < 2) return false;
          const correctCount = options.filter(opt => opt.isCorrect).length;
          if (this.type === 'mcq' && correctCount !== 1) return false;
          if (this.type === 'msq' && correctCount === 0) return false;
        }
        return true;
      },
      message: 'Invalid options configuration for question type'
    }
  },
  explanation: {
    type: String,
    maxlength: 1000
  },
  codingDetails: {
    type: CodingDetailsSchema,
    validate: {
      validator: function(codingDetails: ICodingDetails) {
        return this.type === 'coding' ? !!codingDetails : true;
      },
      message: 'Coding details are required for coding questions'
    }
  },
  points: {
    type: Number,
    required: true,
    min: 1,
    max: 100,
    default: 1
  },
  estimatedTimeMinutes: {
    type: Number,
    required: true,
    min: 1,
    max: 120,
    default: 5
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'archived', 'under_review'],
    default: 'active',
    index: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      // Don't expose solution in JSON output
      if (ret.codingDetails?.solution) {
        delete ret.codingDetails.solution;
      }
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes
QuestionSchema.index({ organizationId: 1, type: 1 });
QuestionSchema.index({ organizationId: 1, difficulty: 1 });
QuestionSchema.index({ organizationId: 1, category: 1 });
QuestionSchema.index({ organizationId: 1, status: 1 });
QuestionSchema.index({ tags: 1 });
QuestionSchema.index({ createdBy: 1 });
QuestionSchema.index({ isActive: 1 });
// Full-text search index
QuestionSchema.index({ title: 'text', description: 'text', category: 'text' });

// Virtual for question complexity score
QuestionSchema.virtual('complexityScore').get(function() {
  const difficultyWeights = { easy: 1, medium: 2, hard: 3 };
  const typeWeights = { mcq: 1, msq: 1.5, coding: 3 };
  return difficultyWeights[this.difficulty] * typeWeights[this.type];
});

// Helper function to get default estimated time based on type and difficulty
const getDefaultEstimatedTime = (type: string, difficulty: string): number => {
  const timeDefaults: Record<string, Record<string, number>> = {
    mcq: { easy: 2, medium: 3, hard: 5 },
    msq: { easy: 3, medium: 5, hard: 7 },
    coding: { easy: 15, medium: 30, hard: 45 }
  };
  return timeDefaults[type]?.[difficulty] || 5;
};

// Pre-save hook to set default estimated time if not provided
QuestionSchema.pre<IQuestion>('save', function(next) {
  if (this.isNew && !this.estimatedTimeMinutes) {
    this.estimatedTimeMinutes = getDefaultEstimatedTime(this.type, this.difficulty);
  }
  next();
});

// Instance method to validate answer
QuestionSchema.methods.validateAnswer = function(answer: any): boolean {
  if (this.type === 'mcq') {
    const correctOption = this.options.find((opt: IOption) => opt.isCorrect);
    return correctOption?.id === answer;
  }

  if (this.type === 'msq') {
    const correctIds = this.options.filter((opt: IOption) => opt.isCorrect).map((opt: IOption) => opt.id);
    const answerArray = Array.isArray(answer) ? answer : [answer];
    return correctIds.length === answerArray.length &&
           correctIds.every((id: string) => answerArray.includes(id));
  }

  // For coding questions, validation happens during code execution
  return false;
};

// Instance method to get correct answers
QuestionSchema.methods.getCorrectAnswers = function(): string[] | null {
  if (this.type === 'mcq') {
    const correctOption = this.options.find((opt: IOption) => opt.isCorrect);
    return correctOption ? [correctOption.id] : null;
  }

  if (this.type === 'msq') {
    return this.options.filter((opt: IOption) => opt.isCorrect).map((opt: IOption) => opt.id);
  }

  // For coding questions, return null as answers are validated by test cases
  return null;
};

// Static method to get questions by organization and filters
QuestionSchema.statics.findByFilters = function(organizationId: string, filters: any = {}) {
  const query: any = { organizationId, isActive: true };

  if (filters.type) query.type = filters.type;
  if (filters.difficulty) query.difficulty = filters.difficulty;
  if (filters.category) query.category = filters.category;
  if (filters.status) query.status = filters.status;
  if (filters.tags && filters.tags.length > 0) query.tags = { $in: filters.tags };

  return this.find(query);
};

export default mongoose.model<IQuestion>('Question', QuestionSchema);
