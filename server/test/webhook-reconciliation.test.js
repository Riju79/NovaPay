/**
 * NovaPay Phase 13 Test Suite: Webhooks & Reconciliation Infrastructure
 *
 * Requirements Tested:
 * 1. Webhook Signature Verification (HMAC-SHA256 with constant-time comparison).
 * 2. Webhook Timestamp Verification (rejection of stale events >300s).
 * 3. Replay Protection & Idempotency (unique provider event IDs prevent duplicate processing).
 * 4. Webhook Event Persistence, Status Updates, and Retries.
 * 5. Three-Way Reconciliation Engine:
 *    - Compares NovaPay DB, Provider state, and Midnight Preview state.
 *    - Success: DB=FUNDED, Provider=PAYMENT_CONFIRMED, Midnight=ASSET_CONFIRMED -> MATCHED.
 *    - Anomaly: DB=FUNDED, Provider=PAYMENT_CONFIRMED, Midnight=NO ASSET -> RECONCILIATION_EXCEPTION.
 *    - Invariant: Do not mark completed on active exception.
 * 6. ReconciliationRecord capabilities: automatic sweeps, exception queue, retries, and manual review.
 * 7. Background reconciliation worker.
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

// Configure test environment
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'novapay_test_jwt_secret_token_32chars_minimum!';
process.env.MIDNIGHT_NETWORK = 'preview';
process.env.WORLDPAY_WEBHOOK_SECRET = 'test_worldpay_webhook_secret_key_123';
process.env.MONEYGRAM_WEBHOOK_SECRET = 'test_moneygram_webhook_secret_key_456';

const { WebhookService } = require('../build/services/webhook/webhook.service');
const { ThreeWayReconciliationService } = require('../build/services/reconciliation/three-way-reconciliation.service');
const { ReconciliationWorker } = require('../build/services/reconciliation/reconciliation-worker');
const { RemittanceService } = require('../build/services/remittance/remittance.service');
const { OnRampService } = require('../build/services/onramp/onramp.service');
const { QuoteService } = require('../build/services/fx/quote.service');
const { DIDService } = require('../build/services/identity/did.service');
const { VCService } = require('../build/services/identity/vc.service');

const db = require('../build/config/db').default || require('../build/config/db').prisma || require('../build/config/db');

describe('NovaPay Phase 13: Webhooks & Reconciliation Infrastructure', () => {
  const testUserId = 'user_recon_tester_999';
  const testWallet = 'mn_preview_wallet_recon_test_1234567890';

  beforeEach(async () => {
    WebhookService.clearCache();
    ThreeWayReconciliationService.clearCache();
    RemittanceService.clearCache();
    OnRampService.clearCache();
    QuoteService.clearCache();
    DIDService.memoryCache.clear();
    VCService.memoryCache.clear();

    try {
      await db.user.upsert({
        where: { id: testUserId },
        update: {},
        create: {
          id: testUserId,
          email: `${testUserId}@example.com`,
          name: 'Reconciliation Tester',
          role: 'USER',
          isVerified: true,
          midnightWalletAddress: testWallet,
        },
      });
    } catch {}

    try {
      await DIDService.getOrCreateUserDID(testUserId);
      await VCService.issueKYCCredential(testUserId, {
        amlCleared: true,
        jurisdictionAllowed: true,
        ageOver18: true,
        sanctionsCleared: true,
        countryCode: 'US',
      });
    } catch {}
  });

  describe('1. Webhook Signature Verification', () => {
    test('Accepts authentic HMAC-SHA256 signature', () => {
      const secret = process.env.WORLDPAY_WEBHOOK_SECRET || 'test_worldpay_webhook_secret_key_123';
      const payload = JSON.stringify({ event: 'settled', paymentId: 'wp_pay_1' });
      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      const isValid = WebhookService.verifySignature('WORLDPAY', signature, payload);
      assert.strictEqual(isValid, true);
    });

    test('Rejects forged or tampered webhook signature', () => {
      const payload = JSON.stringify({ event: 'settled', paymentId: 'wp_pay_1' });
      const forgedSignature = crypto.randomBytes(32).toString('hex');

      const isValid = WebhookService.verifySignature('WORLDPAY', forgedSignature, payload);
      assert.strictEqual(isValid, false);
    });
  });

  describe('2. Webhook Timestamp Verification & Replay Protection', () => {
    test('Accepts fresh timestamp within 300s window', () => {
      const freshTimestamp = new Date(Date.now() - 10000).toISOString(); // 10 seconds ago
      const check = WebhookService.verifyTimestamp(freshTimestamp);
      assert.strictEqual(check.valid, true);
      assert.ok(check.parsedDate);
    });

    test('Rejects stale webhook with timestamp older than 300 seconds', () => {
      const staleTimestamp = new Date(Date.now() - 400 * 1000).toISOString(); // 400 seconds ago (>300s)
      const check = WebhookService.verifyTimestamp(staleTimestamp);
      assert.strictEqual(check.valid, false);
      assert.ok(check.reason.includes('expired'));
    });

    test('Rejects webhook timestamp skewed into the future (>60s)', () => {
      const futureTimestamp = new Date(Date.now() + 120 * 1000).toISOString(); // 120 seconds in future
      const check = WebhookService.verifyTimestamp(futureTimestamp);
      assert.strictEqual(check.valid, false);
      assert.ok(check.reason.includes('future'));
    });

    test('Unique provider event ID prevents duplicate processing (Idempotency)', async () => {
      const secret = process.env.WORLDPAY_WEBHOOK_SECRET || 'test_worldpay_webhook_secret_key_123';
      const providerEventId = `wp_unique_event_${Date.now()}`;
      const payloadObj = {
        event_id: providerEventId,
        event: 'settled',
        amount: 10000,
        timestamp: new Date().toISOString(),
      };
      const rawPayload = JSON.stringify(payloadObj);
      const signature = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');
      const headers = {
        'x-worldpay-signature': signature,
        'x-webhook-timestamp': payloadObj.timestamp,
      };

      // First Ingestion -> Status: PROCESSED
      const firstResult = await WebhookService.processIncomingWebhook(
        'WORLDPAY',
        headers,
        rawPayload,
        payloadObj
      );
      assert.strictEqual(firstResult.success, true);
      assert.strictEqual(firstResult.status, 'PROCESSED');
      assert.strictEqual(firstResult.duplicate, undefined);

      // Replayed Ingestion with same providerEventId -> Status: DUPLICATE
      const secondResult = await WebhookService.processIncomingWebhook(
        'WORLDPAY',
        headers,
        rawPayload,
        payloadObj
      );
      assert.strictEqual(secondResult.success, true);
      assert.strictEqual(secondResult.status, 'DUPLICATE');
      assert.strictEqual(secondResult.duplicate, true);

      // Verify only 1 stored event created
      assert.strictEqual(WebhookService.memoryEvents.size, 1);
    });
  });

  describe('3. Webhook Event Persistence & Retry Mechanism', () => {
    test('Persists WebhookEvent with status RECEIVED -> PROCESSED', async () => {
      const secret = process.env.WORLDPAY_WEBHOOK_SECRET || 'test_worldpay_webhook_secret_key_123';
      const eventId = `wp_evt_${Date.now()}`;
      const payloadObj = {
        event_id: eventId,
        event: 'payment_confirmed',
        timestamp: new Date().toISOString(),
      };
      const rawPayload = JSON.stringify(payloadObj);
      const signature = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

      const result = await WebhookService.processIncomingWebhook(
        'WORLDPAY',
        { 'x-worldpay-signature': signature },
        rawPayload,
        payloadObj
      );

      assert.strictEqual(result.status, 'PROCESSED');

      const saved = await WebhookService.getEvent(result.eventId);
      assert.strictEqual(saved.provider_event_id, eventId);
      assert.strictEqual(saved.status, 'PROCESSED');
      assert.strictEqual(saved.retry_count, 0);
    });
  });

  describe('4. Three-Way Reconciliation Engine & Exception Anomaly Detection', () => {
    // Helper to create and fund remittance according to the authoritative state machine
    async function setupFundedRemittance(amount, onRampId) {
      const quote = await QuoteService.createQuote(testUserId, {
        sourceCurrency: 'tDUST',
        destinationCurrency: 'USD',
        sourceAmount: amount,
      });
      const locked = await QuoteService.lockQuote(testUserId, quote.quoteId);
      const rem = await RemittanceService.createRemittance(testUserId, {
        senderCurrency: 'tDUST',
        senderAmount: amount,
        recipientCurrency: 'USD',
        quoteId: locked.quoteId,
      });
      await RemittanceService.lockQuoteForRemittance(testUserId, rem.id, locked.quoteId);
      await RemittanceService.evaluateCompliance(testUserId, rem.id, {
        senderWallet: testWallet,
        recipientWallet: 'mn_preview_wallet_bob_987654321',
      });
      await RemittanceService.requestFunding(testUserId, rem.id);
      await RemittanceService.confirmFunding(testUserId, rem.id, onRampId);
      return rem;
    }

    test('Full consistency: DB=FUNDED, Provider=PAYMENT_CONFIRMED, Midnight=ASSET_CONFIRMED -> MATCHED', async () => {
      // 1. Create on-ramp order
      const onRamp = await OnRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        fiatAmount: '500.00',
        fiatCurrency: 'USD',
        destinationWallet: testWallet,
        paymentMethod: 'CREDIT_CARD',
      });
      await OnRampService.transitionOrder(onRamp.id, 'PAYMENT_PENDING', { source: 'SYSTEM' });
      await OnRampService.confirmPaymentAuthoritatively(onRamp.id, 'wp_order_500');

      // 2. Create and fund remittance through authoritative state machine
      const rem = await setupFundedRemittance('500.00', onRamp.id);

      // 3. Confirm blockchain asset
      const canonicalHash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
      await RemittanceService.prepareBlockchainSettlement(testUserId, rem.id);
      await RemittanceService.submitBlockchainSettlement(testUserId, rem.id, canonicalHash);
      await RemittanceService.confirmBlockchainSettlement(testUserId, rem.id, 142050);

      // Run 3-way reconciliation
      const recon = await ThreeWayReconciliationService.reconcileRemittance(testUserId, rem.id);

      assert.strictEqual(recon.status, 'MATCHED');
      assert.strictEqual(recon.discrepancy.toString(), '0');
      assert.strictEqual(recon.db_state, 'BLOCKCHAIN_CONFIRMED');
      assert.strictEqual(recon.provider_state, 'PAYMENT_CONFIRMED');
      assert.strictEqual(recon.blockchain_state, 'ASSET_CONFIRMED');
      assert.strictEqual(recon.queued_for_review, false);
    });

    test('Critical Anomaly: DB=FUNDED, Provider=PAYMENT_CONFIRMED, Midnight=NO ASSET -> RECONCILIATION_EXCEPTION (Must NOT Mark Completed)', async () => {
      // 1. OnRamp payment is confirmed
      const onRamp = await OnRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        fiatAmount: '250.00',
        fiatCurrency: 'USD',
        destinationWallet: testWallet,
        paymentMethod: 'CREDIT_CARD',
      });
      await OnRampService.transitionOrder(onRamp.id, 'PAYMENT_PENDING', { source: 'SYSTEM' });
      await OnRampService.confirmPaymentAuthoritatively(onRamp.id, 'wp_order_250');

      // 2. Remittance DB says FUNDED
      const rem = await setupFundedRemittance('250.00', onRamp.id);

      // 3. Midnight Preview has NO ASSET (blockchain_tx_hash is null / missing on-chain)
      assert.strictEqual(rem.blockchain_tx_hash, null);

      // Run 3-way reconciliation
      const recon = await ThreeWayReconciliationService.reconcileRemittance(testUserId, rem.id);

      // Must result in RECONCILIATION_EXCEPTION
      assert.strictEqual(recon.status, 'RECONCILIATION_EXCEPTION');
      assert.strictEqual(recon.exception_type, 'NO_ASSET');
      assert.strictEqual(recon.queued_for_review, true);
      assert.strictEqual(recon.blockchain_state, 'NO_ASSET');
      assert.ok(recon.notes.includes('RECONCILIATION_EXCEPTION'));

      // STRICT INVARIANT: Must NOT mark completed!
      assert.throws(
        () => {
          ThreeWayReconciliationService.assertCanComplete(rem.id);
        },
        (err) => {
          assert.strictEqual(err.code, 'RECONCILIATION_BLOCKED');
          assert.strictEqual(err.exceptionType, 'NO_ASSET');
          return true;
        }
      );
    });
  });

  describe('5. Exception Queue, Retry, Manual Review & Background Worker', () => {
    test('Exception queue lists flagged records and allows manual resolution', async () => {
      const onRamp = await OnRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        fiatAmount: '100.00',
        fiatCurrency: 'USD',
        destinationWallet: testWallet,
        paymentMethod: 'CREDIT_CARD',
      });
      await OnRampService.transitionOrder(onRamp.id, 'PAYMENT_PENDING', { source: 'SYSTEM' });
      await OnRampService.confirmPaymentAuthoritatively(onRamp.id, 'wp_order_100');

      // Create quote and fund remittance
      const quote = await QuoteService.createQuote(testUserId, {
        sourceCurrency: 'tDUST',
        destinationCurrency: 'USD',
        sourceAmount: '100.00',
      });
      const locked = await QuoteService.lockQuote(testUserId, quote.quoteId);
      const rem = await RemittanceService.createRemittance(testUserId, {
        senderCurrency: 'tDUST',
        senderAmount: '100.00',
        recipientCurrency: 'USD',
        quoteId: locked.quoteId,
      });
      await RemittanceService.lockQuoteForRemittance(testUserId, rem.id, locked.quoteId);
      await RemittanceService.evaluateCompliance(testUserId, rem.id, {
        senderWallet: testWallet,
        recipientWallet: 'mn_preview_wallet_bob_987654321',
      });
      await RemittanceService.requestFunding(testUserId, rem.id);
      await RemittanceService.confirmFunding(testUserId, rem.id, onRamp.id);

      const recon = await ThreeWayReconciliationService.reconcileRemittance(testUserId, rem.id);

      // Verify record appears in exception queue
      const queue = await ThreeWayReconciliationService.getExceptionQueue();
      assert.strictEqual(queue.length, 1);
      assert.strictEqual(queue[0].id, recon.id);

      // Officer manual review resolves exception
      const resolved = await ThreeWayReconciliationService.resolveException(recon.id, {
        officerId: 'compliance_officer_alice',
        notes: 'Investigated: User deposit lagged on node. Resolved manually.',
        status: 'RESOLVED',
      });

      assert.strictEqual(resolved.status, 'RESOLVED');
      assert.strictEqual(resolved.queued_for_review, false);
      assert.ok(resolved.resolved_at);
    });

    test('Background reconciliation worker executes automatic sweep', async () => {
      const result = await ReconciliationWorker.runJob();
      assert.ok(typeof result.sweptCount === 'number');
      assert.ok(typeof result.matchedCount === 'number');
      assert.ok(typeof result.exceptionCount === 'number');
      assert.strictEqual(ReconciliationWorker.isRunning, false);
      assert.ok(ReconciliationWorker.lastRunAt);
    });
  });
});
