import { Request, Response, NextFunction } from 'express';
import { SecurityLogger } from '../utils/security-logger';

interface IdempotencyRecord {
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  statusCode?: number;
  responseBody?: any;
  createdAt: number;
  expiresAt: number;
}

export class IdempotencyService {
  private static store = new Map<string, IdempotencyRecord>();
  private static readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  public static clearCache(): void {
    this.store.clear();
  }

  public static acquireLock(key: string): 'ACQUIRED' | 'IN_FLIGHT' | 'COMPLETED' {
    const now = Date.now();
    const existing = this.store.get(key);

    if (existing) {
      if (now > existing.expiresAt) {
        this.store.delete(key);
      } else if (existing.status === 'PROCESSING') {
        return 'IN_FLIGHT';
      } else if (existing.status === 'COMPLETED') {
        return 'COMPLETED';
      }
    }

    this.store.set(key, {
      status: 'PROCESSING',
      createdAt: now,
      expiresAt: now + this.TTL_MS,
    });

    return 'ACQUIRED';
  }

  public static complete(key: string, statusCode: number, responseBody: any): void {
    const record = this.store.get(key);
    if (record) {
      record.status = 'COMPLETED';
      record.statusCode = statusCode;
      record.responseBody = responseBody;
    }
  }

  public static release(key: string): void {
    this.store.delete(key);
  }

  public static getRecord(key: string): IdempotencyRecord | undefined {
    return this.store.get(key);
  }
}

/**
 * Idempotency Middleware for Mutating Financial Requests
 * Intercepts Idempotency-Key header and prevents duplicate executions or race conditions.
 */
export const idempotencyMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const idempotencyKey =
    (req.headers['idempotency-key'] as string) ||
    (req.headers['x-idempotency-key'] as string) ||
    req.body?.idempotencyKey;

  // If no idempotency key is provided, proceed normally
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    return next();
  }

  const cleanKey = idempotencyKey.trim();
  if (cleanKey.length < 8 || cleanKey.length > 128) {
    res.status(400).json({
      error: 'Idempotency-Key header must be between 8 and 128 characters.',
      code: 'INVALID_IDEMPOTENCY_KEY',
    });
    return;
  }

  const userId = (req as any).userId || 'anon';
  const namespacedKey = `idemp_${userId}_${req.method}_${req.baseUrl}${req.path}_${cleanKey}`;

  const lockStatus = IdempotencyService.acquireLock(namespacedKey);

  if (lockStatus === 'IN_FLIGHT') {
    SecurityLogger.warn(
      `Concurrent in-flight duplicate request blocked for idempotency key: ${cleanKey}`,
      req.correlationId,
      { key: cleanKey, userId }
    );
    res.status(409).json({
      error: 'A request with this Idempotency-Key is currently processing. Please do not submit concurrently.',
      code: 'CONCURRENT_REQUEST_CONFLICT',
    });
    return;
  }

  if (lockStatus === 'COMPLETED') {
    const record = IdempotencyService.getRecord(namespacedKey);
    if (record && record.statusCode && record.responseBody) {
      SecurityLogger.info(
        `Returning idempotent cached response for key: ${cleanKey}`,
        req.correlationId
      );
      res.setHeader('X-Idempotent-Replay', 'true');
      res.status(record.statusCode).json(record.responseBody);
      return;
    }
  }

  // Intercept response to cache completed execution
  const originalJson = res.json.bind(res);
  res.json = (body: any): Response => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      IdempotencyService.complete(namespacedKey, res.statusCode, body);
    } else {
      // Release lock on client/server error so client can retry with correct payload
      IdempotencyService.release(namespacedKey);
    }
    return originalJson(body);
  };

  next();
};
