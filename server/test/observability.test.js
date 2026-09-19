/**
 * NovaPay Phase 17 Test Suite: Production-Grade Observability & Monitoring
 * 
 * Validates:
 * 1. Distributed Traceability (remittanceId, quoteId, providerOrderId, blockchainTransactionId)
 * 2. Zero Leakage Redaction (Secrets: seed phrases, private keys, tokens; Identity: KYC, SSN, passports)
 * 3. Monitoring across all 9 required operational domains:
 *    - API errors
 *    - Provider failures
 *    - Webhook failures
 *    - Blockchain failures
 *    - Stuck remittances
 *    - Stuck payouts
 *    - Reconciliation exceptions
 *    - Database errors
 *    - Compliance failures
 * 4. Operational Alerting Engine (CRITICAL alert generation, querying, resolution)
 * 5. Stuck Transaction Sweeper (StuckTransactionMonitor)
 * 6. Health & Probe Endpoints (/health, /health/live, /health/ready)
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

// Configure test environment strictly to Preview
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'novapay_phase17_test_jwt_secret_token_32chars_min!';
process.env.MIDNIGHT_NETWORK = 'preview';
process.env.MIDNIGHT_RPC_URL = 'https://rpc.preview.midnight.network';

const {
  StructuredLogger,
  sanitizeLogData,
} = require('../build/utils/structured-logger');
const {
  OperationalMonitoringService,
} = require('../build/services/observability/operational-monitoring.service');
const {
  StuckTransactionMonitor,
} = require('../build/services/observability/stuck-transaction-monitor');
const {
  ObservabilityController,
} = require('../build/controllers/observability.controller');
const { RemittanceService } = require('../build/services/remittance/remittance.service');
const { OffRampService } = require('../build/services/offramp/offramp.service');
const { QuoteService } = require('../build/services/fx/quote.service');
const { DIDService } = require('../build/services/identity/did.service');
const { VCService } = require('../build/services/identity/vc.service');

describe('NovaPay Phase 17: Production-Grade Observability', () => {
  const testUserId = 'user_obs_tester_001';
  const testWallet = 'mn_preview_wallet_obs_0123456789abcdef';
  const valid64HexTx = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

  beforeEach(() => {
    StructuredLogger.clearBuffer();
    OperationalMonitoringService.clearState();
    RemittanceService.clearCache();
    OffRampService.clearCache();
    QuoteService.clearCache();
    DIDService.memoryCache.clear();
    VCService.memoryCache.clear();
  });

  // =========================================================================
  // 1. DISTRIBUTED TRACEABILITY
  // =========================================================================
  describe('1. Distributed Traceability Across All 4 Identifiers', () => {
    test('Every log entry links remittanceId, quoteId, providerOrderId, and blockchainTransactionId', () => {
      const trace = {
        remittanceId: 'rem_1726335000_123456',
        quoteId: 'quote_1726335000_789012',
        providerOrderId: 'ord_worldpay_998877',
        blockchainTransactionId: valid64HexTx,
        correlationId: 'req_1726335000_trace_001',
        userId: testUserId,
        walletAddress: testWallet,
      };

      const log = StructuredLogger.info(
        'REMITTANCE',
        'REMITTANCE_SETTLED',
        'Remittance settlement confirmed on Midnight Preview rail',
        trace,
        { amount: '500.00', asset: 'tDUST' }
      );

      // Verify log structure
      assert.strictEqual(log.domain, 'REMITTANCE');
      assert.strictEqual(log.level, 'INFO');
      assert.strictEqual(log.event, 'REMITTANCE_SETTLED');
      assert.ok(log.timestamp);

      // Verify all 4 required trace identifiers are present
      assert.strictEqual(log.trace.remittanceId, 'rem_1726335000_123456');
      assert.strictEqual(log.trace.quoteId, 'quote_1726335000_789012');
      assert.strictEqual(log.trace.providerOrderId, 'ord_worldpay_998877');
      assert.strictEqual(log.trace.blockchainTransactionId, valid64HexTx);
      assert.strictEqual(log.trace.correlationId, 'req_1726335000_trace_001');

      // Verify metadata
      assert.strictEqual(log.metadata?.amount, '500.00');
    });
  });

  // =========================================================================
  // 2. ZERO SECRETS & SENSITIVE IDENTITY REDACTION
  // =========================================================================
  describe('2. Strict Security Redaction (Zero Secrets, Zero PII Leakage)', () => {
    test('Strictly redacts cryptographic secrets (seed phrases, private keys, JWTs, webhook secrets)', () => {
      const sensitiveData = {
        seedPhrase: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        privateKey: '-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg...\n-----END PRIVATE KEY-----',
        jwtSecret: 'super_secret_jwt_hmac_signing_key_32_bytes!',
        webhookSecret: 'whsec_moneygram_secret_9999',
        authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgN_pLg_pLg',
        password: 'UserSuperSecretPassword123!',
      };

      const sanitized = sanitizeLogData(sensitiveData);

      assert.strictEqual(sanitized.seedPhrase, '[REDACTED_SEED_PHRASE]');
      assert.strictEqual(sanitized.privateKey, '[REDACTED_PRIVATE_KEY]');
      assert.strictEqual(sanitized.jwtSecret, '[REDACTED]');
      assert.strictEqual(sanitized.webhookSecret, '[REDACTED]');
      assert.strictEqual(sanitized.authToken, '[REDACTED_JWT_TOKEN]');
      assert.strictEqual(sanitized.password, '[REDACTED]');
    });

    test('Strictly redacts sensitive identity info (KYC documents, passports, SSN, addresses, cards)', () => {
      const identityData = {
        kycDocument: {
          passportNumber: 'A12345678',
          ssn: '000-12-3456',
          taxId: 'US-99887766',
          fullName: 'Alice Henderson',
          streetAddress: '123 Midnight Way, Suite 400',
          postalCode: '94107',
        },
        cardNumber: '4111111111111111',
        cvv: '123',
      };

      const sanitized = sanitizeLogData(identityData);

      assert.strictEqual(sanitized.kycDocument.passportNumber, '[REDACTED]');
      assert.strictEqual(sanitized.kycDocument.ssn, '[REDACTED]');
      assert.strictEqual(sanitized.kycDocument.taxId, '[REDACTED]');
      assert.strictEqual(sanitized.kycDocument.fullName, '[REDACTED]');
      assert.strictEqual(sanitized.kycDocument.streetAddress, '[REDACTED]');
      assert.strictEqual(sanitized.cardNumber, '[REDACTED]');
      assert.strictEqual(sanitized.cvv, '[REDACTED]');
    });
  });

  // =========================================================================
  // 3. OPERATIONAL MONITORING ACROSS ALL 9 SPECIFIED DOMAINS
  // =========================================================================
  describe('3. Operational Monitoring Across All 9 Required Domains', () => {
    // 1. API errors
    test('Domain 1: API errors - 5xx errors record CRITICAL telemetry and generate alert', () => {
      const { logEntry, alert } = OperationalMonitoringService.recordApiError(
        '/api/send-money/create-transaction',
        500,
        new Error('Database connection pool timeout'),
        { correlationId: 'req_500_err' }
      );

      assert.strictEqual(logEntry.domain, 'API');
      assert.strictEqual(logEntry.level, 'CRITICAL');
      assert.ok(alert);
      assert.strictEqual(alert.severity, 'CRITICAL');
      assert.ok(alert.title.includes('HTTP_SERVER_ERROR'));
    });

    // 2. Provider failures
    test('Domain 2: Provider failures - Gateway outages trigger CRITICAL alert', () => {
      const { logEntry, alert } = OperationalMonitoringService.recordProviderFailure(
        'MONEYGRAM',
        'createPayout',
        new Error('503 Service Unavailable: Partner gateway connection reset')
      );

      assert.strictEqual(logEntry.domain, 'PROVIDER');
      assert.strictEqual(logEntry.level, 'CRITICAL');
      assert.ok(alert);
      assert.strictEqual(alert.domain, 'PROVIDER');
      assert.strictEqual(alert.severity, 'CRITICAL');
      assert.ok(alert.details.includes('MONEYGRAM'));
    });

    // 3. Webhook failures
    test('Domain 3: Webhook failures - Signature or timestamp rejections trigger CRITICAL alert', () => {
      const { logEntry, alert } = OperationalMonitoringService.recordWebhookFailure(
        'WORLDPAY',
        'HMAC-SHA256 signature verification failed'
      );

      assert.strictEqual(logEntry.domain, 'WEBHOOK');
      assert.strictEqual(logEntry.level, 'CRITICAL');
      assert.ok(alert);
      assert.strictEqual(alert.domain, 'WEBHOOK');
      assert.ok(alert.details.includes('WORLDPAY'));
    });

    // 4. Blockchain failures
    test('Domain 4: Blockchain failures - Midnight Preview RPC drops trigger CRITICAL alert', () => {
      const { logEntry, alert } = OperationalMonitoringService.recordBlockchainFailure(
        'author_submitExtrinsic',
        new Error('RPC connection timeout: https://rpc.preview.midnight.network unreachable')
      );

      assert.strictEqual(logEntry.domain, 'BLOCKCHAIN');
      assert.strictEqual(logEntry.level, 'CRITICAL');
      assert.ok(alert);
      assert.strictEqual(alert.domain, 'BLOCKCHAIN');
    });

    // 5. Stuck remittances
    test('Domain 5: Stuck remittances - SLA timeout triggers CRITICAL alert with trace', () => {
      const { logEntry, alert } = OperationalMonitoringService.recordStuckRemittance(
        'rem_stuck_001',
        'FUNDING_PENDING',
        45,
        { quoteId: 'quote_123' }
      );

      assert.strictEqual(logEntry.domain, 'REMITTANCE');
      assert.strictEqual(logEntry.level, 'CRITICAL');
      assert.ok(alert);
      assert.strictEqual(alert.domain, 'REMITTANCE');
      assert.strictEqual(alert.trace.remittanceId, 'rem_stuck_001');
      assert.ok(alert.details.includes('45m'));
    });

    // 6. Stuck payouts
    test('Domain 6: Stuck payouts - Off-ramp disbursement delays trigger CRITICAL alert', () => {
      const { logEntry, alert } = OperationalMonitoringService.recordStuckPayout(
        'offramp_ord_002',
        'PAYOUT_PROCESSING',
        60
      );

      assert.strictEqual(logEntry.domain, 'PAYOUT');
      assert.strictEqual(logEntry.level, 'CRITICAL');
      assert.ok(alert);
      assert.strictEqual(alert.domain, 'PAYOUT');
      assert.strictEqual(alert.trace.providerOrderId, 'offramp_ord_002');
    });

    // 7. Reconciliation exceptions
    test('Domain 7: Reconciliation exceptions - Tri-party discrepancy triggers CRITICAL alert', () => {
      const { logEntry, alert } = OperationalMonitoringService.recordReconciliationException(
        'recon_exc_999',
        'DB=FUNDED, Provider=PAYMENT_CONFIRMED, Midnight=NO_ASSET'
      );

      assert.strictEqual(logEntry.domain, 'RECONCILIATION');
      assert.strictEqual(logEntry.level, 'CRITICAL');
      assert.ok(alert);
      assert.strictEqual(alert.domain, 'RECONCILIATION');
      assert.ok(alert.details.includes('NO_ASSET'));
    });

    // 8. Database errors
    test('Domain 8: Database errors - PostgreSQL failures trigger CRITICAL alert', () => {
      const { logEntry, alert } = OperationalMonitoringService.recordDatabaseError(
        'transaction.create',
        new Error('Connection terminated unexpectedly')
      );

      assert.strictEqual(logEntry.domain, 'DATABASE');
      assert.strictEqual(logEntry.level, 'CRITICAL');
      assert.ok(alert);
      assert.strictEqual(alert.domain, 'DATABASE');
    });

    // 9. Compliance failures
    test('Domain 9: Compliance failures - Sanctions hit triggers CRITICAL alert', () => {
      const { logEntry, alert } = OperationalMonitoringService.recordComplianceFailure(
        testUserId,
        'PEP/Sanctions positive match on OFAC list'
      );

      assert.strictEqual(logEntry.domain, 'COMPLIANCE');
      assert.strictEqual(logEntry.level, 'CRITICAL');
      assert.ok(alert);
      assert.strictEqual(alert.domain, 'COMPLIANCE');
      assert.strictEqual(alert.trace.userId, testUserId);
    });
  });

  // =========================================================================
  // 4. OPERATIONAL ALERT LIFECYCLE & RESOLUTION
  // =========================================================================
  describe('4. Operational Alert Lifecycle & Resolution', () => {
    test('Creates, retrieves, filters, and resolves operational alerts', () => {
      const alert1 = OperationalMonitoringService.createAlert({
        domain: 'PROVIDER',
        severity: 'CRITICAL',
        title: 'MoneyGram Outage',
        details: 'Service unavailable',
      });

      const alert2 = OperationalMonitoringService.createAlert({
        domain: 'API',
        severity: 'HIGH',
        title: 'Rate Limit Warning',
        details: 'Elevated rate limits',
      });

      // Query active alerts
      const activeCritical = OperationalMonitoringService.getActiveAlerts('CRITICAL');
      assert.strictEqual(activeCritical.length, 1);
      assert.strictEqual(activeCritical[0].alertId, alert1.alertId);

      const allActive = OperationalMonitoringService.getActiveAlerts();
      assert.strictEqual(allActive.length, 2);

      // Resolve alert1
      const resolved = OperationalMonitoringService.resolveAlert(
        alert1.alertId,
        'NOC_ENGINEER',
        'Provider service restored and reconnected'
      );
      assert.strictEqual(resolved.status, 'RESOLVED');
      assert.strictEqual(resolved.resolvedBy, 'NOC_ENGINEER');
      assert.ok(resolved.resolvedAt);

      // Now only alert2 remains active
      const remainingActive = OperationalMonitoringService.getActiveAlerts();
      assert.strictEqual(remainingActive.length, 1);
      assert.strictEqual(remainingActive[0].alertId, alert2.alertId);
    });

    test('Provides comprehensive domain telemetry metrics', () => {
      OperationalMonitoringService.recordEvent({
        domain: 'BLOCKCHAIN',
        event: 'BLOCK_CONFIRMED',
        level: 'INFO',
        message: 'Midnight Preview block confirmed',
      });

      OperationalMonitoringService.recordEvent({
        domain: 'BLOCKCHAIN',
        event: 'RPC_TIMEOUT',
        level: 'CRITICAL',
        message: 'RPC timeout',
      });

      const metrics = OperationalMonitoringService.getMetrics();
      assert.ok(metrics.systemUptimeSeconds >= 0);
      assert.strictEqual(metrics.domains.BLOCKCHAIN.totalEvents, 2);
      assert.strictEqual(metrics.domains.BLOCKCHAIN.criticalCount, 1);
      assert.strictEqual(metrics.criticalAlertsCount, 1);
    });
  });

  // =========================================================================
  // 5. STUCK TRANSACTION SWEEPER (STUCK TRANSACTION MONITOR)
  // =========================================================================
  describe('5. Stuck Transaction Sweeper (StuckTransactionMonitor)', () => {
    test('Identifies and generates alerts for remittances stuck past SLA limits', async () => {
      // 1. Create remittance in FUNDING_PENDING that is 45 minutes old
      const staleTime = new Date(Date.now() - 45 * 60 * 1000);
      RemittanceService.memoryCache.set('rem_stale_101', {
        id: 'rem_stale_101',
        sender_id: testUserId,
        recipient_id: null,
        quote_id: 'quote_101',
        sender_currency: 'tDUST',
        sender_amount: '100.00',
        recipient_currency: 'USD',
        recipient_amount: '100.00',
        exchange_rate: '1.00',
        fee_total: '1.00',
        status: 'FUNDING_PENDING',
        purpose: 'Test',
        settlement_rail: 'MIDNIGHT_PREVIEW',
        compliance_case_id: null,
        funding_reference: null,
        blockchain_tx_hash: null,
        block_height: null,
        provider_reference: null,
        created_at: staleTime,
        updated_at: staleTime,
      });

      // 2. Create remittance in COMPLETED (terminal state, should NOT be flagged)
      RemittanceService.memoryCache.set('rem_completed_102', {
        id: 'rem_completed_102',
        sender_id: testUserId,
        status: 'COMPLETED',
        created_at: staleTime,
        updated_at: staleTime,
      });

      // 3. Run sweep
      const scanResult = await StuckTransactionMonitor.scanForStuckTransactions();

      assert.strictEqual(scanResult.remittancesScanned, 2);
      assert.strictEqual(scanResult.stuckRemittancesFound, 1);
      assert.ok(scanResult.alertsCreated >= 1);

      // Verify alert was generated
      const activeAlerts = OperationalMonitoringService.getActiveAlerts('CRITICAL');
      const stuckAlert = activeAlerts.find((a) => a.trace.remittanceId === 'rem_stale_101');
      assert.ok(stuckAlert);
      assert.strictEqual(stuckAlert.domain, 'REMITTANCE');
      assert.ok(stuckAlert.details.includes('stuck'));
    });

    test('Identifies and generates alerts for off-ramp payouts stuck in PAYOUT_PROCESSING', async () => {
      const staleTime = new Date(Date.now() - 40 * 60 * 1000);
      OffRampService.memoryCache.set('offramp_stuck_201', {
        id: 'offramp_stuck_201',
        user_id: testUserId,
        provider: 'WORLDPAY',
        status: 'PAYOUT_PROCESSING',
        crypto_amount: '200.00',
        crypto_asset: 'tDUST',
        fiat_amount: '200.00',
        fiat_currency: 'USD',
        source_wallet: testWallet,
        deposit_wallet: 'mn_vault',
        payout_method: 'PUSH_TO_CARD',
        created_at: staleTime,
        updated_at: staleTime,
      });

      const scanResult = await StuckTransactionMonitor.scanForStuckTransactions();

      assert.strictEqual(scanResult.stuckPayoutsFound, 1);
      const activeAlerts = OperationalMonitoringService.getActiveAlerts('CRITICAL');
      const payoutAlert = activeAlerts.find((a) => a.trace.providerOrderId === 'offramp_stuck_201');
      assert.ok(payoutAlert);
      assert.strictEqual(payoutAlert.domain, 'PAYOUT');
    });
  });

  // =========================================================================
  // 6. HEALTH & PROBE ENDPOINTS
  // =========================================================================
  describe('6. Health Checks & Readiness/Liveness Probes', () => {
    test('Liveness probe returns status ALIVE with 200 OK', () => {
      const res = {
        statusCode: 0,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
        },
      };

      ObservabilityController.getLiveness({}, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.status, 'ALIVE');
      assert.ok(res.body.uptimeSeconds >= 0);
    });

    test('Readiness probe checks Midnight Preview network', async () => {
      const res = {
        statusCode: 0,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
        },
      };

      await ObservabilityController.getReadiness({}, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.status, 'READY');
      assert.strictEqual(res.body.network, 'preview');
    });

    test('Deep health check inspects RPC node, database, and operational alerts', async () => {
      const res = {
        statusCode: 0,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
        },
      };

      await ObservabilityController.getHealth({ correlationId: 'req_health_test' }, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.status, 'HEALTHY');
      assert.strictEqual(res.body.midnightNetwork, 'preview');
      assert.ok(res.body.checks.midnightRpc);
      assert.strictEqual(res.body.checks.midnightRpc.status, 'UP');
      assert.strictEqual(res.body.activeCriticalAlertsCount, 0);
    });
  });
});
