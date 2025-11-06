import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db';
import { sanitizeInput } from './middleware/validation';
import { SystemLog } from './models';
import { scheduleProctoringMediaCleanup } from './jobs/mediaCleanupScheduler';

// Import routes
import authRoutes from './routes/auth';
import organizationRoutes from './routes/organizations';
import userRoutes from './routes/users';
import assessmentRoutes from './routes/assessments';
import questionRoutes from './routes/questions';
import invitationRoutes from './routes/invitations';
import resultRoutes from './routes/results';
import signupRoutes from './routes/signup';
import candidateRoutes from './routes/candidate';

dotenv.config();
connectDB();

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization - temporarily disabled due to req.query readonly issue
// app.use(sanitizeInput);

// Request logging middleware
app.use(async (req, res, next) => {
  const startTime = Date.now();

  // Log request
  res.on('finish', async () => {
    const executionTime = Date.now() - startTime;

    try {
      await (SystemLog as any).logRequest(
        req.method,
        req.originalUrl,
        res.statusCode,
        executionTime,
        {
          userId: (req as any).user?._id,
          email: (req as any).user?.email,
          role: (req as any).user?.role,
          ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown'
        },
        {
          organizationId: (req as any).user?.organizationId
        },
        {
          method: req.method,
          url: req.originalUrl,
          headers: {
            'content-type': req.get('Content-Type') || '',
            'user-agent': req.get('User-Agent') || ''
          }
        }
      );
    } catch (error) {
      console.error('Failed to log request:', error);
    }
  });

  next();
});

// Health check endpoint
app.get('/api/health', (_, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/signup', signupRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/candidate', candidateRoutes);

// TODO: Add remaining routes
// app.use('/api/code', codeExecutionRoutes);
// app.use('/api/proctoring', proctoringRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', err);

  // Log error
  SystemLog.create({
    level: 'error',
    category: 'system',
    action: 'global_error',
    message: 'Unhandled error occurred',
    details: {
      error: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method
    },
    context: {
      organizationId: (req as any).user?.organizationId,
      userId: (req as any).user?._id
    },
    userInfo: {
      userId: (req as any).user?._id,
      email: (req as any).user?.email,
      role: (req as any).user?.role,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown'
    },
    timestamp: new Date()
  }).catch(console.error);

  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);

  if (process.env.NODE_ENV !== 'test') {
    scheduleProctoringMediaCleanup();
  }
});
