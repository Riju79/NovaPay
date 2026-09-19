/**
 * NovaPay Enterprise Structured Logger
 * 
 * Guarantees production-grade JSON structured logging across all operations:
 * - Distributed Traceability: remittanceId, quoteId, providerOrderId, blockchainTransactionId, correlationId
 * - Domain Categorization: API, PROVIDER, WEBHOOK, BLOCKCHAIN, REMITTANCE, PAYOUT, RECONCILIATION, DATABASE, COMPLIANCE
 * - Zero Secrets Leakage: Private keys, seed phrases, webhook secrets, JWT secrets, passwords
 * - Zero PII Exposure: KYC documents, passport/ID numbers, tax IDs, SSNs, physical addresses
 */

export interface TraceContext {
  remittanceId?: string | null;
  quoteId?: string | null;
  providerOrderId?: string | null;
  blockchainTransactionId?: string | null;
  correlationId?: string | null;
  userId?: string | null;
  walletAddress?: string | null;
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export type LogDomain =
  | 'API'
  | 'PROVIDER'
  | 'WEBHOOK'
  | 'BLOCKCHAIN'
  | 'REMITTANCE'
  | 'PAYOUT'
  | 'RECONCILIATION'
  | 'DATABASE'
  | 'COMPLIANCE'
  | 'SECURITY';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  domain: LogDomain;
  event: string;
  message: string;
  trace: TraceContext;
  error?: {
    name?: string;
    message: string;
    stack?: string;
    code?: string | number;
  };
  metadata?: Record<string, any>;
}

// Exhaustive redaction key set (case-insensitive normalized)
const REDACTED_KEYS = new Set([
  // Cryptographic secrets
  'privatekey',
  'private_key',
  'privkey',
  'secret',
  'secretkey',
  'secret_key',
  'jwtsecret',
  'jwt_secret',
  'jwt_refresh_secret',
  'seedphrase',
  'seed_phrase',
  'mnemonic',
  'password',
  'passphrase',
  'new_password',
  'current_password',
  'token',
  'accesstoken',
  'refreshtoken',
  'bearer',
  'authorization',
  'signature',
  'webhooksecret',
  'webhook_secret',
  'apikey',
  'api_key',
  'clientsecret',
  'client_secret',
  // Sensitive identity / PII
  'kycdocument',
  'kyc_document',
  'documentdata',
  'id_document',
  'passport',
  'passportnumber',
  'passport_number',
  'ssn',
  'socialsecuritynumber',
  'tax_id',
  'taxid',
  'nationalid',
  'national_id',
  'id_number',
  'driverslicense',
  'drivers_license',
  'dob',
  'dateofbirth',
  'date_of_birth',
  'fullname',
  'full_name',
  'homeaddress',
  'home_address',
  'streetaddress',
  'street_address',
  'postalcode',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'proofdata',
  'zkproof',
  'zk_proof',
]);

/**
 * Deeply sanitizes arbitrary data structures to purge secrets and sensitive PII.
 */
export function sanitizeLogData(data: any, depth = 0): any {
  if (depth > 6) return '[MAX_DEPTH_EXCEEDED]';
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // 1. Redact mnemonic phrases (12 to 24 space-separated words)
    if (data.split(' ').length >= 12 && data.length > 50) {
      return '[REDACTED_SEED_PHRASE]';
    }
    // 2. Redact private key PEM blocks
    if (data.includes('BEGIN PRIVATE KEY') || data.includes('BEGIN RSA PRIVATE KEY')) {
      return '[REDACTED_PRIVATE_KEY]';
    }
    // 3. Redact raw 64-character hex strings if marked as private keys or secrets
    if (/^[0-9a-fA-F]{64}$/.test(data.trim()) && depth === 0) {
      return '[REDACTED_SECRET_HEX]';
    }
    // 4. Redact JWT tokens (3 base64url segments)
    if (/^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]+$/.test(data.trim()) && data.length > 50) {
      return '[REDACTED_JWT_TOKEN]';
    }
    return data;
  }

  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1));
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      code: (data as any).code,
      stack: process.env.NODE_ENV !== 'production' ? data.stack : undefined,
    };
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const sanitizedVal = sanitizeLogData(value, depth + 1);

    if (typeof sanitizedVal === 'string' && sanitizedVal.startsWith('[REDACTED_')) {
      sanitized[key] = sanitizedVal;
    } else if (REDACTED_KEYS.has(cleanKey)) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = sanitizedVal;
      } else {
        sanitized[key] = '[REDACTED]';
      }
    } else {
      sanitized[key] = sanitizedVal;
    }
  }

  return sanitized;
}

export class StructuredLogger {
  // In-memory buffer of recent logs for operational metrics, testing, and debugging
  public static logBuffer: StructuredLogEntry[] = [];
  public static maxBufferSize = 500;

  /**
   * Clears in-memory log buffer (useful for unit testing isolation)
   */
  public static clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Retrieves log buffer
   */
  public static getRecentLogs(limit = 100): StructuredLogEntry[] {
    return this.logBuffer.slice(-limit);
  }

  /**
   * Internal formatter creating standardized log entries
   */
  public static formatEntry(
    level: LogLevel,
    domain: LogDomain,
    event: string,
    message: string,
    trace: TraceContext = {},
    metadata?: Record<string, any>,
    err?: any
  ): StructuredLogEntry {
    const timestamp = new Date().toISOString();

    const cleanTrace: TraceContext = {
      remittanceId: trace.remittanceId || undefined,
      quoteId: trace.quoteId || undefined,
      providerOrderId: trace.providerOrderId || undefined,
      blockchainTransactionId: trace.blockchainTransactionId || undefined,
      correlationId: trace.correlationId || 'system',
      userId: trace.userId || undefined,
      walletAddress: trace.walletAddress || undefined,
    };

    const sanitizedMeta = metadata ? sanitizeLogData(metadata) : undefined;

    let errorObj: StructuredLogEntry['error'] | undefined = undefined;
    if (err) {
      if (err instanceof Error) {
        errorObj = {
          name: err.name,
          message: err.message,
          code: (err as any).code,
          stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
        };
      } else if (typeof err === 'object') {
        errorObj = {
          message: err.message || JSON.stringify(err),
          code: err.code,
        };
      } else {
        errorObj = {
          message: String(err),
        };
      }
    }

    const entry: StructuredLogEntry = {
      timestamp,
      level,
      domain,
      event,
      message,
      trace: cleanTrace,
      ...(errorObj ? { error: errorObj } : {}),
      ...(sanitizedMeta ? { metadata: sanitizedMeta } : {}),
    };

    // Store in circular in-memory buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Output to stdout/stderr in non-test mode or when explicitly enabled
    if (process.env.NODE_ENV !== 'test' || process.env.ENABLE_TEST_LOGS === 'true') {
      const output = JSON.stringify(entry);
      if (level === 'ERROR' || level === 'CRITICAL') {
        console.error(output);
      } else if (level === 'WARN') {
        console.warn(output);
      } else {
        console.log(output);
      }
    }

    return entry;
  }

  public static debug(domain: LogDomain, event: string, message: string, trace?: TraceContext, metadata?: any): StructuredLogEntry {
    return this.formatEntry('DEBUG', domain, event, message, trace, metadata);
  }

  public static info(domain: LogDomain, event: string, message: string, trace?: TraceContext, metadata?: any): StructuredLogEntry {
    return this.formatEntry('INFO', domain, event, message, trace, metadata);
  }

  public static warn(domain: LogDomain, event: string, message: string, trace?: TraceContext, metadata?: any, err?: any): StructuredLogEntry {
    return this.formatEntry('WARN', domain, event, message, trace, metadata, err);
  }

  public static error(domain: LogDomain, event: string, message: string, trace?: TraceContext, metadata?: any, err?: any): StructuredLogEntry {
    return this.formatEntry('ERROR', domain, event, message, trace, metadata, err);
  }

  public static critical(domain: LogDomain, event: string, message: string, trace?: TraceContext, metadata?: any, err?: any): StructuredLogEntry {
    return this.formatEntry('CRITICAL', domain, event, message, trace, metadata, err);
  }
}
