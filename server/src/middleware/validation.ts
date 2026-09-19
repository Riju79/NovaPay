import { Request, Response, NextFunction } from 'express';
import { isPositiveAmount } from '../utils/money';

export const isValidMidnightAddress = (address: string): boolean => {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim().toLowerCase();
  if (trimmed.length < 10 || trimmed.length > 128) return false;
  if (trimmed.startsWith('mn_') || trimmed.startsWith('addr') || trimmed.startsWith('0x')) return true;
  return /^[a-z0-9_-]{10,128}$/i.test(trimmed);
};

export const isValidTxHash = (hash: string): boolean => {
  if (!hash || typeof hash !== 'string') return false;
  const clean = hash.trim().replace(/^0x/i, '');
  return /^[0-9a-fA-F]{64}$/.test(clean);
};

export const hasPrototypePollution = (obj: any): boolean => {
  if (!obj || typeof obj !== 'object') return false;
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return true;
    }
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      if (hasPrototypePollution(obj[key])) return true;
    }
  }
  return false;
};

/**
 * Higher-order schema validation middleware
 */
export function validateRequestBody(
  rules: Record<
    string,
    {
      required?: boolean;
      type?: 'string' | 'number' | 'boolean' | 'address' | 'amount' | 'txHash' | 'enum';
      enumValues?: string[];
      minLength?: number;
      maxLength?: number;
    }
  >
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({
        error: 'Request body must be a valid JSON object.',
        code: 'INVALID_REQUEST_BODY',
      });
      return;
    }

    if (hasPrototypePollution(req.body)) {
      res.status(400).json({
        error: 'Malicious payload detected (prototype pollution attempt).',
        code: 'SECURITY_VIOLATION',
      });
      return;
    }

    for (const [field, rule] of Object.entries(rules)) {
      const val = req.body[field];

      if (rule.required && (val === undefined || val === null || val === '')) {
        res.status(400).json({
          error: `Missing required field: '${field}'.`,
          code: 'MISSING_REQUIRED_FIELD',
          field,
        });
        return;
      }

      if (val !== undefined && val !== null && val !== '') {
        if (rule.type === 'string' && typeof val !== 'string') {
          res.status(400).json({
            error: `Field '${field}' must be a string.`,
            code: 'INVALID_FIELD_TYPE',
            field,
          });
          return;
        }

        if (rule.type === 'number' && typeof val !== 'number') {
          res.status(400).json({
            error: `Field '${field}' must be a number.`,
            code: 'INVALID_FIELD_TYPE',
            field,
          });
          return;
        }

        if (rule.type === 'address' && !isValidMidnightAddress(String(val))) {
          res.status(400).json({
            error: `Field '${field}' must be a valid Midnight wallet address.`,
            code: 'INVALID_WALLET_ADDRESS',
            field,
          });
          return;
        }

        if (rule.type === 'amount' && !isPositiveAmount(val)) {
          res.status(400).json({
            error: `Field '${field}' must be a positive numeric amount.`,
            code: 'INVALID_AMOUNT',
            field,
          });
          return;
        }

        if (rule.type === 'txHash' && !isValidTxHash(String(val))) {
          res.status(400).json({
            error: `Field '${field}' must be a valid 64-character hexadecimal transaction hash.`,
            code: 'INVALID_TX_HASH',
            field,
          });
          return;
        }

        if (rule.type === 'enum' && rule.enumValues && !rule.enumValues.includes(String(val).toUpperCase())) {
          res.status(400).json({
            error: `Field '${field}' must be one of [${rule.enumValues.join(', ')}].`,
            code: 'INVALID_ENUM_VALUE',
            field,
          });
          return;
        }

        if (rule.minLength && String(val).length < rule.minLength) {
          res.status(400).json({
            error: `Field '${field}' must be at least ${rule.minLength} characters long.`,
            code: 'FIELD_TOO_SHORT',
            field,
          });
          return;
        }

        if (rule.maxLength && String(val).length > rule.maxLength) {
          res.status(400).json({
            error: `Field '${field}' cannot exceed ${rule.maxLength} characters.`,
            code: 'FIELD_TOO_LONG',
            field,
          });
          return;
        }
      }
    }

    next();
  };
}
