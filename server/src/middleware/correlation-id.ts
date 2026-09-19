import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Distributed Correlation & Request ID Middleware
 * Ensures every incoming request is assigned a unique, untampered correlation ID.
 */
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const incomingId =
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-request-id'] as string);

  // Validate format if provided (UUID or alphanumeric 16-64 chars), else generate fresh
  const correlationId =
    incomingId && /^[a-zA-Z0-9_-]{16,64}$/.test(incomingId)
      ? incomingId
      : `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  res.setHeader('X-Request-ID', correlationId);

  next();
};
