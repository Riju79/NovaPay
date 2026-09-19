/**
 * NovaPay Phase 10 Test Suite: On-Ramp Infrastructure
 *
 * Requirements Tested:
 * 1. OnRampProvider Interface Compliance (all 9 methods implemented).
 * 2. Locked Provider Targets: MoneyGram & Worldpay.
 *    - Official documentation verified.
 *    - Strict BLOCKED reporting with diagnostic technical rationale (no faking).
 * 3. OnRampOrder 10-State Machine:
 *    - CREATED, PAYMENT_PENDING, PAYMENT_CONFIRMED, CONVERSION_PENDING,
 *      ASSET_READY, FAILED, EXPIRED, CANCELLED, REFUND_PENDING, REFUNDED.
 * 4. Anti-Bypass Security Rule:
 *    - "Never trust frontend payment confirmation."
 *    - Direct client calls to declare payment confirmed are strictly rejected.
 * 5. Webhook signature verification and authoritative payment confirmation.
 * 6. Cancellation, expiration, and refund exception flows.
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

// Configure test environment
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'novapay_test_jwt_secret_token_32chars_minimum!';
process.env.MIDNIGHT_NETWORK = 'preview';
process.env.MONEYGRAM_WEBHOOK_SECRET = 'test_mg_secret_12345';
process.env.WORLDPAY_WEBHOOK_SECRET = 'test_wp_secret_67890';

const { OnRampService } = require('../build/services/onramp/onramp.service');
const { MoneyGramOnRampAdapter } = require('../build/services/onramp/moneygram-onramp.adapter');
const { WorldpayOnRampAdapter } = require('../build/services/onramp/worldpay-onramp.adapter');

describe('NovaPay Phase 10: On-Ramp Infrastructure', () => {
  const testUserId = 'user_onramp_tester_001';
  const testWallet = 'mn_preview_wallet_shielded_onramp_1234567890';

  beforeEach(() => {
    OnRampService.clearCache();
  });

  describe('1. OnRampProvider Interface Compliance & Locked Targets', () => {
    test('MoneyGram adapter implements all required interface methods', () => {
      const adapter = new MoneyGramOnRampAdapter('test_mg_secret_12345');
      const requiredMethods = [
        'createOrder',
        'getOrderStatus',
        'cancelOrder',
        'verifyWebhook',
        'parseWebhook',
        'getSupportedFiatCurrencies',
        'getSupportedAssets',
        'getSupportedCountries',
        'getSupportedPaymentMethods',
      ];

      for (const method of requiredMethods) {
        assert.strictEqual(
          typeof adapter[method],
          'function',
          `MoneyGramOnRampAdapter must implement ${method}`
        );
      }
    });

    test('Worldpay adapter implements all required interface methods', () => {
      const adapter = new WorldpayOnRampAdapter('test_wp_secret_67890');
      const requiredMethods = [
        'createOrder',
        'getOrderStatus',
        'cancelOrder',
        'verifyWebhook',
        'parseWebhook',
        'getSupportedFiatCurrencies',
        'getSupportedAssets',
        'getSupportedCountries',
        'getSupportedPaymentMethods',
      ];

      for (const method of requiredMethods) {
        assert.strictEqual(
          typeof adapter[method],
          'function',
          `WorldpayOnRampAdapter must implement ${method}`
        );
      }
    });

    test('Locked providers report BLOCKED with complete audit diagnostics (Do Not Fake It)', () => {
      const mg = new MoneyGramOnRampAdapter('test_mg_secret_12345');
      const wp = new WorldpayOnRampAdapter('test_wp_secret_67890');

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

    test('Direct payment dispatch to BLOCKED provider throws PROVIDER_BLOCKED', async () => {
      const order = await OnRampService.createOrder('MONEYGRAM', {
        userId: testUserId,
        fiatAmount: '100.00',
        fiatCurrency: 'USD',
        destinationWallet: testWallet,
        paymentMethod: 'CASH_AGENT',
      });

      assert.strictEqual(order.status, 'CREATED');

      await assert.rejects(
        async () => {
          await OnRampService.initiatePayment(order.id);
        },
        (err) => {
          assert.strictEqual(err.code, 'PROVIDER_BLOCKED');
          assert.ok(err.message.includes('blocked'));
          return true;
        }
      );
    });
  });

  describe('2. OnRampOrder 10-State Machine Forward Progression', () => {
    test('Order initializes in CREATED state', async () => {
      const order = await OnRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        fiatAmount: '250.00',
        fiatCurrency: 'EUR',
        cryptoAsset: 'tDUST',
        destinationWallet: testWallet,
        paymentMethod: 'CREDIT_CARD',
      });

      assert.strictEqual(order.status, 'CREATED');
      assert.strictEqual(order.fiat_currency, 'EUR');
      assert.strictEqual(order.destination_wallet, testWallet);
      assert.strictEqual(order.audit_trail.length, 1);
      assert.strictEqual(order.audit_trail[0].to, 'CREATED');
    });

    test('Full forward state machine progression: CREATED -> PAYMENT_PENDING -> PAYMENT_CONFIRMED -> CONVERSION_PENDING -> ASSET_READY', async () => {
      const order = await OnRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        fiatAmount: '500.00',
        fiatCurrency: 'USD',
        cryptoAmount: '500.000000',
        cryptoAsset: 'tDUST',
        destinationWallet: testWallet,
        paymentMethod: 'CREDIT_CARD',
      });

      // 1. CREATED -> PAYMENT_PENDING
      const pendingOrder = await OnRampService.transitionOrder(order.id, 'PAYMENT_PENDING', {
        source: 'SYSTEM',
        reason: 'Payment checkout URL opened by user',
      });
      assert.strictEqual(pendingOrder.status, 'PAYMENT_PENDING');

      // 2. PAYMENT_PENDING -> PAYMENT_CONFIRMED (Authoritative Server Confirmation)
      const confirmedOrder = await OnRampService.confirmPaymentAuthoritatively(
        order.id,
        'wp_pay_99887766',
        'Settlement confirmed via background polling'
      );
      assert.strictEqual(confirmedOrder.status, 'PAYMENT_CONFIRMED');
      assert.strictEqual(confirmedOrder.provider_order_id, 'wp_pay_99887766');

      // 3. PAYMENT_CONFIRMED -> CONVERSION_PENDING
      const conversionOrder = await OnRampService.startConversion(order.id);
      assert.strictEqual(conversionOrder.status, 'CONVERSION_PENDING');

      // 4. CONVERSION_PENDING -> ASSET_READY (Terminal Success)
      const finalOrder = await OnRampService.markAssetReady(
        order.id,
        '0xmidnight_tx_hash_dust_mint_preprod_abc123'
      );
      assert.strictEqual(finalOrder.status, 'ASSET_READY');
      assert.strictEqual(finalOrder.tx_hash, '0xmidnight_tx_hash_dust_mint_preprod_abc123');

      // Verify complete audit history contains all states
      const auditStates = finalOrder.audit_trail.map((a) => a.to);
      assert.deepStrictEqual(auditStates, [
        'CREATED',
        'PAYMENT_PENDING',
        'PAYMENT_CONFIRMED',
        'CONVERSION_PENDING',
        'ASSET_READY',
      ]);
    });
  });

  describe('3. Anti-Bypass Rule: Never Trust Frontend Payment Confirmation', () => {
    test('Frontend client attempting to declare PAYMENT_CONFIRMED is rejected with 403 / UNAUTHORIZED_PAYMENT_CONFIRMATION', async () => {
      const order = await OnRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        fiatAmount: '100.00',
        fiatCurrency: 'USD',
        destinationWallet: testWallet,
        paymentMethod: 'CREDIT_CARD',
      });

      await OnRampService.transitionOrder(order.id, 'PAYMENT_PENDING', {
        source: 'SYSTEM',
        reason: 'Payment pending',
      });

      // Rogue frontend client attempts to bypass payment confirmation
      await assert.rejects(
        async () => {
          await OnRampService.transitionOrder(order.id, 'PAYMENT_CONFIRMED', {
            source: 'FRONTEND', // Originates from client
            reason: 'User browser claims payment succeeded',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'UNAUTHORIZED_PAYMENT_CONFIRMATION');
          assert.ok(err.message.includes('Frontend client cannot assert'));
          return true;
        }
      );

      // Verify order remains in PAYMENT_PENDING
      const currentOrder = await OnRampService.getOrder(order.id);
      assert.strictEqual(currentOrder.status, 'PAYMENT_PENDING');
    });

    test('Frontend client attempting to assert ASSET_READY directly is rejected', async () => {
      const order = await OnRampService.createOrder('MONEYGRAM', {
        userId: testUserId,
        fiatAmount: '200.00',
        fiatCurrency: 'USD',
        destinationWallet: testWallet,
        paymentMethod: 'CASH_AGENT',
      });

      await assert.rejects(
        async () => {
          await OnRampService.transitionOrder(order.id, 'ASSET_READY', {
            source: 'FRONTEND',
            reason: 'Attacker attempting direct asset mint',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'UNAUTHORIZED_PAYMENT_CONFIRMATION');
          return true;
        }
      );
    });
  });

  describe('4. Authoritative Webhook Ingestion & Signature Verification', () => {
    test('Rejects webhook with invalid HMAC signature', async () => {
      const rawPayload = JSON.stringify({
        event: 'settled',
        paymentId: 'wp_test_1122',
        merchantReference: 'onramp_dummy_123',
      });

      await assert.rejects(
        async () => {
          await OnRampService.handleWebhook(
            'WORLDPAY',
            { 'x-worldpay-signature': 'invalid_forged_hex_signature' },
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

    test('Successfully parses valid Worldpay webhook and advances order to PAYMENT_CONFIRMED', async () => {
      const order = await OnRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        fiatAmount: '150.00',
        fiatCurrency: 'USD',
        destinationWallet: testWallet,
        paymentMethod: 'CREDIT_CARD',
      });

      await OnRampService.transitionOrder(order.id, 'PAYMENT_PENDING', {
        source: 'SYSTEM',
        reason: 'Session initiated',
      });

      // Construct authentic HMAC-SHA256 signature
      const payload = {
        event: 'settled',
        paymentId: 'wp_trans_999888',
        merchantReference: order.id,
        amount: 15000,
        currencyCode: 'USD',
      };
      const rawPayload = JSON.stringify(payload);
      const secret = process.env.WORLDPAY_WEBHOOK_SECRET || 'test_wp_secret_67890';
      const validSignature = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

      const webhookResult = await OnRampService.handleWebhook(
        'WORLDPAY',
        { 'x-worldpay-signature': validSignature },
        rawPayload,
        payload
      );

      assert.strictEqual(webhookResult.processed, true);
      assert.strictEqual(webhookResult.orderId, order.id);

      const updatedOrder = await OnRampService.getOrder(order.id);
      assert.strictEqual(updatedOrder.status, 'PAYMENT_CONFIRMED');
      assert.strictEqual(updatedOrder.provider_order_id, 'wp_trans_999888');
    });

    test('Successfully parses valid MoneyGram webhook and marks order PAYMENT_CONFIRMED', async () => {
      const order = await OnRampService.createOrder('MONEYGRAM', {
        userId: testUserId,
        fiatAmount: '300.00',
        fiatCurrency: 'USD',
        destinationWallet: testWallet,
        paymentMethod: 'CASH_AGENT',
      });

      await OnRampService.transitionOrder(order.id, 'PAYMENT_PENDING', {
        source: 'SYSTEM',
        reason: 'Cash agent deposit voucher created',
      });

      const payload = {
        event_type: 'COMPLETED',
        transaction_id: 'mg_tx_agent_777',
        external_reference: order.id,
        amount: '300.00',
        currency: 'USD',
      };
      const rawPayload = JSON.stringify(payload);
      const secret = process.env.MONEYGRAM_WEBHOOK_SECRET || 'test_mg_secret_12345';
      const signature = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

      const webhookResult = await OnRampService.handleWebhook(
        'MONEYGRAM',
        { 'x-moneygram-signature': signature },
        rawPayload,
        payload
      );

      assert.strictEqual(webhookResult.processed, true);
      const updatedOrder = await OnRampService.getOrder(order.id);
      assert.strictEqual(updatedOrder.status, 'PAYMENT_CONFIRMED');
    });
  });

  describe('5. Cancellation, Expiry, Refund, and Invalid State Transitions', () => {
    test('Allows cancellation from CREATED and PAYMENT_PENDING', async () => {
      const order1 = await OnRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        fiatAmount: '50.00',
        fiatCurrency: 'USD',
        destinationWallet: testWallet,
        paymentMethod: 'CREDIT_CARD',
      });

      const cancelled1 = await OnRampService.cancelOrder(order1.id, 'USER', 'User changed mind');
      assert.strictEqual(cancelled1.status, 'CANCELLED');

      const order2 = await OnRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        fiatAmount: '75.00',
        fiatCurrency: 'USD',
        destinationWallet: testWallet,
        paymentMethod: 'CREDIT_CARD',
      });
      await OnRampService.transitionOrder(order2.id, 'PAYMENT_PENDING', { source: 'SYSTEM' });
      const cancelled2 = await OnRampService.cancelOrder(order2.id, 'USER', 'Checkout aborted');
      assert.strictEqual(cancelled2.status, 'CANCELLED');
    });

    test('Allows expiration from PAYMENT_PENDING', async () => {
      const order = await OnRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        fiatAmount: '100.00',
        fiatCurrency: 'USD',
        destinationWallet: testWallet,
        paymentMethod: 'CREDIT_CARD',
      });
      await OnRampService.transitionOrder(order.id, 'PAYMENT_PENDING', { source: 'SYSTEM' });
      const expired = await OnRampService.expireOrder(order.id);
      assert.strictEqual(expired.status, 'EXPIRED');
    });

    test('Full refund pathway: PAYMENT_CONFIRMED -> REFUND_PENDING -> REFUNDED', async () => {
      const order = await OnRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        fiatAmount: '200.00',
        fiatCurrency: 'USD',
        destinationWallet: testWallet,
        paymentMethod: 'CREDIT_CARD',
      });

      await OnRampService.transitionOrder(order.id, 'PAYMENT_PENDING', { source: 'SYSTEM' });
      await OnRampService.confirmPaymentAuthoritatively(order.id, 'wp_ref_order_123');

      // Conversion to tDUST fails downstream; triggers refund
      const refundPending = await OnRampService.initiateRefund(order.id, 'tDUST minting RPC failure');
      assert.strictEqual(refundPending.status, 'REFUND_PENDING');

      const refunded = await OnRampService.finalizeRefund(order.id, 'Card refunded in full');
      assert.strictEqual(refunded.status, 'REFUNDED');
    });

    test('Rejects illegal state machine transitions (e.g. CREATED -> ASSET_READY or CANCELLED -> PAYMENT_CONFIRMED)', async () => {
      const order = await OnRampService.createOrder('WORLDPAY', {
        userId: testUserId,
        fiatAmount: '100.00',
        fiatCurrency: 'USD',
        destinationWallet: testWallet,
        paymentMethod: 'CREDIT_CARD',
      });

      // Illegal skip from CREATED to ASSET_READY
      await assert.rejects(
        async () => {
          await OnRampService.transitionOrder(order.id, 'ASSET_READY', { source: 'SYSTEM' });
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_STATE_TRANSITION');
          return true;
        }
      );

      // Cancel order
      await OnRampService.cancelOrder(order.id);

      // Illegal revival from terminal CANCELLED
      await assert.rejects(
        async () => {
          await OnRampService.transitionOrder(order.id, 'PAYMENT_CONFIRMED', { source: 'SERVER_POLL' });
        },
        (err) => {
          assert.strictEqual(err.code, 'INVALID_STATE_TRANSITION');
          return true;
        }
      );
    });
  });
});
