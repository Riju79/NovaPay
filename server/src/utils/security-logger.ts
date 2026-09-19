/**
 * Enterprise Sanitizing Security Logger
 * Strictly prevents exposure of private keys, seed phrases, KYC documents,
 * credentials, and cryptographic tokens across application logs.
 */

const REDACTED_KEYS = new Set([
  'privatekey',
  'private_key',
  'privkey',
  'secret',
  'jwtsecret',
  'jwt_secret',
  'secretkey',
  'seedphrase',
  'seed_phrase',
  'mnemonic',
  'password',
  'new_password',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'signature',
  'webhooksecret',
  'xdr',
  'kycdocument',
  'kyc_document',
  'ssn',
  'tax_id',
  'id_number',
  'passport',
  'proofdata',
  'zkproof',
]);

export function sanitizeLogData(data: any, depth = 0): any {
  if (depth > 6) return '[MAX_DEPTH_EXCEEDED]';
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Redact mnemonic-like sequences (12-24 space-separated words)
    if (data.split(' ').length >= 12 && data.length > 50) {
      return '[REDACTED_SEED_PHRASE]';
    }
    // Redact private key PEM or hex
    if (data.includes('BEGIN PRIVATE KEY') || /^[0-9a-fA-F]{64}$/.test(data.trim())) {
      return '[REDACTED_KEY_MATERIAL]';
    }
    // Redact JWT-like strings
    if (/^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/.test(data.trim()) && data.length > 60) {
      return '[REDACTED_JWT_TOKEN]';
    }
    return data;
  }

  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (REDACTED_KEYS.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeLogData(value, depth + 1);
    }
  }

  return sanitized;
}

export class SecurityLogger {
  private static formatLog(level: 'INFO' | 'WARN' | 'ERROR' | 'SECURITY', message: string, correlationId?: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const sanitizedMeta = meta ? sanitizeLogData(meta) : undefined;
    return {
      timestamp,
      level,
      correlationId: correlationId || 'system',
      message,
      ...(sanitizedMeta ? { metadata: sanitizedMeta } : {}),
    };
  }

  public static info(message: string, correlationId?: string, meta?: any): void {
    const entry = this.formatLog('INFO', message, correlationId, meta);
    if (process.env.NODE_ENV !== 'test') {
      console.log(JSON.stringify(entry));
    }
  }

  public static warn(message: string, correlationId?: string, meta?: any): void {
    const entry = this.formatLog('WARN', message, correlationId, meta);
    if (process.env.NODE_ENV !== 'test') {
      console.warn(JSON.stringify(entry));
    }
  }

  public static error(message: string, correlationId?: string, meta?: any): void {
    const entry = this.formatLog('ERROR', message, correlationId, meta);
    if (process.env.NODE_ENV !== 'test') {
      console.error(JSON.stringify(entry));
    }
  }

  public static security(event: string, correlationId?: string, meta?: any): void {
    const entry = this.formatLog('SECURITY', `[AUDIT_EVENT] ${event}`, correlationId, meta);
    if (process.env.NODE_ENV !== 'test') {
      console.warn(JSON.stringify(entry));
    }
  }
}
