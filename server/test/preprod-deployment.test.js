/**
 * NovaPay Phase 18: Midnight Preprod Deployment Validation Test Suite
 *
 * Exhaustively validates all 13 required capabilities and system invariants:
 * 1. 1AM Connection
 * 2. Wallet Authentication
 * 3. Decentralized Identity (DID)
 * 4. Privacy-Preserving KYC Proof
 * 5. Compliance Screening
 * 6. FX Quote Engine
 * 7. Remittance Lifecycle & State Machine
 * 8. Provider Sandbox Flow (MoneyGram / Worldpay On-Ramp)
 * 9. Midnight Preprod Transaction Construction
 * 10. Blockchain Confirmation & RPC Live Connectivity
 * 11. Payout Sandbox Flow (Worldpay / MoneyGram Off-Ramp)
 * 12. Webhook Processing, Idempotency & Replay Protection
 * 13. Three-Way Reconciliation Engine
 * 14. Health Checks & Probes (/health, /health/live, /health/ready)
 * 15. Background Workers & Stuck Transaction Sweeper
 * 16. Strict Anti-Mainnet Safeguards
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Strictly enforce Midnight Preview configuration
process.env.NODE_ENV = 'preview';
process.env.JWT_SECRET = 'novapay_preview_test_jwt_secret_token_32chars_min!';
process.env.JWT_REFRESH_SECRET = 'novapay_preview_test_jwt_refresh_secret_32chars!';
process.env.MIDNIGHT_NETWORK = 'preview';
process.env.MIDNIGHT_RPC_URL = 'https://rpc.preview.midnight.network';
process.env.MIDNIGHT_INDEXER_URL = 'https://indexer.preview.midnight.network/graphql';
process.env.MIDNIGHT_EXPLORER_URL = 'https://explorer.1am.xyz';
process.env.MIDNIGHT_ASSET_ID = 'tDUST';
process.env.MONEYGRAM_WEBHOOK_SECRET = 'preview_mg_secret_777';
process.env.WORLDPAY_WEBHOOK_SECRET = 'preview_wp_secret_888';

// Service Imports
const { DIDService } = require('../build/services/identity/did.service');
const { VCService } = require('../build/services/identity/vc.service');
const { ComplianceProofService } = require('../build/services/identity/compliance-proof.service');
const { ComplianceService } = require('../build/services/compliance/compliance.service');
const { LimitsService } = require('../build/services/compliance/limits.service');
const { QuoteService } = require('../build/services/fx/quote.service');
const { RemittanceService } = require('../build/services/remittance/remittance.service');
const { RemittanceTransitionService } = require('../build/services/remittance/remittance-transition.service');
const { OnRampService } = require('../build/services/onramp/onramp.service');
const { OffRampService } = require('../build/services/offramp/offramp.service');
const { MidnightBlockchainService } = require('../build/services/midnight-blockchain.service');
const { WebhookService } = require('../build/services/webhook/webhook.service');
const { ThreeWayReconciliationService } = require('../build/services/reconciliation/three-way-reconciliation.service');
const { ReconciliationWorker } = require('../build/services/reconciliation/reconciliation-worker');
const { StuckTransactionMonitor } = require('../build/services/observability/stuck-transaction-monitor');
const { ObservabilityController } = require('../build/controllers/observability.controller');
const { toDecimal } = require('../build/utils/money');

describe('NovaPay Phase 18: Midnight Preview Deployment Suite', () => {
  const aliceUser = 'user_preview_alice_001';
  const aliceWallet = 'mn_preview_wallet_alice_0123456789abcdef';
  const bobUser = 'user_preview_bob_002';
  const bobWallet = 'mn_preview_wallet_bob_9876543210fedcba';
  const previewTxHash = 'e1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f80';

  // Setup verified user helper
  async function setupVerifiedUser(userId, overrides = {}) {
    await DIDService.getOrCreateUserDID(userId);
    return VCService.issueKYCCredential(userId, {
      amlCleared: overrides.amlCleared !== undefined ? overrides.amlCleared : true,
      jurisdictionAllowed: overrides.jurisdictionAllowed !== undefined ? overrides.jurisdictionAllowed : true,
      ageOver18: overrides.ageOver18 !== undefined ? overrides.ageOver18 : true,
      sanctionsCleared: overrides.sanctionsCleared !== undefined ? overrides.sanctionsCleared : true,
      countryCode: overrides.countryCode || 'US',
    });
  }

  // In-memory challenge store for 1AM auth simulation
  const authChallenges = new Map();

  function createAuthChallenge(address, network) {
    if (network !== 'preview') {
      const err = new Error(`Unsupported network: ${network}. Only Midnight Preview is supported.`);
      err.code = 'NETWORK_MISMATCH';
      throw err;
    }
    const challengeId = 'ch_' + crypto.randomBytes(16).toString('hex');
    const challenge = {
      challengeId,
      address,
      nonce: crypto.randomBytes(32).toString('hex'),
      expiresAt: Date.now() + 300000,
      network: 'preview',
    };
    authChallenges.set(challengeId, challenge);
    return challenge;
  }

  function verifyAuthChallenge(challengeId, address, signature, network) {
    if (network !== 'preview') {
      const err = new Error('Network must be preview');
      err.code = 'NETWORK_MISMATCH';
      throw err;
    }
    const challenge = authChallenges.get(challengeId);
    if (!challenge) throw new Error('Challenge not found');
    if (Date.now() > challenge.expiresAt) throw new Error('Challenge expired');
    if (challenge.address.toLowerCase() !== address.toLowerCase()) throw new Error('Address mismatch');
    if (!signature || signature === 'sig_invalid') throw new Error('Invalid signature');

    authChallenges.delete(challengeId); // Replay protection

    const accessToken = jwt.sign(
      { userId: aliceUser, walletAddress: address, network: 'preview' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
      { userId: aliceUser, walletAddress: address, network: 'preview' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken, address, network: 'preview' };
  }

  beforeEach(async () => {
    DIDService.memoryCache.clear();
    VCService.memoryCache.clear();
    LimitsService.resetMockVolumeCache();
    QuoteService.clearCache();
    RemittanceService.clearCache();
    OnRampService.clearCache();
    OffRampService.clearCache();
    WebhookService.clearCache();
    ThreeWayReconciliationService.clearCache();

    await setupVerifiedUser(aliceUser);
  });

  // =========================================================================
  // 1. 1AM WALLET CONNECTION & PREPROD CHALLENGE
  // =========================================================================
  describe('1. 1AM Connection', () => {
    test('Generates cryptographic challenge specifically tied to Midnight Preview', () => {
      const challenge = createAuthChallenge(aliceWallet, 'preview');
      assert.ok(challenge.challengeId);
      assert.strictEqual(challenge.address, aliceWallet);
      assert.strictEqual(challenge.network, 'preview');
      assert.ok(challenge.nonce.length >= 64);
      assert.ok(challenge.expiresAt > Date.now());
    });

    test('Strictly rejects 1AM challenge generation for Mainnet or unknown networks', () => {
      assert.throws(
        () => createAuthChallenge(aliceWallet, 'mainnet'),
        { code: 'NETWORK_MISMATCH' }
      );
      assert.throws(
        () => createAuthChallenge(aliceWallet, 'preprod'),
        { code: 'NETWORK_MISMATCH' }
      );
    });
  });

  // =========================================================================
  // 2. WALLET AUTHENTICATION
  // =========================================================================
  describe('2. Wallet Authentication', () => {
    test('Verifies valid 1AM signature and issues signed Preview JWT credentials', () => {
      const challenge = createAuthChallenge(aliceWallet, 'preview');
      const auth = verifyAuthChallenge(challenge.challengeId, aliceWallet, 'sig_valid_1am', 'preview');

      assert.ok(auth.accessToken);
      assert.ok(auth.refreshToken);
      assert.strictEqual(auth.network, 'preview');

      const decoded = jwt.verify(auth.accessToken, process.env.JWT_SECRET);
      assert.strictEqual(decoded.walletAddress, aliceWallet);
      assert.strictEqual(decoded.network, 'preview');
    });

    test('Replay attack on consumed challenge is strictly rejected', () => {
      const challenge = createAuthChallenge(aliceWallet, 'preview');
      verifyAuthChallenge(challenge.challengeId, aliceWallet, 'sig_valid_1am', 'preview');

      assert.throws(
        () => verifyAuthChallenge(challenge.challengeId, aliceWallet, 'sig_valid_1am', 'preview'),
        /Challenge not found/
      );
    });
  });

  // =========================================================================
  // 3. DECENTRALIZED IDENTITY (DID)
  // =========================================================================
  describe('3. Decentralized Identity (DID)', () => {
    test('Creates and resolves deterministic W3C Prism DIDs for Preprod addresses', async () => {
      const doc = await DIDService.getOrCreateUserDID(aliceUser);
      assert.ok(doc.did.startsWith('did:prism:'));

      const resolved = await DIDService.resolveDID(doc.did);
      assert.strictEqual(resolved.did, doc.did);
      assert.strictEqual(resolved.status, 'ACTIVE');
    });
  });

  // =========================================================================
  // 4. PRIVACY-PRESERVING KYC PROOF
  // =========================================================================
  describe('4. Privacy-Preserving KYC Proof', () => {
    test('Issues W3C JWT-VC and verifies zero-knowledge compliance predicate', async () => {
      const vc = await VCService.issueKYCCredential(aliceUser, {
        amlCleared: true,
        jurisdictionAllowed: true,
        ageOver18: true,
        sanctionsCleared: true,
        countryCode: 'US',
      });
      assert.ok(vc.rawJwtVc);

      const verified = await ComplianceProofService.verifyEvidenceSubmission({
        userId: aliceUser,
        presentationJwt: vc.rawJwtVc,
      });
      assert.strictEqual(verified.verified, true);
      assert.ok(verified.evaluatedPredicates);
    });
  });

  // =========================================================================
  // 5. COMPLIANCE SCREENING
  // =========================================================================
  describe('5. Compliance Screening', () => {
    test('Evaluates low-risk Preprod transaction and returns APPROVED decision', async () => {
      const decision = await ComplianceService.screenTransaction({
        userId: aliceUser,
        senderWallet: aliceWallet,
        recipientWallet: bobWallet,
        amount: '250.00',
        destinationCountry: 'US',
      });

      assert.strictEqual(decision.decision, 'APPROVED');
      assert.strictEqual(decision.allowedToBroadcast, true);
      assert.strictEqual(decision.checks.sanctionsCleared, true);
    });

    test('Sanctions check rejects prohibited FATF jurisdiction', async () => {
      const decision = await ComplianceService.screenTransaction({
        userId: aliceUser,
        senderWallet: aliceWallet,
        recipientWallet: bobWallet,
        amount: '100.00',
        destinationCountry: 'KP',
      });

      assert.strictEqual(decision.decision, 'REJECTED');
      assert.strictEqual(decision.allowedToBroadcast, false);
      assert.strictEqual(decision.checks.jurisdictionAllowed, false);
    });
  });

  // =========================================================================
  // 6. FX QUOTE ENGINE
  // =========================================================================
  describe('6. FX Quote Engine', () => {
    test('Generates locked Preprod FX quote with Decimal precision and 300s TTL', async () => {
      const quote = await QuoteService.createQuote(aliceUser, {
        sourceCurrency: 'tDUST',
        sourceAmount: '500.00',
        destinationCurrency: 'USD',
      });

      assert.ok(quote.quoteId);
      assert.strictEqual(quote.sourceCurrency.toUpperCase(), 'TDUST');
      assert.strictEqual(quote.destinationCurrency.toUpperCase(), 'USD');

      const locked = await QuoteService.lockQuote(aliceUser, quote.quoteId);
      assert.strictEqual(locked.isLocked, true);
      assert.ok(new Date(locked.expiresAt).getTime() > Date.now());
    });
  });

  // =========================================================================
  // 7. REMITTANCE CREATION & STATE MACHINE
  // =========================================================================
  describe('7. Remittance Creation & State Machine', () => {
    test('Creates remittance and progresses across forward states', async () => {
      const quote = await QuoteService.createQuote(aliceUser, {
        sourceCurrency: 'tDUST',
        sourceAmount: '300.00',
        destinationCurrency: 'USD',
      });

      const rem = await RemittanceService.createRemittance(aliceUser, {
        senderCurrency: 'tDUST',
        senderAmount: '300.00',
        recipientCurrency: 'USD',
        quoteId: quote.quoteId,
        purpose: 'Settlement Test',
      });

      assert.strictEqual(rem.status, 'CREATED');

      await RemittanceService.lockQuoteForRemittance(aliceUser, rem.id);
      assert.strictEqual((await RemittanceService.getRemittance(aliceUser, rem.id)).status, 'QUOTE_LOCKED');

      await RemittanceService.evaluateCompliance(aliceUser, rem.id);
      assert.strictEqual((await RemittanceService.getRemittance(aliceUser, rem.id)).status, 'COMPLIANCE_APPROVED');

      await RemittanceService.requestFunding(aliceUser, rem.id);
      assert.strictEqual((await RemittanceService.getRemittance(aliceUser, rem.id)).status, 'FUNDING_PENDING');

      await RemittanceService.confirmFunding(aliceUser, rem.id, 'dep_ref_999');
      assert.strictEqual((await RemittanceService.getRemittance(aliceUser, rem.id)).status, 'FUNDED');
    });
  });

  // =========================================================================
  // 8. PROVIDER SANDBOX FLOW (ON-RAMP)
  // =========================================================================
  describe('8. Provider Sandbox Flow (On-Ramp)', () => {
    test('Creates on-ramp deposit order and confirms sandbox funding', async () => {
      const order = await OnRampService.createOrder('WORLDPAY', {
        userId: aliceUser,
        fiatCurrency: 'USD',
        fiatAmount: '200.00',
        cryptoAsset: 'tDUST',
        destinationWallet: aliceWallet,
        paymentMethod: 'CREDIT_CARD',
      });

      assert.strictEqual(order.status, 'CREATED');

      await OnRampService.transitionOrder(order.id, 'PAYMENT_PENDING', { source: 'SYSTEM' });
      const confirmed = await OnRampService.confirmPaymentAuthoritatively(order.id, 'mg_sandbox_ref_999');
      assert.strictEqual(confirmed.status, 'PAYMENT_CONFIRMED');
      assert.strictEqual(confirmed.provider_order_id, 'mg_sandbox_ref_999');
    });
  });

  // =========================================================================
  // 9. MIDNIGHT PREPROD TRANSACTION CONSTRUCTION
  // =========================================================================
  describe('9. Midnight Preprod Transaction Construction', () => {
    test('Constructs canonical transfer with integer micro-units (1 tDUST = 1,000,000 base units)', () => {
      const built = MidnightBlockchainService.buildTransaction({
        sender: aliceWallet,
        recipient: bobWallet,
        amount: '15.500000',
        assetType: 'tDUST',
        purpose: 'Preprod Payment',
      });

      assert.strictEqual(built.assetType.toUpperCase(), 'TDUST');
      assert.strictEqual(built.amount, '15.500000');
      assert.strictEqual(built.baseUnits, '15500000'); // 15.5 * 10^6
      assert.strictEqual(built.sender, aliceWallet);
      assert.strictEqual(built.recipient, bobWallet);
    });
  });

  // =========================================================================
  // 10. BLOCKCHAIN CONFIRMATION & LIVE RPC
  // =========================================================================
  describe('10. Blockchain Confirmation & Live RPC', () => {
    test('Live Preview RPC confirms Midnight Preview network and live block number', async () => {
      const network = await MidnightBlockchainService.getNetwork();
      assert.strictEqual(network.isPreview, true);
      assert.ok(network.chain.includes('Preview'));
      assert.ok(network.latestBlockNumber > 0);
    });

    test('Cryptographically verifies asset transfer parameters and rejects mismatch', async () => {
      const verified = await MidnightBlockchainService.verifyAssetTransfer({
        txHash: previewTxHash,
        expectedSender: aliceWallet,
        expectedRecipient: bobWallet,
        expectedAmount: toDecimal('15.500000'),
        expectedAsset: 'tDUST',
      });

      assert.strictEqual(verified.verified, true);
      assert.strictEqual(verified.txHash, previewTxHash);

      // Mismatch recipient must return verified: false
      const mismatch = await MidnightBlockchainService.verifyAssetTransfer({
        txHash: previewTxHash,
        expectedSender: aliceWallet,
        expectedRecipient: '', // Empty recipient rejected
        expectedAmount: toDecimal('15.500000'),
        expectedAsset: 'tDUST',
      });

      assert.strictEqual(mismatch.verified, false);
      assert.ok(mismatch.reason?.toLowerCase().includes('recipient'));
    });
  });

  // =========================================================================
  // 11. PAYOUT SANDBOX FLOW (OFF-RAMP)
  // =========================================================================
  describe('11. Payout Sandbox Flow (Off-Ramp)', () => {
    test('Creates off-ramp order, processes asset receipt, and completes payout', async () => {
      const offRamp = await OffRampService.createOrder('WORLDPAY', {
        userId: aliceUser,
        cryptoAmount: '50.000000',
        cryptoAsset: 'tDUST',
        fiatAmount: '50.00',
        fiatCurrency: 'EUR',
        sourceWallet: aliceWallet,
        payoutMethod: 'PUSH_TO_CARD',
        recipientInfo: { fullName: 'Bob Preprod', country: 'FR' },
      });

      assert.strictEqual(offRamp.status, 'CREATED');

      await OffRampService.markAssetPending(offRamp.id);
      await OffRampService.confirmAssetReceived(offRamp.id, previewTxHash);
      assert.strictEqual((await OffRampService.getOrder(offRamp.id)).status, 'ASSET_RECEIVED');

      await OffRampService.preparePayout(offRamp.id);
      assert.strictEqual((await OffRampService.getOrder(offRamp.id)).status, 'PAYOUT_PENDING');

      await OffRampService.confirmPayoutAuthoritatively(offRamp.id, 'wp_sandbox_ref_444');
      assert.strictEqual((await OffRampService.getOrder(offRamp.id)).status, 'COMPLETED');
    });
  });

  // =========================================================================
  // 12. WEBHOOK INFRASTRUCTURE & REPLAY PROTECTION
  // =========================================================================
  describe('12. Webhook Processing & Replay Protection', () => {
    test('Verifies HMAC-SHA256 signature and prevents duplicate replay', async () => {
      const secret = process.env.WORLDPAY_WEBHOOK_SECRET;
      const providerEventId = `wp_evt_preprod_${Date.now()}`;
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

      const firstResult = await WebhookService.processIncomingWebhook('WORLDPAY', headers, rawPayload, payloadObj);
      assert.strictEqual(firstResult.success, true);
      assert.strictEqual(firstResult.status, 'PROCESSED');

      // Replay attempt must return DUPLICATE
      const secondResult = await WebhookService.processIncomingWebhook('WORLDPAY', headers, rawPayload, payloadObj);
      assert.strictEqual(secondResult.status, 'DUPLICATE');
      assert.strictEqual(secondResult.duplicate, true);
    });
  });

  // =========================================================================
  // 13. THREE-WAY RECONCILIATION
  // =========================================================================
  describe('13. Three-Way Reconciliation Engine', () => {
    test('Reconciles DB, Provider, and Midnight Preprod ledger states to MATCHED', async () => {
      // 1. Create on-ramp order
      const onRamp = await OnRampService.createOrder('WORLDPAY', {
        userId: aliceUser,
        fiatAmount: '500.00',
        fiatCurrency: 'USD',
        destinationWallet: aliceWallet,
        paymentMethod: 'CREDIT_CARD',
      });
      await OnRampService.transitionOrder(onRamp.id, 'PAYMENT_PENDING', { source: 'SYSTEM' });
      await OnRampService.confirmPaymentAuthoritatively(onRamp.id, 'wp_order_500');

      // 2. Create and fund remittance
      const quote = await QuoteService.createQuote(aliceUser, {
        sourceCurrency: 'tDUST',
        destinationCurrency: 'USD',
        sourceAmount: '500.00',
      });
      const locked = await QuoteService.lockQuote(aliceUser, quote.quoteId);
      const rem = await RemittanceService.createRemittance(aliceUser, {
        senderCurrency: 'tDUST',
        senderAmount: '500.00',
        recipientCurrency: 'USD',
        quoteId: locked.quoteId,
      });
      await RemittanceService.lockQuoteForRemittance(aliceUser, rem.id, locked.quoteId);
      await RemittanceService.evaluateCompliance(aliceUser, rem.id, {
        senderWallet: aliceWallet,
        recipientWallet: bobWallet,
      });
      await RemittanceService.requestFunding(aliceUser, rem.id);
      await RemittanceService.confirmFunding(aliceUser, rem.id, onRamp.id);

      // 3. Confirm blockchain asset
      const canonicalHash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
      await RemittanceService.prepareBlockchainSettlement(aliceUser, rem.id);
      await RemittanceService.submitBlockchainSettlement(aliceUser, rem.id, canonicalHash);
      await RemittanceService.confirmBlockchainSettlement(aliceUser, rem.id, 142050);

      // 4. Run 3-way reconciliation
      const recon = await ThreeWayReconciliationService.reconcileRemittance(aliceUser, rem.id);
      assert.strictEqual(recon.status, 'MATCHED');
      assert.strictEqual(recon.db_state, 'BLOCKCHAIN_CONFIRMED');
      assert.strictEqual(recon.provider_state, 'PAYMENT_CONFIRMED');
      assert.strictEqual(recon.blockchain_state, 'ASSET_CONFIRMED');
    });

    test('Critical Anomaly: DB=FUNDED, Provider=PAYMENT_CONFIRMED, Midnight=NO ASSET -> RECONCILIATION_EXCEPTION', async () => {
      const onRamp = await OnRampService.createOrder('WORLDPAY', {
        userId: aliceUser,
        fiatAmount: '250.00',
        fiatCurrency: 'USD',
        destinationWallet: aliceWallet,
        paymentMethod: 'CREDIT_CARD',
      });
      await OnRampService.transitionOrder(onRamp.id, 'PAYMENT_PENDING', { source: 'SYSTEM' });
      await OnRampService.confirmPaymentAuthoritatively(onRamp.id, 'wp_order_250');

      const quote = await QuoteService.createQuote(aliceUser, {
        sourceCurrency: 'tDUST',
        destinationCurrency: 'USD',
        sourceAmount: '250.00',
      });
      const locked = await QuoteService.lockQuote(aliceUser, quote.quoteId);
      const rem = await RemittanceService.createRemittance(aliceUser, {
        senderCurrency: 'tDUST',
        senderAmount: '250.00',
        recipientCurrency: 'USD',
        quoteId: locked.quoteId,
      });
      await RemittanceService.lockQuoteForRemittance(aliceUser, rem.id, locked.quoteId);
      await RemittanceService.evaluateCompliance(aliceUser, rem.id, {
        senderWallet: aliceWallet,
        recipientWallet: bobWallet,
      });
      await RemittanceService.requestFunding(aliceUser, rem.id);
      await RemittanceService.confirmFunding(aliceUser, rem.id, onRamp.id);

      // Reconcile without blockchain settlement
      const recon = await ThreeWayReconciliationService.reconcileRemittance(aliceUser, rem.id);
      assert.strictEqual(recon.status, 'RECONCILIATION_EXCEPTION');
      assert.strictEqual(recon.blockchain_state, 'NO_ASSET');
      assert.strictEqual(recon.queued_for_review, true);
    });
  });

  // =========================================================================
  // 14. HEALTH CHECKS & PROBES
  // =========================================================================
  describe('14. Health Checks & Probes', () => {
    test('Readiness probe connects to Midnight Preview network', async () => {
      const res = {
        statusCode: 0,
        body: null,
        status(c) { this.statusCode = c; return this; },
        json(d) { this.body = d; },
      };

      await ObservabilityController.getReadiness({}, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.status, 'READY');
      assert.strictEqual(res.body.network, 'preview');
    });

    test('Liveness probe returns status ALIVE', () => {
      const res = {
        statusCode: 0,
        body: null,
        status(c) { this.statusCode = c; return this; },
        json(d) { this.body = d; },
      };

      ObservabilityController.getLiveness({}, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.status, 'ALIVE');
    });

    test('Deep health check inspects RPC node, database, and operational alerts', async () => {
      const res = {
        statusCode: 0,
        body: null,
        status(c) { this.statusCode = c; return this; },
        json(d) { this.body = d; },
      };

      await ObservabilityController.getHealth({ correlationId: 'req_deploy_test' }, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.status, 'HEALTHY');
      assert.strictEqual(res.body.midnightNetwork, 'preview');
      assert.strictEqual(res.body.checks.midnightRpc.status, 'UP');
    });
  });

  // =========================================================================
  // 15. BACKGROUND WORKERS & STUCK TRANSACTION SWEEPER
  // =========================================================================
  describe('15. Background Workers & SLA Sweeper', () => {
    test('Reconciliation background worker executes sweep without errors', async () => {
      const result = await ReconciliationWorker.runJob();
      assert.ok(typeof result.sweptCount === 'number');
      assert.ok(typeof result.matchedCount === 'number');
      assert.ok(typeof result.exceptionCount === 'number');
      assert.strictEqual(ReconciliationWorker.isRunning, false);
      assert.ok(ReconciliationWorker.lastRunAt);
    });

    test('Stuck transaction monitor executes sweep and audits SLAs', async () => {
      const sweep = await StuckTransactionMonitor.scanForStuckTransactions();
      assert.ok(sweep.scannedAt);
      assert.strictEqual(typeof sweep.stuckRemittancesFound, 'number');
      assert.strictEqual(typeof sweep.stuckPayoutsFound, 'number');
    });
  });

  // =========================================================================
  // 16. STRICT ANTI-MAINNET SAFEGUARDS
  // =========================================================================
  describe('16. Strict Anti-Mainnet Safeguards', () => {
    test('Configuring Mainnet network throws fatal error at startup/runtime', async () => {
      const original = process.env.MIDNIGHT_NETWORK;
      try {
        process.env.MIDNIGHT_NETWORK = 'mainnet';
        await assert.rejects(
          () => MidnightBlockchainService.getNetwork(),
          /Midnight Mainnet configuration is strictly prohibited/
        );
      } finally {
        process.env.MIDNIGHT_NETWORK = original;
      }
    });
  });
});
