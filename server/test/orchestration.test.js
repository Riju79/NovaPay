/**
 * NovaPay Phase 7 Test Suite: Compliance Orchestration Engine
 *
 * Tests the 10-step compliance pipeline:
 * Wallet -> DID -> Credential -> ZK Proof -> Sanctions -> Jurisdiction -> Risk -> Limits -> SoF -> Decision
 *
 * Required Scenarios:
 * 1. approved
 * 2. rejected (unverified, prohibited jurisdiction, unauthenticated wallet)
 * 3. manual review (high risk score, high amount lacking source of funds)
 * 4. expired credential
 * 5. invalid proof
 * 6. revoked credential
 * 7. limit exceeded (single transaction and rolling 24h velocity)
 * 8. audit history & privacy-preserving evidence
 */

const { test, describe, beforeEach } = require('node:test')
const assert = require('node:assert')

// Configure test environment
process.env.NODE_ENV = 'development'
process.env.JWT_SECRET = 'novapay_test_jwt_secret_token_32chars_minimum!'
process.env.MIDNIGHT_NETWORK = 'preview'

const { ComplianceService } = require('../build/services/compliance/compliance.service')
const { RiskService } = require('../build/services/compliance/risk.service')
const { LimitsService } = require('../build/services/compliance/limits.service')
const { DIDService } = require('../build/services/identity/did.service')
const { VCService } = require('../build/services/identity/vc.service')
const { toDecimal } = require('../build/utils/money')

describe('NovaPay Phase 7: Compliance Orchestration Engine', () => {

  const testSenderWallet = '0x1am_orchestration_sender_address_valid'
  const testRecipientWallet = '0x1am_orchestration_recipient_address_valid'

  beforeEach(() => {
    // Clear in-memory caches between tests
    LimitsService.resetMockVolumeCache()
    DIDService.memoryCache.clear()
    VCService.memoryCache.clear()
  })

  // Helper to issue standard valid KYC credential
  async function setupVerifiedUser(userId, overrides = {}) {
    await DIDService.getOrCreateUserDID(userId)
    const issuedVC = await VCService.issueKYCCredential(userId, {
      amlCleared: overrides.amlCleared !== undefined ? overrides.amlCleared : true,
      jurisdictionAllowed: overrides.jurisdictionAllowed !== undefined ? overrides.jurisdictionAllowed : true,
      ageOver18: overrides.ageOver18 !== undefined ? overrides.ageOver18 : true,
      sanctionsCleared: overrides.sanctionsCleared !== undefined ? overrides.sanctionsCleared : true,
      countryCode: overrides.countryCode || 'US',
    })

    if (overrides.status || overrides.isExpired) {
      const userVCs = VCService.memoryCache.get(userId) || []
      if (userVCs.length > 0) {
        if (overrides.status) userVCs[0].status = overrides.status
        if (overrides.isExpired) {
          userVCs[0].expirationDate = new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
        }
        VCService.memoryCache.set(userId, userVCs)
      }
    }

    return issuedVC
  }

  // 1. APPROVED
  describe('Scenario 1: Approved Transaction', () => {
    test('Approves clean transaction with valid DID, active KYC credential, and valid ZK proof', async () => {
      const userId = 'user_approved_001'
      const issuedVC = await setupVerifiedUser(userId)

      const proofToken = Buffer.from(JSON.stringify({
        predicate: 'KYC_VERIFIED',
        valid: true,
        zkProofHash: '0x' + 'a'.repeat(64),
      })).toString('base64')

      const decision = await ComplianceService.screenTransaction({
        userId,
        senderWallet: testSenderWallet,
        recipientWallet: testRecipientWallet,
        amount: '250.00',
        destinationCountry: 'US',
        complianceProofToken: proofToken,
      })

      assert.strictEqual(decision.decision, 'APPROVED')
      assert.strictEqual(decision.allowedToBroadcast, true)
      assert.strictEqual(decision.checks.didVerified, true)
      assert.strictEqual(decision.identity.credentialStatus, 'ACTIVE')
      assert.ok(decision.risk.riskScore < 70)
      assert.ok(decision.decisionReason.includes('cleared'))
    })
  })

  // 2. REJECTED
  describe('Scenario 2: Rejected Transactions', () => {
    test('Rejects Tier 0 / Unverified account with no KYC credential', async () => {
      const unverifiedUserId = 'user_unverified_999'
      await DIDService.getOrCreateUserDID(unverifiedUserId)
      // No credential issued

      const decision = await ComplianceService.screenTransaction({
        userId: unverifiedUserId,
        senderWallet: testSenderWallet,
        recipientWallet: testRecipientWallet,
        amount: '50.00',
        destinationCountry: 'US',
      })

      assert.strictEqual(decision.decision, 'REJECTED')
      assert.strictEqual(decision.allowedToBroadcast, false)
      assert.strictEqual(decision.identity.tier, 'TIER_0')
      assert.ok(decision.decisionReason.includes('Unverified accounts cannot send funds'))
    })

    test('Rejects transactions destined to or originating from Prohibited Jurisdiction (OFAC/FATF)', async () => {
      const userId = 'user_sanctioned_country_002'
      await setupVerifiedUser(userId)

      const prohibitedJurisdictions = ['KP', 'IR', 'SY', 'CU', 'RU-CR']

      for (const country of prohibitedJurisdictions) {
        const decision = await ComplianceService.screenTransaction({
          userId,
          senderWallet: testSenderWallet,
          recipientWallet: testRecipientWallet,
          amount: '100.00',
          destinationCountry: country,
        })

        assert.strictEqual(decision.decision, 'REJECTED', `Expected country ${country} to be rejected`)
        assert.strictEqual(decision.allowedToBroadcast, false)
        assert.ok(decision.decisionReason.includes('prohibited country') || decision.decisionReason.includes('CRITICAL'))
      }
    })

    test('Rejects missing wallet authentication or address mismatch', async () => {
      const userId = 'user_no_wallet_003'
      await setupVerifiedUser(userId)

      const decision = await ComplianceService.screenTransaction({
        userId,
        senderWallet: '',
        recipientWallet: testRecipientWallet,
        amount: '50.00',
      })

      assert.strictEqual(decision.decision, 'REJECTED')
      assert.strictEqual(decision.allowedToBroadcast, false)
      assert.ok(decision.decisionReason.includes('Authentication failure'))
    })
  })

  // 3. MANUAL REVIEW
  describe('Scenario 3: Manual Review Escalations', () => {
    test('Escalates high-value transactions (>= 1,000 tDUST) lacking Source of Funds declaration to MANUAL_REVIEW', async () => {
      const userId = 'user_sof_review_004'
      await setupVerifiedUser(userId)

      const decision = await ComplianceService.screenTransaction({
        userId,
        senderWallet: testSenderWallet,
        recipientWallet: testRecipientWallet,
        amount: '1000.00', // Exactly at threshold
        destinationCountry: 'US',
        sourceOfFundsDeclared: false, // Not declared
      })

      assert.strictEqual(decision.decision, 'MANUAL_REVIEW')
      assert.strictEqual(decision.allowedToBroadcast, false)
      assert.ok(decision.limits.requiresSourceOfFunds)
      assert.ok(decision.decisionReason.includes('Source-of-Funds'))
    })

    test('Escalates elevated risk score (70-89) to MANUAL_REVIEW', async () => {
      const userId = 'user_high_risk_005'
      await setupVerifiedUser(userId)

      // Sending large amount to elevated risk country (MM - Myanmar) triggers high risk
      const decision = await ComplianceService.screenTransaction({
        userId,
        senderWallet: testSenderWallet,
        recipientWallet: testRecipientWallet,
        amount: '900.00',
        destinationCountry: 'MM', // Elevated risk country (+25 pts) + amount (+20 pts) + recipient (+10 pts)
      })

      assert.strictEqual(decision.decision, 'MANUAL_REVIEW')
      assert.strictEqual(decision.allowedToBroadcast, false)
      assert.strictEqual(decision.risk.riskLevel, 'HIGH')
      assert.ok(decision.decisionReason.includes('Elevated risk score'))
    })
  })

  // 4. EXPIRED CREDENTIAL
  describe('Scenario 4: Expired Credential', () => {
    test('Escalates expired KYC credential to MANUAL_REVIEW (compliance hold)', async () => {
      const userId = 'user_expired_cred_006'
      await setupVerifiedUser(userId, { isExpired: true })

      const decision = await ComplianceService.screenTransaction({
        userId,
        senderWallet: testSenderWallet,
        recipientWallet: testRecipientWallet,
        amount: '100.00',
        destinationCountry: 'US',
      })

      assert.strictEqual(decision.decision, 'MANUAL_REVIEW')
      assert.strictEqual(decision.allowedToBroadcast, false)
      assert.ok(decision.decisionReason.includes('EXPIRED'))
    })
  })

  // 5. INVALID PROOF
  describe('Scenario 5: Invalid ZK Proof', () => {
    test('Rejects transaction with tampered or invalid ZK compliance proof token', async () => {
      const userId = 'user_invalid_proof_007'
      await setupVerifiedUser(userId)

      const tamperedProofToken = Buffer.from(JSON.stringify({
        predicate: 'KYC_VERIFIED',
        valid: false, // Invalid proof predicate
        tampered: true,
      })).toString('base64')

      const decision = await ComplianceService.screenTransaction({
        userId,
        senderWallet: testSenderWallet,
        recipientWallet: testRecipientWallet,
        amount: '100.00',
        destinationCountry: 'US',
        complianceProofToken: tamperedProofToken,
      })

      assert.strictEqual(decision.decision, 'REJECTED')
      assert.strictEqual(decision.allowedToBroadcast, false)
      assert.ok(decision.decisionReason.includes('Proof failure'))
    })

    test('Rejects explicitly malformed or forged proof token', async () => {
      const userId = 'user_forged_proof_008'
      await setupVerifiedUser(userId)

      const decision = await ComplianceService.screenTransaction({
        userId,
        senderWallet: testSenderWallet,
        recipientWallet: testRecipientWallet,
        amount: '100.00',
        destinationCountry: 'US',
        complianceProofToken: 'INVALID_PROOF',
      })

      assert.strictEqual(decision.decision, 'REJECTED')
      assert.strictEqual(decision.allowedToBroadcast, false)
      assert.ok(decision.decisionReason.includes('Proof failure'))
    })
  })

  // 6. REVOKED CREDENTIAL
  describe('Scenario 6: Revoked Credential', () => {
    test('Immediately rejects transactions when KYC credential has status REVOKED', async () => {
      const userId = 'user_revoked_cred_009'
      await setupVerifiedUser(userId, { status: 'REVOKED' })

      const decision = await ComplianceService.screenTransaction({
        userId,
        senderWallet: testSenderWallet,
        recipientWallet: testRecipientWallet,
        amount: '50.00',
        destinationCountry: 'US',
      })

      assert.strictEqual(decision.decision, 'REJECTED')
      assert.strictEqual(decision.allowedToBroadcast, false)
      assert.ok(decision.decisionReason.includes('REVOKED'))
    })
  })

  // 7. LIMIT EXCEEDED
  describe('Scenario 7: Limit Exceeded (Single & Rolling 24h Velocity)', () => {
    test('Rejects transaction when single transfer amount exceeds Tier 1 limit (1,000 tDUST)', async () => {
      const userId = 'user_single_limit_010'
      await setupVerifiedUser(userId)

      const decision = await ComplianceService.screenTransaction({
        userId,
        senderWallet: testSenderWallet,
        recipientWallet: testRecipientWallet,
        amount: '1500.00', // Exceeds 1,000 tDUST single limit for Tier 1
        destinationCountry: 'US',
      })

      assert.strictEqual(decision.decision, 'REJECTED')
      assert.strictEqual(decision.allowedToBroadcast, false)
      assert.ok(decision.decisionReason.includes('Limits exceeded'))
      assert.ok(decision.decisionReason.includes('single transaction limit'))
    })

    test('Rejects transaction when 24h cumulative volume exceeds Tier 1 daily limit (5,000 tDUST)', async () => {
      const userId = 'user_velocity_limit_011'
      await setupVerifiedUser(userId)

      // Simulate prior transfers totaling 4,500 tDUST within the last 24h
      await LimitsService.recordTransfer(userId, testSenderWallet, toDecimal('4500.00'))

      // Attempting to send 800 tDUST (4,500 + 800 = 5,300 > 5,000 daily limit)
      const decision = await ComplianceService.screenTransaction({
        userId,
        senderWallet: testSenderWallet,
        recipientWallet: testRecipientWallet,
        amount: '800.00',
        destinationCountry: 'US',
      })

      assert.strictEqual(decision.decision, 'REJECTED')
      assert.strictEqual(decision.allowedToBroadcast, false)
      assert.ok(decision.decisionReason.includes('Limits exceeded'))
      assert.ok(decision.decisionReason.includes('daily velocity limit'))
    })
  })

  // 8. RISK & LIMITS ENGINE ISOLATED VERIFICATIONS
  describe('Scenario 8: Risk & Limits Engine Direct Verifications', () => {
    test('RiskService assigns score based on velocity, amount, and jurisdiction factors', async () => {
      const lowRisk = await RiskService.evaluateTransactionRisk({
        userId: 'risk_user_low',
        senderWallet: testSenderWallet,
        recipientWallet: testRecipientWallet,
        amount: toDecimal('50.00'),
        destinationCountry: 'US',
      })
      assert.ok(lowRisk.riskScore < 40)
      assert.strictEqual(lowRisk.riskLevel, 'LOW')

      const criticalRisk = await RiskService.evaluateTransactionRisk({
        userId: 'risk_user_critical',
        senderWallet: testSenderWallet,
        recipientWallet: testRecipientWallet,
        amount: toDecimal('500.00'),
        destinationCountry: 'KP', // Sanctioned North Korea
      })
      assert.strictEqual(criticalRisk.riskScore, 100)
      assert.strictEqual(criticalRisk.riskLevel, 'CRITICAL')
    })

    test('LimitsService enforces Tier 0 has 0 allowance', async () => {
      const tier0Check = await LimitsService.evaluateLimits({
        userId: 'tier0_user',
        walletAddress: testSenderWallet,
        amount: toDecimal('1.00'),
        tier: 'TIER_0',
      })
      assert.strictEqual(tier0Check.allowed, false)
      assert.ok(tier0Check.reason.toLowerCase().includes('unverified'))
    })
  })
})
