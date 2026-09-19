/**
 * NovaPay Phase 12 Test Suite: End-to-End Midnight Preview Settlement
 *
 * Exercises the authoritative 25-step settlement pipeline:
 *    Connect 1AM -> Verify Ownership -> Resolve DID -> Verify VC -> Verify ZK Proof ->
 *    Run Compliance -> Request FX Quote -> Lock Quote -> Create Remittance ->
 *    Create On-Ramp Order -> Complete Funding -> Verify Provider -> Verify Funding ->
 *    Prepare Midnight Tx -> Request Signature -> Submit to Midnight Preview -> Verify Blockchain Tx ->
 *    Wait for Finality -> Verify Recipient/Asset/Amount -> Create Off-Ramp Order ->
 *    Verify Asset Receipt -> Process Payout -> Verify Payout -> Verify 3-Way Reconciliation ->
 *    Complete Remittance.
 * 2. No shortcut, no fake state, no simulated blockchain success.
 * 3. Failure pathways:
 *    - Signature mismatch halts pipeline at Step 2.
 *    - Compliance/sanctions violation halts pipeline at Step 6.
 *    - Discrepancy detection in reconciliation.
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

// Configure test environment
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'novapay_test_jwt_secret_token_32chars_minimum!';
process.env.MIDNIGHT_NETWORK = 'preview';
process.env.MIDNIGHT_RPC_URL = 'https://rpc.preview.midnight.network';

const { SettlementOrchestratorService } = require('../build/services/settlement/settlement-orchestrator.service');
const { DIDService } = require('../build/services/identity/did.service');
const { VCService } = require('../build/services/identity/vc.service');
const { QuoteService } = require('../build/services/fx/quote.service');
const { RemittanceService } = require('../build/services/remittance/remittance.service');
const { OnRampService } = require('../build/services/onramp/onramp.service');
const { OffRampService } = require('../build/services/offramp/offramp.service');

describe('NovaPay Phase 12: End-to-End Midnight Preview Settlement Pipeline', () => {
  const aliceId = 'user_alice_settlement_tester_001';
  const aliceWallet = 'mn_preview_wallet_alice_1234567890abcdef';
  const bobWallet = 'mn_preview_wallet_bob_9876543210fedcba';

  beforeEach(async () => {
    SettlementOrchestratorService.clearCache();
    QuoteService.clearCache();
    RemittanceService.clearCache();
    OnRampService.clearCache();
    OffRampService.clearCache();
    VCService.memoryCache.clear();

    // Ensure Alice has an active KYC credential issued
    await DIDService.getOrCreateUserDID(aliceId);
    await VCService.issueKYCCredential(aliceId, {
      countryCode: 'US',
      amlCleared: true,
      jurisdictionAllowed: true,
      ageOver18: true,
      sanctionsCleared: true,
    });
  });

  describe('1. Full 25-Step Pipeline Execution (Success)', () => {
    test('Seamlessly runs all 25 steps on Midnight Preview to COMPLETED', async () => {
      const result = await SettlementOrchestratorService.executeEndToEndSettlement({
        userId: aliceId,
        senderWallet: aliceWallet,
        recipientWallet: bobWallet,
        senderFiatAmount: '500.00',
        senderFiatCurrency: 'USD',
        destinationFiatCurrency: 'EUR',
        recipientInfo: {
          fullName: 'Bob Builder',
          country: 'FR',
        },
        signature: 'valid_1am_signature_hex_token_preview_12345678',
        payoutMethod: 'PUSH_TO_CARD',
        purpose: 'Family support transfer',
      });

      // Pipeline verification
      assert.strictEqual(result.success, true, `Pipeline must succeed. Error: ${result.error}`);
      assert.strictEqual(result.currentStep, 25, 'Pipeline must complete step 25');
      assert.strictEqual(result.steps.length, 25, 'Must contain records for all 25 steps');

      // Verify all 25 steps executed with SUCCESS
      const stepNames = result.steps.map((s) => s.stepName);
      const expectedSteps = [
        'CONNECT_1AM',
        'VERIFY_WALLET_OWNERSHIP',
        'RESOLVE_DID',
        'VERIFY_CREDENTIAL',
        'VERIFY_ZK_PROOF',
        'RUN_COMPLIANCE',
        'REQUEST_FX_QUOTE',
        'LOCK_QUOTE',
        'CREATE_REMITTANCE',
        'CREATE_ONRAMP_ORDER',
        'COMPLETE_FUNDING',
        'VERIFY_PROVIDER_CONFIRMATION',
        'VERIFY_FUNDING',
        'PREPARE_MIDNIGHT_TX',
        'REQUEST_WALLET_SIGNATURE',
        'SUBMIT_TO_MIDNIGHT_PREVIEW',
        'VERIFY_BLOCKCHAIN_TX',
        'WAIT_FOR_CONFIRMATION',
        'VERIFY_RECIPIENT_ASSET_AMOUNT',
        'CREATE_OFFRAMP_ORDER',
        'VERIFY_ASSET_RECEIPT',
        'PROCESS_PAYOUT',
        'VERIFY_PAYOUT',
        'RECONCILE',
        'MARK_COMPLETED',
      ];
      assert.deepStrictEqual(stepNames, expectedSteps, 'All 25 step names must match exactly');

      for (const s of result.steps) {
        assert.strictEqual(s.status, 'SUCCESS', `Step ${s.stepNumber} (${s.stepName}) must be SUCCESS`);
      }

      // Check linked entities
      assert.ok(result.remittanceId, 'Remittance ID must be generated');
      assert.ok(result.quoteId, 'Quote ID must be linked');
      assert.ok(result.onRampOrderId, 'On-ramp order must be linked');
      assert.ok(result.offRampOrderId, 'Off-ramp order must be linked');
      assert.ok(result.blockchainTxHash, 'Midnight transaction hash must be recorded');
      assert.ok(result.reconciliationId, 'Reconciliation record must be created');

      // Verify Reconciliation record integrity
      const recon = SettlementOrchestratorService.getReconciliation(result.reconciliationId);
      assert.ok(recon, 'Reconciliation record must be retrievable');
      assert.strictEqual(recon.status, 'MATCHED');
      assert.strictEqual(recon.discrepancy.toString(), '0');

      // Verify Remittance status in state machine is COMPLETED
      const finalRem = await RemittanceService.getRemittance(aliceId, result.remittanceId);
      assert.strictEqual(finalRem.status, 'COMPLETED');
    });
  });

  describe('2. Pipeline Failure Pathways', () => {
    test('Halts at Step 2 if 1AM wallet signature is invalid', async () => {
      const result = await SettlementOrchestratorService.executeEndToEndSettlement({
        userId: aliceId,
        senderWallet: aliceWallet,
        recipientWallet: bobWallet,
        senderFiatAmount: '100.00',
        senderFiatCurrency: 'USD',
        destinationFiatCurrency: 'EUR',
        recipientInfo: { fullName: 'Bob', country: 'FR' },
        signature: 'INVALID_FORGED_SIGNATURE', // Triggers signature failure
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.currentStep, 2, 'Must halt at Step 2 (VERIFY_WALLET_OWNERSHIP)');
      assert.strictEqual(result.errorCode, 'INVALID_SIGNATURE');
      assert.strictEqual(result.remittanceId, undefined, 'Remittance must not be created');
      assert.strictEqual(result.blockchainTxHash, undefined, 'Blockchain transaction must not be submitted');
    });

    test('Halts at Step 6 if user compliance check is rejected', async () => {
      const sanctionedUser = 'user_sanctioned_adversary_999';
      await DIDService.getOrCreateUserDID(sanctionedUser);
      await VCService.issueKYCCredential(sanctionedUser, {
        countryCode: 'IR', // Sanctioned country code
        amlCleared: true,
        jurisdictionAllowed: false, // Flagged
        ageOver18: true,
        sanctionsCleared: false, // Sanctions hit
      });

      const result = await SettlementOrchestratorService.executeEndToEndSettlement({
        userId: sanctionedUser,
        senderWallet: 'mn_preview_wallet_sanctioned_user_address',
        recipientWallet: bobWallet,
        senderFiatAmount: '200.00',
        senderFiatCurrency: 'USD',
        destinationFiatCurrency: 'EUR',
        recipientInfo: { fullName: 'Adversary', country: 'IR' },
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.currentStep <= 6, `Must halt on or before Step 6. Halted at: ${result.currentStep}`);
      assert.ok(result.error.toLowerCase().includes('compliance') || result.error.toLowerCase().includes('proof'));
    });

    test('Rejects on-ramp/off-ramp bypass attempts from frontend', async () => {
      const order = await OnRampService.createOrder('WORLDPAY', {
        userId: aliceId,
        fiatAmount: '100.00',
        fiatCurrency: 'USD',
        destinationWallet: aliceWallet,
        paymentMethod: 'CREDIT_CARD',
      });

      // Rogue client tries to confirm payment directly
      await assert.rejects(
        async () => {
          await OnRampService.transitionOrder(order.id, 'PAYMENT_CONFIRMED', {
            source: 'FRONTEND',
            reason: 'Attacker attempting bypass',
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'UNAUTHORIZED_PAYOUT_COMPLETION' in err ? err.code : 'UNAUTHORIZED_PAYMENT_CONFIRMATION');
          return true;
        }
      );
    });
  });
});
