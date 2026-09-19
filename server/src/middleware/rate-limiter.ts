import { Request, Response, NextFunction } from 'express';
import { SecurityLogger } from '../utils/security-logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  message?: string;
}

export class RateLimiterStore {
  private static instances = new Map<string, Map<string, RateLimitEntry>>();

  public static getStore(prefix: string): Map<string, RateLimitEntry> {
    if (!this.instances.has(prefix)) {
      this.instances.set(prefix, new Map<string, RateLimitEntry>());
    }
    return this.instances.get(prefix)!;
  }

  public static clearAll(): void {
    for (const store of this.instances.values()) {
      store.clear();
    }
  }
}

export function createRateLimiter(options: RateLimiterOptions) {
  const store = RateLimiterStore.getStore(options.keyPrefix);

  return (req: Request, res: Response, next: NextFunction): void => {
    // In automated test runs where rapid execution is required, allow skipping unless testing rate limiter specifically
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown_ip';

    const userId = (req as any).userId || clientIp;
    const key = `${options.keyPrefix}_${userId}`;
    const now = Date.now();

    let entry = store.get(key);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + options.windowMs,
      };
      store.set(key, entry);
    } else {
      entry.count += 1;
    }

    const remaining = Math.max(0, options.maxRequests - entry.count);
    const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    if (entry.count > options.maxRequests) {
      res.setHeader('Retry-After', retryAfterSeconds);
      SecurityLogger.warn(
        `Rate limit exceeded for key ${key}: ${entry.count}/${options.maxRequests} in window ${options.windowMs}ms`,
        req.correlationId,
        { ip: clientIp, path: req.path, method: req.method }
      );

      res.status(429).json({
        error: options.message || 'Too many requests. Please slow down and try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: retryAfterSeconds,
      });
      return;
    }

    next();
  };
}

// 1. Global API Rate Limiter (120 requests/minute)
export const globalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
  keyPrefix: 'global',
  message: 'Global rate limit exceeded. Please throttle your requests.',
});

// 2. Strict Auth Rate Limiter (15 requests/15 minutes)
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 15,
  keyPrefix: 'auth',
  message: 'Authentication rate limit exceeded. Please wait before trying again.',
});

// 3. Sensitive Financial Transactions Limiter (30 requests/minute)
export const financialRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  keyPrefix: 'financial',
  message: 'Transaction request velocity limit exceeded. Please wait before initiating new payments.',
});

// 4. Webhook Rate Limiter (60 requests/minute)
export const webhookRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyPrefix: 'webhook',
  message: 'Webhook intake limit exceeded.',
});
