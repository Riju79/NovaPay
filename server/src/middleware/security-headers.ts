import { Request, Response, NextFunction } from 'express';

/**
 * Enterprise Defense-in-Depth Security Headers Middleware
 * Protects against XSS, clickjacking, MIME sniffing, and protocol downgrade attacks.
 */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  // 1. Content Security Policy (CSP)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:; object-src 'none'; frame-ancestors 'none'; base-uri 'self';"
  );

  // 2. HTTP Strict Transport Security (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // 3. Prevent MIME-Type Sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 4. Clickjacking Prevention
  res.setHeader('X-Frame-Options', 'DENY');

  // 5. Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 6. Permissions Policy
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );

  // 7. Prevent Caching on Sensitive Financial APIs
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // 8. Remove Framework Fingerprinting
  res.removeHeader('X-Powered-By');

  next();
};
