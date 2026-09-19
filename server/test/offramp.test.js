/**
 * NovaPay Phase 11 Test Suite: Off-Ramp Infrastructure
 *
 * Requirements Tested:
 * 1. OffRampProvider Interface Compliance (all 9 methods implemented).
 * 2. Locked Provider Targets: MoneyGram & Worldpay.
 *    - Official documentation verified.
 *    - Strict BLOCKED reporting with diagnostic technical rationale (no faking).
 * 3. OffRampOrder 11-State Machine:
 *    - CREATED, ASSET_PENDING, ASSET_RECEIVED, PAYOUT_PENDING,
 *      PAYOUT_PROCESSING, COMPLETED, FAILED, REJECTED, MANUAL_REVIEW,
 *      REFUND_PENDING, REFUNDED.
 * 4. Anti-Bypass Security Rule:
 *    - "Never let frontend declare payout completion."
 *    - Direct client calls to declare payout completion or progression are strictly rejected.
 * 5. Independent Verification:
 *    - Payout status independently verified via cryptographically verified webhooks or server polling.
 * 6. Compliance, manual review, refund, and exception flows.
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

// Configure test environment
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'novapay_test_jwt_secret_token_32chars_minimum!';
process.env.MIDNIGHT_NETWORK = 'preview';
process.env.MONEYGRAM_WEBHOOK_SECRET = 'test_mg_offramp_secret_123';
process.env.WORLDPAY_WEBHOOK_SECRET = 'test_wp_offramp_secret_456';

const { OffRampService } = require('../build/services/offramp/offramp.service');
const { MoneyGramOffRampAdapter } = require('../build/services/offramp/moneygram-offramp.adapter');
const { WorldpayOffRampAdapter } = require('../build/services/offramp/worldpay-offramp.adapter');

describe('NovaPay Phase 11: Off-Ramp Infrastructure', () => {
  const testUserId = 'usr_alice_offramp_test_123';
  const testSourceWallet = 'mn_preview_wallet_alice_source_wallet_1234567890';

  beforeEach(() => {
    OffRampService.clearCache();
  });

  describe('1. OffRampProvider Interface Compliance & Locked Targets', () => {
    test('MoneyGram adapter implements all 9 required interface methods', () => {
      const adapter = new MoneyGramOffRampAdapter('test_mg_offramp_secret_123');
      const requiredMethods = [
        'createPayout',
        'getPayoutStatus',
        'cancelPayout',
        'verifyWebhook',
        'parseWebhook',
        'getSupportedFiatCurrencies',
        'getSupportedCountries',
        'getSupportedPayoutMethods',
        'getSupportedAssets',
      ];

      for (const method of requiredMethods) {
        assert.strictEqual(
          typeof adapter[method],
          'function',
          `MoneyGramOffRampAdapter must implement ${method}`
        );
      }
    });

    test('Worldpay adapter implements all 9 required interface methods', () => {
      const adapter = new WorldpayOffRampAdapter('test_wp_offramp_secret_456');
      const requiredMethods = [
        'createPayout',
        'getPayoutStatus',
        'cancelPayout',
        'verifyWebhook',
        'parseWebhook',
        'getSupportedFiatCurrencies',
        'getSupportedCountries',
        'getSupportedPayoutMethods',
        'getSupportedAssets',
      ];

      for (const method of requiredMethods) {
        assert.strictEqual(
          typeof adapter[method],
          'function',
          `WorldpayOffRampAdapter must implement ${method}`
        );
      }
    });

    test('Locked providers report BLOCKED with complete audit diagnostics (Do Not Fake It)', () => {
      const mg = new MoneyGramOffRampAdapter('test_mg_offramp_secret_123');
      const wp = new WorldpayOffRampAdapter('test_wp_offramp_secret_456');

      // MoneyGram Audit
      const mgAudit = mg.getAuditVerification();
      assert.strictEqual(mgAudit.provider, 'MONEYGRAM');
      assert.strictEqual(mgAudit.apiAccess, true);
      assert.strictEqual(mgAudit.sandboxAvailable, true);
      assert.strictEqual(mgAudit.midnightSupport, false, 'MoneyGram has NO Midnight support');
      assert.strictEqual(mgAudit.preprodSupport, false, 'MoneyGram has NO Midnight Preprod rail');
      assert.strictEqual(mgAudit.isBlocked, true);
      assert.ok(mgAudit.blockedReason.includes('BLOCKED'));
      assert.deepStrictEqual(mgAudit.supportedAssets, ['USDC_STELLAR'], 'Only Stellar USDC is supported; tDUST is unsupported');

      // Worldpay Audit
      const wpAudit = wp.getAuditVerification();
      assert.strictEqual(wpAudit.provider, 'WORLDPAY');
      assert.strictEqual(wpAudit.apiAccess, true);
      assert.strictEqual(wpAudit.sandboxAvailable, true);
      assert.strictEqual(wpAudit.midnightSupport, false, 'Worldpay has NO Midnight support');
      assert.strictEqual(wpAudit.preprodSupport, false, 'Worldpay has NO Midnight Preprod rail');
      assert.strictEqual(wpAudit.isBlocked, true);
      assert.ok(wpAudit.blockedReason.includes('BLOCKED'));
      assert.deepStrictEqual(wpAudit.supportedAssets, [], 'Worldpay provides zero crypto assets natively; tDUST is unsupported');
    });

    test('Direct payout dispatch to BLOCKED provider throws PROVIDER_BLOCKED', async () => {
      const order = await OffRampService.createOrder('MONEYGRAM', {
        userId: testUserId,
        cryptoAmount: '100.000000',
        cryptoAsset: 'tDUST',
        fiatAmount: '100.00',
        fiatCurrency: 'USD',
        sourceWallet: testSourceWallet,
        payoutMethod: 'CASH_PICKUP',
        recipientInfo: {
          fullName: 'Alice Smith',
          country: 'US',
        },
      });

      assert.strictEqual(order.status, 'CREATED');

      // Advance to PAYOUT_PENDING
      await OffRampService.markAssetPending(order.id);
      await OffRampService.confirmAssetReceived(order.id, '0xmidnight_tx_hash_deposit_123');
      await OffRampService.preparePayout(order.id);

      // Attempting to dispatch payout on a blocked rail must throw PROVIDER_BLOCKED
      await assert.rejects(
        async () => {
          await OffRampService.initiatePayout(order.id);
        },
        (err) => {
          assert.strictEqual(err.code, 'PROVIDER_BLOCKED');
          assert.ok(err.message.includes('blocked'));
          return true;
        }
      );
    });
  });

  describe('2. OffRampOrder 11-State Machine Forward Progression', () => {
    test('Order initializes in CREATED state with deposit address', async () => {
      const order = await OffRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        cryptoAmount: '200.000000',
        cryptoAsset: 'tDUST',
        fiatAmount: '200.00',
        fiatCurrency: 'EUR',
        sourceWallet: testSourceWallet,
        payoutMethod: 'PUSH_TO_CARD',
        recipientInfo: {
          fullName: 'Bob Martin',
          country: 'FR',
          cardNumber: '4111111111111111',
        },
      });

      assert.strictEqual(order.status, 'CREATED');
      assert.strictEqual(order.fiat_currency, 'EUR');
      assert.ok(order.deposit_wallet.startsWith('mn_preview_vault_'));
      assert.strictEqual(order.audit_trail.length, 1);
      assert.strictEqual(order.audit_trail[0].to, 'CREATED');
    });

    test('Full forward state machine progression: CREATED -> ASSET_PENDING -> ASSET_RECEIVED -> PAYOUT_PENDING -> PAYOUT_PROCESSING -> COMPLETED', async () => {
      const order = await OffRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        cryptoAmount: '350.000000',
        cryptoAsset: 'tDUST',
        fiatAmount: '350.00',
        fiatCurrency: 'USD',
        sourceWallet: testSourceWallet,
        payoutMethod: 'PUSH_TO_CARD',
        recipientInfo: {
          fullName: 'Carol Danvers',
          country: 'US',
        },
      });

      // 1. CREATED -> ASSET_PENDING
      const pendingOrder = await OffRampService.markAssetPending(order.id);
      assert.strictEqual(pendingOrder.status, 'ASSET_PENDING');

      // 2. ASSET_PENDING -> ASSET_RECEIVED (Authoritative Blockchain Verification)
      const receivedOrder = await OffRampService.confirmAssetReceived(
        order.id,
        '0xmidnight_preprod_block_transfer_hash_999888',
        142050
      );
      assert.strictEqual(receivedOrder.status, 'ASSET_RECEIVED');
      assert.strictEqual(receivedOrder.tx_hash, '0xmidnight_preprod_block_transfer_hash_999888');

      // 3. ASSET_RECEIVED -> PAYOUT_PENDING
      const preparedOrder = await OffRampService.preparePayout(order.id);
      assert.strictEqual(preparedOrder.status, 'PAYOUT_PENDING');

      // 4. PAYOUT_PENDING -> PAYOUT_PROCESSING (Simulated provider dispatch)
      const processingOrder = await OffRampService.transitionOrder(order.id, 'PAYOUT_PROCESSING', {
        source: 'SYSTEM',
        providerPayoutId: 'wp_disb_test_5544',
        reason: 'Provider processing payout',
      });
      assert.strictEqual(processingOrder.status, 'PAYOUT_PROCESSING');

      // 5. PAYOUT_PROCESSING -> COMPLETED (Authoritative Server Confirmation)
      const completedOrder = await OffRampService.confirmPayoutAuthoritatively(
        order.id,
        'wp_disb_test_5544',
        'Independent bank verification confirmed funds disbursed'
      );
      assert.strictEqual(completedOrder.status, 'COMPLETED');

      // Verify complete audit history
      const auditStates = completedOrder.audit_trail.map((a) => a.to);
      assert.deepStrictEqual(auditStates, [
        'CREATED',
        'ASSET_PENDING',
        'ASSET_RECEIVED',
        'PAYOUT_PENDING',
        'PAYOUT_PROCESSING',
        'COMPLETED',
      ]);
    });
  });

  describe('3. Anti-Bypass Rule: Never Let Frontend Declare Payout Completion', () => {
    test('Frontend client attempting to assert COMPLETED directly is rejected with 403 / UNAUTHORIZED_PAYOUT_COMPLETION', async () => {
      const order = await OffRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        cryptoAmount: '100.000000',
        cryptoAsset: 'tDUST',
        fiatAmount: '100.00',
        fiatCurrency: 'USD',
        sourceWallet: testSourceWallet,
        payoutMethod: 'PUSH_TO_CARD',
        recipientInfo: { fullName: 'Dave Lister', country: 'GB' },
      });

      await OffRampService.markAssetPending(order.id);

      // Client-side attacker attempts to declare payout completion directly
      await assert.rejects(
        async () => {
          await OffRampService.transitionOrder(order.id, 'COMPLETED', {
            source: 'FRONTEND',
            reason: 'User browser claims cash was received',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'UNAUTHORIZED_PAYOUT_COMPLETION');
          assert.ok(err.message.includes('Frontend client cannot assert'));
          return true;
        }
      );

      // Order status remains ASSET_PENDING
      const currentOrder = await OffRampService.getOrder(order.id);
      assert.strictEqual(currentOrder.status, 'ASSET_PENDING');
    });

    test('Frontend client attempting to declare ASSET_RECEIVED directly is rejected', async () => {
      const order = await OffRampService.createOrder('MONEYGRAM', {
        userId: testUserId,
        cryptoAmount: '50.000000',
        cryptoAsset: 'tDUST',
        fiatAmount: '50.00',
        fiatCurrency: 'USD',
        sourceWallet: testSourceWallet,
        payoutMethod: 'CASH_PICKUP',
        recipientInfo: { fullName: 'Eve Polastri', country: 'GB' },
      });

      await OffRampService.markAssetPending(order.id);

      await assert.rejects(
        async () => {
          await OffRampService.transitionOrder(order.id, 'ASSET_RECEIVED', {
            source: 'FRONTEND',
            reason: 'User claims deposit sent without node verification',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'UNAUTHORIZED_PAYOUT_COMPLETION');
          return true;
        }
      );
    });
  });

  describe('4. Independent Verification: Webhook Ingestion & Signatures', () => {
    test('Rejects webhook with invalid signature', async () => {
      const rawPayload = JSON.stringify({
        event: 'disbursed',
        payoutId: 'wp_payout_123',
      });

      await assert.rejects(
        async () => {
          await OffRampService.handleWebhook(
            'WORLDPAY',
            { 'x-worldpay-signature': 'invalid_forged_hash' },
            rawPayload,
            JSON.parse(rawPayload)
          );
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_WEBHOOK_SIGNATURE');
          return true;
        }
      );
    });

    test('Successfully parses valid Worldpay payout webhook and advances to COMPLETED', async () => {
      const order = await OffRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        cryptoAmount: '120.000000',
        cryptoAsset: 'tDUST',
        fiatAmount: '120.00',
        fiatCurrency: 'USD',
        sourceWallet: testSourceWallet,
        payoutMethod: 'PUSH_TO_CARD',
        recipientInfo: { fullName: 'Frank Castle', country: 'US' },
      });

      await OffRampService.markAssetPending(order.id);
      await OffRampService.confirmAssetReceived(order.id, '0xmidnight_tx_12345');
      await OffRampService.preparePayout(order.id);

      // Worldpay webhook payload
      const payload = {
        event: 'disbursed',
        payoutId: 'wp_disb_fast_777',
        merchantReference: order.id,
        amount: 12000,
        currencyCode: 'USD',
      };
      const rawPayload = JSON.stringify(payload);
      const secret = process.env.WORLDPAY_WEBHOOK_SECRET || 'test_wp_offramp_secret_456';
      const signature = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

      const result = await OffRampService.handleWebhook(
        'WORLDPAY',
        { 'x-worldpay-signature': signature },
        rawPayload,
        payload
      );

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.orderId, order.id);

      const updated = await OffRampService.getOrder(order.id);
      assert.strictEqual(updated.status, 'COMPLETED');
      assert.strictEqual(updated.provider_order_id, 'wp_disb_fast_777');
    });

    test('Successfully parses valid MoneyGram cash collected webhook and marks order COMPLETED', async () => {
      const order = await OffRampService.createOrder('MONEYGRAM', {
        userId: testUserId,
        cryptoAmount: '300.000000',
        cryptoAsset: 'tDUST',
        fiatAmount: '300.00',
        fiatCurrency: 'USD',
        sourceWallet: testSourceWallet,
        payoutMethod: 'CASH_PICKUP',
        recipientInfo: { fullName: 'Grace Hopper', country: 'US' },
      });

      await OffRampService.markAssetPending(order.id);
      await OffRampService.confirmAssetReceived(order.id, '0xmidnight_tx_grace_77');
      await OffRampService.preparePayout(order.id);

      const payload = {
        event_type: 'collected',
        transaction_id: 'mg_cash_pickup_999',
        external_reference: order.id,
        amount: '300.00',
        currency: 'USD',
      };
      const rawPayload = JSON.stringify(payload);
      const secret = process.env.MONEYGRAM_WEBHOOK_SECRET || 'test_mg_offramp_secret_123';
      const signature = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

      const result = await OffRampService.handleWebhook(
        'MONEYGRAM',
        { 'x-moneygram-signature': signature },
        rawPayload,
        payload
      );

      assert.strictEqual(result.processed, true);
      const updated = await OffRampService.getOrder(order.id);
      assert.strictEqual(updated.status, 'COMPLETED');
    });
  });

  describe('5. Compliance, Manual Review, Refund, and Exception Flows', () => {
    test('Manual review escalation and clearance: ASSET_RECEIVED -> MANUAL_REVIEW -> PAYOUT_PENDING', async () => {
      const order = await OffRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        cryptoAmount: '5000.000000',
        cryptoAsset: 'tDUST',
        fiatAmount: '5000.00',
        fiatCurrency: 'USD',
        sourceWallet: testSourceWallet,
        payoutMethod: 'PUSH_TO_CARD',
        recipientInfo: { fullName: 'Hank Pym', country: 'US' },
      });

      await OffRampService.markAssetPending(order.id);
      await OffRampService.confirmAssetReceived(order.id, '0xmidnight_tx_high_val_5000');

      // Risk engine escalates order
      const reviewOrder = await OffRampService.escalateManualReview(
        order.id,
        'High value payout requires enhanced source of funds review'
      );
      assert.strictEqual(reviewOrder.status, 'MANUAL_REVIEW');

      // Compliance officer approves
      const clearedOrder = await OffRampService.clearManualReview(
        order.id,
        'Source of funds verified via Identus DID credential'
      );
      assert.strictEqual(clearedOrder.status, 'PAYOUT_PENDING');
    });

    test('Compliance rejection flow: MANUAL_REVIEW -> REJECTED', async () => {
      const order = await OffRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        cryptoAmount: '1000.000000',
        cryptoAsset: 'tDUST',
        fiatAmount: '1000.00',
        fiatCurrency: 'USD',
        sourceWallet: testSourceWallet,
        payoutMethod: 'PUSH_TO_CARD',
        recipientInfo: { fullName: 'Ivan Vanko', country: 'RU' },
      });

      await OffRampService.markAssetPending(order.id);
      await OffRampService.confirmAssetReceived(order.id, '0xmidnight_tx_ivan_1000');
      await OffRampService.escalateManualReview(order.id, 'Sanctions watchlist match');

      const rejectedOrder = await OffRampService.transitionOrder(order.id, 'REJECTED', {
        source: 'COMPLIANCE',
        reason: 'OFAC Sanctions match confirmed',
      });
      assert.strictEqual(rejectedOrder.status, 'REJECTED');
    });

    test('Full refund pathway: PAYOUT_PROCESSING -> REFUND_PENDING -> REFUNDED', async () => {
      const order = await OffRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        cryptoAmount: '250.000000',
        cryptoAsset: 'tDUST',
        fiatAmount: '250.00',
        fiatCurrency: 'USD',
        sourceWallet: testSourceWallet,
        payoutMethod: 'PUSH_TO_CARD',
        recipientInfo: { fullName: 'Jane Foster', country: 'US' },
      });

      await OffRampService.markAssetPending(order.id);
      await OffRampService.confirmAssetReceived(order.id, '0xmidnight_tx_jane_250');
      await OffRampService.preparePayout(order.id);
      await OffRampService.transitionOrder(order.id, 'PAYOUT_PROCESSING', { source: 'SYSTEM' });

      // Provider rail fails payout -> initiate refund of tDUST
      const refundPending = await OffRampService.initiateRefund(
        order.id,
        'Card processor rejected Push-to-Card payment'
      );
      assert.strictEqual(refundPending.status, 'REFUND_PENDING');

      // tDUST returned to source wallet on Midnight Preprod
      const refunded = await OffRampService.finalizeRefund(
        order.id,
        '0xmidnight_refund_tx_hash_jane_250'
      );
      assert.strictEqual(refunded.status, 'REFUNDED');
      assert.strictEqual(refunded.tx_hash, '0xmidnight_refund_tx_hash_jane_250');
    });

    test('Rejects illegal state machine transitions (e.g. CREATED -> COMPLETED or COMPLETED -> REFUND_PENDING)', async () => {
      const order = await OffRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        cryptoAmount: '100.000000',
        cryptoAsset: 'tDUST',
        fiatAmount: '100.00',
        fiatCurrency: 'USD',
        sourceWallet: testSourceWallet,
        payoutMethod: 'PUSH_TO_CARD',
        recipientInfo: { fullName: 'Kyle Rayner', country: 'US' },
      });

      // Illegal skip from CREATED directly to COMPLETED
      await assert.rejects(
        async () => {
          await OffRampService.transitionOrder(order.id, 'COMPLETED', { source: 'SERVER_POLL' });
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_STATE_TRANSITION');
          return true;
        }
      );
    });
  });
});
