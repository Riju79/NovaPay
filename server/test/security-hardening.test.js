/**
 * NovaPay Phase 14 Test Suite: Complete Security Hardening & Audit Verification
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

// Configure test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'novapay_test_jwt_secret_token_32chars_minimum!';
process.env.MIDNIGHT_NETWORK = 'preview';
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:3001,https://app.novapay.finance';

const { securityHeaders } = require('../build/middleware/security-headers');
const { correlationIdMiddleware } = require('../build/middleware/correlation-id');
const { createRateLimiter, RateLimiterStore } = require('../build/middleware/rate-limiter');
const { IdempotencyService, idempotencyMiddleware } = require('../build/middleware/idempotency');
const { sanitizeLogData, SecurityLogger } = require('../build/utils/security-logger');
const {
  isValidMidnightAddress,
  isValidTxHash,
  hasPrototypePollution,
  validateRequestBody,
} = require('../build/middleware/validation');

const { OnRampService } = require('../build/services/onramp/onramp.service');
const { OffRampService } = require('../build/services/offramp/offramp.service');
const { RemittanceService } = require('../build/services/remittance/remittance.service');
const { DIDService } = require('../build/services/identity/did.service');
const { VCService } = require('../build/services/identity/vc.service');

describe('NovaPay Phase 14: Complete Security Hardening', () => {
  beforeEach(() => {
    RateLimiterStore.clearAll();
    IdempotencyService.clearCache();
    OnRampService.clearCache();
    OffRampService.clearCache();
    RemittanceService.clearCache();
  });

  // 1. SECURITY HEADERS
  describe('1. Defense-in-Depth HTTP Security Headers', () => {
    test('Enforces CSP, HSTS, X-Content-Type-Options, X-Frame-Options, and strips X-Powered-By', () => {
      const headers = {};
      const res = {
        setHeader: (key, val) => {
          headers[key.toLowerCase()] = val;
        },
        removeHeader: (key) => {
          delete headers[key.toLowerCase()];
        },
      };
      headers['x-powered-by'] = 'Express';

      securityHeaders({}, res, () => {});

      assert.strictEqual(headers['x-content-type-options'], 'nosniff');
      assert.strictEqual(headers['x-frame-options'], 'DENY');
      assert.strictEqual(headers['referrer-policy'], 'strict-origin-when-cross-origin');
      assert.ok(headers['content-security-policy'].includes("default-src 'self'"));
      assert.ok(headers['strict-transport-security'].includes('max-age=31536000'));
      assert.strictEqual(headers['x-powered-by'], undefined);
    });
  });

  // 2. CORRELATION ID
  describe('2. Correlation & Request ID Middleware', () => {
    test('Generates cryptographic correlation ID when absent', () => {
      const req = { headers: {} };
      const headers = {};
      const res = {
        setHeader: (k, v) => {
          headers[k] = v;
        },
      };

      correlationIdMiddleware(req, res, () => {});

      assert.ok(req.correlationId);
      assert.ok(req.correlationId.startsWith('req_'));
      assert.strictEqual(headers['X-Correlation-ID'], req.correlationId);
    });

    test('Propagates existing valid correlation ID from client header', () => {
      const existingId = 'req_trace_client_session_1234567890';
      const req = { headers: { 'x-correlation-id': existingId } };
      const headers = {};
      const res = {
        setHeader: (k, v) => {
          headers[k] = v;
        },
      };

      correlationIdMiddleware(req, res, () => {});

      assert.strictEqual(req.correlationId, existingId);
      assert.strictEqual(headers['X-Correlation-ID'], existingId);
    });
  });

  // 3. RATE LIMITING
  describe('3. Rate Limiting Protection', () => {
    test('Allows requests under quota and enforces 429 when quota is exceeded', () => {
      const testLimiter = createRateLimiter({
        windowMs: 60 * 1000,
        maxRequests: 3,
        keyPrefix: 'test_sec_limit',
      });

      let statusCode = 200;
      let responseBody = null;
      const headers = {};

      const makeReq = () => {
        const req = {
          headers: { 'x-forwarded-for': '198.51.100.42', 'x-test-rate-limit': 'true' },
          socket: {},
          path: '/api/test',
          method: 'POST',
        };
        const res = {
          setHeader: (k, v) => {
            headers[k] = v;
          },
          status: (code) => {
            statusCode = code;
            return {
              json: (b) => {
                responseBody = b;
              },
            };
          },
        };

        testLimiter(req, res, () => {
          statusCode = 200;
        });
        return { statusCode, responseBody };
      };

      // Calls 1, 2, 3 should pass
      assert.strictEqual(makeReq().statusCode, 200);
      assert.strictEqual(makeReq().statusCode, 200);
      assert.strictEqual(makeReq().statusCode, 200);

      // Call 4 should be rejected with 429
      const blocked = makeReq();
      assert.strictEqual(blocked.statusCode, 429);
      assert.strictEqual(blocked.responseBody.code, 'RATE_LIMIT_EXCEEDED');
      assert.ok(headers['Retry-After']);
    });
  });

  // 4. SANITIZED LOGGING & SECRET PROTECTION
  describe('4. Sanitized Logging & Zero Secret Leakage', () => {
    test('Redacts private keys, seed phrases, passwords, and tokens recursively', () => {
      const rawData = {
        user: 'alice',
        password: 'SuperSecretPassword123!',
        jwt_secret: 'novapay_jwt_secret_token_value',
        privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        seedPhrase: 'apple banana cherry dog elephant fox grape horse igloo jaguar kite lemon',
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        nested: {
          token: 'sensitive_jwt_token',
          passport: 'P12345678',
        },
      };

      const sanitized = sanitizeLogData(rawData);

      assert.strictEqual(sanitized.user, 'alice');
      assert.strictEqual(sanitized.password, '[REDACTED]');
      assert.strictEqual(sanitized.jwt_secret, '[REDACTED]');
      assert.strictEqual(sanitized.privateKey, '[REDACTED]');
      assert.strictEqual(sanitized.seedPhrase, '[REDACTED]');
      assert.strictEqual(sanitized.authorization, '[REDACTED]');
      assert.strictEqual(sanitized.nested.token, '[REDACTED]');
      assert.strictEqual(sanitized.nested.passport, '[REDACTED]');
    });
  });

  // 5. SCHEMA VALIDATION & PROTOTYPE POLLUTION
  describe('5. Schema Validation & Security Defenses', () => {
    test('Validates Midnight wallet addresses correctly', () => {
      assert.strictEqual(isValidMidnightAddress('mn_preview_wallet_alice_1234567890'), true);
      assert.strictEqual(isValidMidnightAddress('0x1am_verified_sender_address'), true);
      assert.strictEqual(isValidMidnightAddress('short'), false);
      assert.strictEqual(isValidMidnightAddress(''), false);
    });

    test('Validates 64-character transaction hashes strictly', () => {
      const validHash = 'a'.repeat(64);
      assert.strictEqual(isValidTxHash(validHash), true);
      assert.strictEqual(isValidTxHash('0x' + validHash), true);
      assert.strictEqual(isValidTxHash('invalid_hash_length'), false);
      assert.strictEqual(isValidTxHash('zzzz' + 'a'.repeat(60)), false);
    });

    test('Detects and blocks prototype pollution payloads', () => {
      const maliciousPayload = JSON.parse('{"__proto__": {"admin": true}}');
      assert.strictEqual(hasPrototypePollution(maliciousPayload), true);

      const benignPayload = { name: 'Alice', amount: '100.00' };
      assert.strictEqual(hasPrototypePollution(benignPayload), false);
    });

    test('validateRequestBody rejects missing required fields and invalid types', () => {
      const validator = validateRequestBody({
        recipient: { required: true, type: 'address' },
        amount: { required: true, type: 'amount' },
      });

      let statusCode = 200;
      let responseBody = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (b) => {
              responseBody = b;
            },
          };
        },
      };

      // Missing amount
      validator({ body: { recipient: 'mn_preview_wallet_alice_12345' } }, res, () => {});
      assert.strictEqual(statusCode, 400);
      assert.strictEqual(responseBody.code, 'MISSING_REQUIRED_FIELD');

      // Negative amount
      validator({ body: { recipient: 'mn_preview_wallet_alice_12345', amount: '-50.00' } }, res, () => {});
      assert.strictEqual(statusCode, 400);
      assert.strictEqual(responseBody.code, 'INVALID_AMOUNT');

      // Valid payload passes
      let passed = false;
      validator({ body: { recipient: 'mn_preview_wallet_alice_12345', amount: '50.00' } }, res, () => {
        passed = true;
      });
      assert.strictEqual(passed, true);
    });
  });

  // 6. IDEMPOTENCY & DUPLICATE PAYMENT/PAYOUT PREVENTION
  describe('6. Idempotency & Replay Protection', () => {
    test('OnRampService returns existing order on duplicate idempotency key', async () => {
      const params = {
        userId: 'user_idem_test_1',
        fiatAmount: '200.00',
        fiatCurrency: 'USD',
        destinationWallet: 'mn_preview_wallet_test_1234567890',
        paymentMethod: 'CREDIT_CARD',
        idempotencyKey: 'idemp_key_unique_test_1001',
      };

      const order1 = await OnRampService.createOrder('WORLDPAY', params);
      const order2 = await OnRampService.createOrder('WORLDPAY', params);

      assert.strictEqual(order1.id, order2.id);
      assert.strictEqual(order1.idempotency_key, order2.idempotency_key);
    });

    test('OffRampService returns existing payout on duplicate idempotency key', async () => {
      const params = {
        userId: 'user_idem_test_2',
        cryptoAmount: '150.00',
        cryptoAsset: 'tDUST',
        fiatAmount: '150.00',
        fiatCurrency: 'USD',
        sourceWallet: 'mn_preview_wallet_test_1234567890',
        payoutMethod: 'BANK_TRANSFER',
        recipientInfo: {
          fullName: 'Alice Bob',
          country: 'US',
        },
        idempotencyKey: 'idemp_payout_key_test_2002',
      };

      const payout1 = await OffRampService.createOrder('WORLDPAY', params);
      const payout2 = await OffRampService.createOrder('WORLDPAY', params);

      assert.strictEqual(payout1.id, payout2.id);
      assert.strictEqual(payout1.idempotency_key, payout2.idempotency_key);
    });

    test('RemittanceService returns existing remittance on duplicate idempotency key', async () => {
      const userId = 'user_idem_test_3';
      await DIDService.getOrCreateUserDID(userId);
      await VCService.issueKYCCredential(userId, {
        amlCleared: true,
        jurisdictionAllowed: true,
        ageOver18: true,
        sanctionsCleared: true,
        countryCode: 'US',
      });

      const params = {
        senderCurrency: 'tDUST',
        senderAmount: '300.00',
        recipientCurrency: 'USD',
        idempotencyKey: 'idemp_rem_key_test_3003',
      };

      const rem1 = await RemittanceService.createRemittance(userId, params);
      const rem2 = await RemittanceService.createRemittance(userId, params);

      assert.strictEqual(rem1.id, rem2.id);
      assert.strictEqual(rem1.idempotency_key, rem2.idempotency_key);
    });

    test('IdempotencyMiddleware blocks in-flight concurrent requests with 409 Conflict', () => {
      const key = 'idem_header_key_concurrent_4004';
      const req = {
        headers: { 'idempotency-key': key },
        method: 'POST',
        baseUrl: '/api',
        path: '/send-money/submit-transaction',
        userId: 'user_4004',
      };

      let status1 = null;
      let status2 = null;
      let body2 = null;

      const res1 = {
        status: (c) => {
          status1 = c;
          return { json: () => {} };
        },
        setHeader: () => {},
        json: () => {},
      };

      const res2 = {
        status: (c) => {
          status2 = c;
          return {
            json: (b) => {
              body2 = b;
            },
          };
        },
        setHeader: () => {},
        json: () => {},
      };

      // First call acquires in-flight lock
      let passed1 = false;
      idempotencyMiddleware(req, res1, () => {
        passed1 = true;
      });
      assert.strictEqual(passed1, true);

      // Concurrent second call while first is in-flight is rejected with 409 Conflict
      idempotencyMiddleware(req, res2, () => {});
      assert.strictEqual(status2, 409);
      assert.strictEqual(body2.code, 'CONCURRENT_REQUEST_CONFLICT');
    });
  });
});
