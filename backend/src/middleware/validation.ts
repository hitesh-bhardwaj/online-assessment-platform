import { Request, Response, NextFunction } from 'express';
import { validationResult, checkSchema, Schema, ParamSchema } from 'express-validator';
import { SystemLog } from '../models';

// Helper function to get user info for logging
const getUserInfo = (req: Request) => ({
  userId: (req as any).user?._id,
  email: (req as any).user?.email,
  role: (req as any).user?.role,
  ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
  userAgent: req.get('User-Agent') || 'unknown'
});

type LocationKey = 'body' | 'query' | 'params' | 'cookies' | 'headers';

type LegacySchema = Partial<Record<LocationKey, Schema>> & {
  [key: string]: ParamSchema | Schema | undefined;
};

const locationKeys: LocationKey[] = ['body', 'query', 'params', 'cookies', 'headers'];

const isLegacySchema = (schema: Schema | LegacySchema): schema is LegacySchema => {
  return locationKeys.some((key) => Object.prototype.hasOwnProperty.call(schema, key));
};

const normalizeSchema = (schema: Schema | LegacySchema): Schema => {
  if (!isLegacySchema(schema)) {
    return schema;
  }

  const normalized: Schema = {};

  for (const location of locationKeys) {
    const section = schema[location];
    if (section && typeof section === 'object') {
      Object.entries(section as Schema).forEach(([field, config]) => {
        const paramConfig = config as ParamSchema;
        const existingIn = Array.isArray(paramConfig.in)
          ? paramConfig.in
          : paramConfig.in
            ? [paramConfig.in]
            : undefined;

        normalized[field] = {
          ...paramConfig,
          in: existingIn ?? [location]
        };
      });
    }
  }

  Object.entries(schema).forEach(([field, config]) => {
    if (!locationKeys.includes(field as LocationKey) && config && typeof config === 'object') {
      normalized[field] = { ...(config as ParamSchema) };
    }
  });

  return normalized;
};

// Middleware to validate request using express-validator schemas
export const validateRequest = (schema: Schema | LegacySchema) => {
  const chains = checkSchema(normalizeSchema(schema));

  return [
    ...chains,
    async (req: Request, res: Response, next: NextFunction) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        // Log validation errors for security monitoring
        await SystemLog.create({
          level: 'warn',
          category: 'system',
          action: 'validation_failed',
          message: 'Request validation failed',
          details: {
            errors: errors.array(),
            path: req.path,
            method: req.method
          },
          context: {
            organizationId: (req as any).user?.organizationId
          },
          userInfo: getUserInfo(req),
          timestamp: new Date()
        });

        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array().map(error => ({
            field: error.type === 'field' ? error.path : 'unknown',
            message: error.msg,
            value: error.type === 'field' ? error.value : undefined
          }))
        });
      }

      next();
    }
  ];
};

// Common validation schemas
export const commonSchemas = {
  objectId: {
    isMongoId: true,
    errorMessage: 'Must be a valid MongoDB ObjectId'
  },

  email: {
    isEmail: true,
    normalizeEmail: true,
    errorMessage: 'Must be a valid email address'
  },

  password: {
    isLength: { options: { min: 8, max: 128 } },
    matches: {
      options: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      errorMessage: 'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    },
    errorMessage: 'Password must be between 8 and 128 characters'
  },

  name: {
    isLength: { options: { min: 1, max: 100 } },
    trim: true,
    escape: true,
    errorMessage: 'Name must be between 1 and 100 characters'
  },

  title: {
    isLength: { options: { min: 1, max: 200 } },
    trim: true,
    escape: true,
    errorMessage: 'Title must be between 1 and 200 characters'
  },

  description: {
    optional: true,
    isLength: { options: { max: 2000 } },
    trim: true,
    errorMessage: 'Description must be less than 2000 characters'
  },

  pagination: {
    page: {
      optional: true,
      isInt: { options: { min: 1 } },
      toInt: true,
      errorMessage: 'Page must be a positive integer'
    },
    limit: {
      optional: true,
      isInt: { options: { min: 1, max: 100 } },
      toInt: true,
      errorMessage: 'Limit must be between 1 and 100'
    }
  }
};

// Validation schema for MongoDB ObjectId parameters
export const validateObjectId = (paramName: string) => ({
  [paramName]: commonSchemas.objectId
});

// Validation middleware for pagination
export const validatePagination = validateRequest({
  page: {
    optional: true,
    isInt: { options: { min: 1 } },
    toInt: true,
    errorMessage: 'Page must be a positive integer'
  },
  limit: {
    optional: true,
    isInt: { options: { min: 1, max: 100 } },
    toInt: true,
    errorMessage: 'Limit must be between 1 and 100'
  }
});

// Custom validation functions
export const customValidators = {
  // Validate array of ObjectIds
  isObjectIdArray: (value: any) => {
    if (!Array.isArray(value)) return false;
    return value.every((id: any) => /^[0-9a-fA-F]{24}$/.test(id));
  },

  // Validate assessment type
  isAssessmentType: (value: string) => {
    return ['mcq', 'coding', 'mixed'].includes(value);
  },

  // Validate question type
  isQuestionType: (value: string) => {
    return ['mcq', 'msq', 'coding'].includes(value);
  },

  // Validate difficulty level
  isDifficulty: (value: string) => {
    return ['easy', 'medium', 'hard'].includes(value);
  },

  // Validate programming language
  isLanguage: (value: string) => {
    return ['javascript', 'python', 'java', 'cpp', 'csharp'].includes(value);
  },

  // Validate role
  isRole: (value: string) => {
    return ['admin', 'recruiter'].includes(value);
  },

  // Validate invitation status
  isInvitationStatus: (value: string) => {
    return ['pending', 'started', 'submitted', 'expired', 'cancelled'].includes(value);
  },

  // Validate phone number
  isPhoneNumber: (value: string) => {
    return /^[\+]?[1-9][\d]{0,15}$/.test(value);
  },

  // Validate URL
  isValidUrl: (value: string) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  // Validate date range
  isValidDateRange: (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return start < end;
  }
};

// Middleware to sanitize input
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Remove any potential XSS or injection attempts
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      // Basic XSS protection
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }

    return obj;
  };

  req.body = sanitizeObject(req.body);

  // Create a new query object instead of trying to modify req.query
  const sanitizedQuery = sanitizeObject(req.query);
  (req as any).sanitizedQuery = sanitizedQuery;

  req.params = sanitizeObject(req.params);

  next();
};

// Middleware to log validation errors
export const logValidationErrors = async (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    await SystemLog.create({
      level: 'warn',
      category: 'system',
      action: 'validation_error',
      message: 'Request validation failed',
      details: {
        errors: errors.array(),
        method: req.method,
        url: req.url,
        body: req.body,
        query: req.query
      },
      context: {
        organizationId: (req as any).user?.organizationId,
        userId: (req as any).user?._id
      },
      userInfo: getUserInfo(req),
      timestamp: new Date()
    });
  }

  next();
};

// File upload validation
export const validateFileUpload = (allowedMimeTypes: string[], maxSizeBytes: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const file = (req as any).file;
    if (!file) {
      return next();
    }

    // Check file type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`
      });
    }

    // Check file size
    if (file.size > maxSizeBytes) {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size: ${maxSizeBytes} bytes`
      });
    }

    next();
  };
};

export default {
  validateRequest,
  validateObjectId,
  validatePagination,
  commonSchemas,
  customValidators,
  sanitizeInput,
  logValidationErrors,
  validateFileUpload
};
