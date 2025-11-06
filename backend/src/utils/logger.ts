import { Request } from 'express';
import { SystemLog, IUserInfo, ILogContext, ISystemLog } from '../models';

const SENSITIVE_KEYS = new Set([
  'password',
  'newPassword',
  'currentPassword',
  'confirmPassword',
  'refreshToken',
  'token',
]);

const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }

  return value;
};

const buildUserInfo = (req: Request): IUserInfo => ({
  userId: (req as any).user?._id,
  email: (req as any).user?.email,
  role: (req as any).user?.role,
  ipAddress: req.ip || (req.connection as any)?.remoteAddress || 'unknown',
  userAgent: req.get('User-Agent') || 'unknown',
});

const buildContext = (req: Request): ILogContext => ({
  organizationId: (req as any).user?.organizationId,
  userId: (req as any).user?._id,
});

interface LogOptions {
  category: ISystemLog['category'];
  action: string;
  message: string;
  error: unknown;
  extra?: Record<string, unknown>;
}

export const logControllerError = async (
  req: Request,
  { category, action, message, error, extra }: LogOptions
): Promise<void> => {
  const errorInfo = error instanceof Error
    ? { message: error.message, stack: error.stack }
    : { message: 'Unknown error' };

  // Emit to stderr for immediate visibility
  console.error(`Controller error [${action}]`, error);

  try {
    await SystemLog.create({
      level: 'error',
      category,
      action,
      message,
      details: {
        ...extra,
        error: errorInfo,
        request: {
          method: req.method,
          url: req.originalUrl,
          params: sanitizeValue(req.params),
          query: sanitizeValue(req.query),
          body: sanitizeValue(req.body),
        },
      },
      context: buildContext(req),
      userInfo: buildUserInfo(req),
      requestDetails: {
        method: req.method,
        url: req.originalUrl,
        headers: {
          'content-type': req.get('Content-Type') || '',
          'user-agent': req.get('User-Agent') || '',
        },
        params: sanitizeValue(req.params) as Record<string, unknown>,
        query: sanitizeValue(req.query) as Record<string, unknown>,
        body: sanitizeValue(req.body),
      },
      timestamp: new Date(),
    });
  } catch (logError) {
    console.error(`Failed to write system log for [${action}]`, logError);
  }
};

export default logControllerError;
