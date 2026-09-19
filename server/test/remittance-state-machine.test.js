/**
 * NovaPay Phase 9 Test Suite: Authoritative Remittance State Machine
 *
 * Requirements Tested:
 * 1. Complete forward progression through all 12 authoritative states:
 *    CREATED -> QUOTE_LOCKED -> COMPLIANCE_PENDING -> COMPLIANCE_APPROVED ->
 *    FUNDING_PENDING -> FUNDED -> BLOCKCHAIN_PENDING -> BLOCKCHAIN_SUBMITTED ->
 *    BLOCKCHAIN_CONFIRMED -> PAYOUT_PENDING -> PAYOUT_PROCESSING -> COMPLETED.
 * 2. Strict rejection of invalid transitions / state bypasses (e.g. CREATED -> COMPLETED).
 * 3. Idempotent transitions.
 * 4. Transition authorization (unauthorized operator rejection).
 * 5. Immutable audit event emission for every transition.
 * 6. Connected entity tracking (quote, compliance, funding, blockchain, payout).
 * 7. Exception pathways: MANUAL_REVIEW, CANCELLED, EXPIRED, REFUND_PENDING -> REFUNDED.
 */

const { test, describe, beforeEach } = require('node:test')
const assert = require('node:assert')

// Configure test environment
process.env.NODE_ENV = 'development'
process.env.JWT_SECRET = 'novapay_test_jwt_secret_token_32chars_minimum!'
process.env.MIDNIGHT_NETWORK = 'preview'

const { RemittanceService } = require('../build/services/remittance/remittance.service')
const { RemittanceTransitionService, VALID_TRANSITIONS } = require('../build/services/remittance/remittance-transition.service')
const { QuoteService } = require('../build/services/fx/quote.service')
const { DIDService } = require('../build/services/identity/did.service')
const { VCService } = require('../build/services/identity/vc.service')

describe('NovaPay Phase 9: Authoritative Remittance State Machine', () => {

  const userA = 'user_alice_remitter_101'
  const userB = 'user_bob_intruder_102'

  beforeEach(async () => {
    RemittanceService.clearCache()
    QuoteService.clearCache()
    DIDService.memoryCache.clear()
    VCService.memoryCache.clear()

    // Ensure verified credentials exist for userA so compliance checks pass
    await DIDService.getOrCreateUserDID(userA)
    await VCService.issueKYCCredential(userA, {
      amlCleared: true,
      jurisdictionAllowed: true,
      ageOver18: true,
      sanctionsCleared: true,
      countryCode: 'US',
    })
  })

  // 1. FORWARD PIPELINE (ALL 12 STATES)
  describe('1. Full Forward State Machine Progression', () => {
    test('Seamlessly progresses through all 12 authoritative states to COMPLETED', async () => {
      // 1. CREATED
      const rem = await RemittanceService.createRemittance(userA, {
        senderCurrency: 'tDUST',
        senderAmount: '500.00',
        recipientCurrency: 'USD',
        purpose: 'Family support',
      })
      assert.strictEqual(rem.status, 'CREATED')
      assert.ok(rem.quote_id)

      // 2. QUOTE_LOCKED
      await RemittanceService.lockQuoteForRemittance(userA, rem.id)
      assert.strictEqual(rem.status, 'QUOTE_LOCKED')

      // 3 & 4. COMPLIANCE_PENDING -> COMPLIANCE_APPROVED
      await RemittanceService.evaluateCompliance(userA, rem.id)
      assert.strictEqual(rem.status, 'COMPLIANCE_APPROVED')
      assert.ok(rem.compliance_case_id)

      // 5. FUNDING_PENDING
      await RemittanceService.requestFunding(userA, rem.id)
      assert.strictEqual(rem.status, 'FUNDING_PENDING')

      // 6. FUNDED
      const fundingRef = 'wire_dep_mock_994821'
      await RemittanceService.confirmFunding(userA, rem.id, fundingRef)
      assert.strictEqual(rem.status, 'FUNDED')
      assert.strictEqual(rem.funding_reference, fundingRef)

      // 7. BLOCKCHAIN_PENDING
      await RemittanceService.prepareBlockchainSettlement(userA, rem.id)
      assert.strictEqual(rem.status, 'BLOCKCHAIN_PENDING')

      // 8. BLOCKCHAIN_SUBMITTED
      const txHash = '0x' + 'b'.repeat(64)
      await RemittanceService.submitBlockchainSettlement(userA, rem.id, txHash)
      assert.strictEqual(rem.status, 'BLOCKCHAIN_SUBMITTED')
      assert.strictEqual(rem.blockchain_tx_hash, txHash)

      // 9. BLOCKCHAIN_CONFIRMED
      const blockHeight = 142058
      await RemittanceService.confirmBlockchainSettlement(userA, rem.id, blockHeight)
      assert.strictEqual(rem.status, 'BLOCKCHAIN_CONFIRMED')
      assert.strictEqual(rem.block_height, blockHeight)

      // 10. PAYOUT_PENDING
      await RemittanceService.queuePayout(userA, rem.id)
      assert.strictEqual(rem.status, 'PAYOUT_PENDING')

      // 11. PAYOUT_PROCESSING
      const providerRef = 'mg_payout_ref_774910'
      await RemittanceService.processPayout(userA, rem.id, providerRef)
      assert.strictEqual(rem.status, 'PAYOUT_PROCESSING')
      assert.strictEqual(rem.provider_reference, providerRef)

      // 12. COMPLETED
      await RemittanceService.completeRemittance(userA, rem.id)
      assert.strictEqual(rem.status, 'COMPLETED')

      // Verification: Connected entities verified through remittance ID
      assert.ok(rem.quote_id)
      assert.ok(rem.compliance_case_id)
      assert.ok(rem.funding_reference)
      assert.ok(rem.blockchain_tx_hash)
      assert.ok(rem.provider_reference)
    })
  })

  // 2. INVALID STATE TRANSITION REJECTION
  describe('2. Invalid State Transition Rejections', () => {
    test('Strictly rejects illegal jump CREATED -> COMPLETED', async () => {
      const rem = await RemittanceService.createRemittance(userA, {
        senderCurrency: 'tDUST',
        senderAmount: '100.00',
        recipientCurrency: 'USD',
      })
      assert.strictEqual(rem.status, 'CREATED')

      await assert.rejects(
        async () => {
          await RemittanceTransitionService.transition(rem, 'COMPLETED', {
            operatorId: userA,
            reason: 'Bypass attempt',
          })
        },
        /Illegal state transition: Cannot transition remittance directly from 'CREATED' to 'COMPLETED'/i
      )

      assert.strictEqual(rem.status, 'CREATED', 'State must not have changed')
    })

    test('Strictly rejects illegal jump CREATED -> BLOCKCHAIN_SUBMITTED', async () => {
      const rem = await RemittanceService.createRemittance(userA, {
        senderCurrency: 'tDUST',
        senderAmount: '100.00',
        recipientCurrency: 'USD',
      })

      await assert.rejects(
        async () => {
          await RemittanceTransitionService.transition(rem, 'BLOCKCHAIN_SUBMITTED', {
            operatorId: userA,
          })
        },
        /Illegal state transition/i
      )
    })

    test('Strictly rejects illegal jump QUOTE_LOCKED -> COMPLETED', async () => {
      const rem = await RemittanceService.createRemittance(userA, {
        senderCurrency: 'tDUST',
        senderAmount: '100.00',
        recipientCurrency: 'USD',
      })
      await RemittanceService.lockQuoteForRemittance(userA, rem.id)
      assert.strictEqual(rem.status, 'QUOTE_LOCKED')

      await assert.rejects(
        async () => {
          await RemittanceTransitionService.transition(rem, 'COMPLETED', {
            operatorId: userA,
          })
        },
        /Illegal state transition/i
      )
    })

    test('Strictly rejects illegal backward or further transition from terminal state COMPLETED', async () => {
      const rem = await RemittanceService.createRemittance(userA, {
        senderCurrency: 'tDUST',
        senderAmount: '100.00',
        recipientCurrency: 'USD',
      })

      // Manually set status to COMPLETED to test terminal state invariants
      rem.status = 'COMPLETED'

      await assert.rejects(
        async () => {
          await RemittanceTransitionService.transition(rem, 'CREATED', {
            operatorId: userA,
          })
        },
        /TERMINAL STATE/i
      )

      await assert.rejects(
        async () => {
          await RemittanceTransitionService.transition(rem, 'FAILED', {
            operatorId: userA,
          })
        },
        /TERMINAL STATE/i
      )
    })
  })

  // 3. IDEMPOTENT TRANSITIONS
  describe('3. Idempotent Transition Handling', () => {
    test('Transitioning to the current state is idempotent and returns gracefully', async () => {
      const rem = await RemittanceService.createRemittance(userA, {
        senderCurrency: 'tDUST',
        senderAmount: '100.00',
        recipientCurrency: 'USD',
      })
      await RemittanceService.lockQuoteForRemittance(userA, rem.id)
      assert.strictEqual(rem.status, 'QUOTE_LOCKED')

      // Transition to QUOTE_LOCKED again
      const result = await RemittanceTransitionService.transition(rem, 'QUOTE_LOCKED', {
        operatorId: userA,
        reason: 'Duplicate retry',
      })

      assert.strictEqual(result.isIdempotent, true)
      assert.strictEqual(result.fromState, 'QUOTE_LOCKED')
      assert.strictEqual(result.toState, 'QUOTE_LOCKED')
      assert.strictEqual(rem.status, 'QUOTE_LOCKED')
    })
  })

  // 4. AUTHORIZATION ENFORCEMENT
  describe('4. Transition Authorization', () => {
    test('Rejects transition attempts by unauthorized third parties', async () => {
      const rem = await RemittanceService.createRemittance(userA, {
        senderCurrency: 'tDUST',
        senderAmount: '100.00',
        recipientCurrency: 'USD',
      })

      // User B attempts to transition User A's remittance
      await assert.rejects(
        async () => {
          await RemittanceTransitionService.transition(rem, 'QUOTE_LOCKED', {
            operatorId: userB,
          })
        },
        /Unauthorized transition/i
      )
    })
  })

  // 5. AUDIT EVENT TRAIL
  describe('5. Audit Event Emission', () => {
    test('Every state transition generates an immutable audit event', async () => {
      const rem = await RemittanceService.createRemittance(userA, {
        senderCurrency: 'tDUST',
        senderAmount: '200.00',
        recipientCurrency: 'USD',
      })

      const initialAuditCount = RemittanceTransitionService.auditEvents.length
      assert.ok(initialAuditCount >= 1, 'Creation must generate an audit event')

      await RemittanceService.lockQuoteForRemittance(userA, rem.id)
      assert.strictEqual(RemittanceTransitionService.auditEvents.length, initialAuditCount + 1)

      const latestAudit = RemittanceTransitionService.auditEvents[RemittanceTransitionService.auditEvents.length - 1]
      assert.strictEqual(latestAudit.action, 'REMITTANCE_STATE_TRANSITION')
      assert.strictEqual(latestAudit.resource_id, rem.id)
      assert.strictEqual(latestAudit.resource_type, 'REMITTANCE')

      const parsedMeta = JSON.parse(latestAudit.metadata)
      assert.strictEqual(parsedMeta.fromState, 'CREATED')
      assert.strictEqual(parsedMeta.toState, 'QUOTE_LOCKED')
      assert.strictEqual(parsedMeta.operatorId, userA)
    })
  })

  // 6. EXCEPTION & FAILURE PATHWAYS
  describe('6. Failure, Review, Refund, and Cancellation Pathways', () => {
    test('Manual review escalation and clearance: COMPLIANCE_PENDING -> MANUAL_REVIEW -> COMPLIANCE_APPROVED', async () => {
      const rem = await RemittanceService.createRemittance(userA, {
        senderCurrency: 'tDUST',
        senderAmount: '1000.00', // Large transfer triggering manual review
        recipientCurrency: 'USD',
      })
      await RemittanceService.lockQuoteForRemittance(userA, rem.id)

      // Move to COMPLIANCE_PENDING
      await RemittanceTransitionService.transition(rem, 'COMPLIANCE_PENDING', { operatorId: userA })

      // Escalate to MANUAL_REVIEW
      await RemittanceTransitionService.transition(rem, 'MANUAL_REVIEW', {
        operatorId: 'SYSTEM',
        reason: 'Enhanced source of funds screening required',
      })
      assert.strictEqual(rem.status, 'MANUAL_REVIEW')

      // Compliance officer reviews and clears case
      await RemittanceTransitionService.transition(rem, 'COMPLIANCE_APPROVED', {
        operatorId: 'COMPLIANCE_OFFICER',
        reason: 'Source of funds documentation verified by compliance team',
      })
      assert.strictEqual(rem.status, 'COMPLIANCE_APPROVED')
    })

    test('Post-funding failure refund pathway: FUNDED -> REFUND_PENDING -> REFUNDED', async () => {
      const rem = await RemittanceService.createRemittance(userA, {
        senderCurrency: 'tDUST',
        senderAmount: '300.00',
        recipientCurrency: 'USD',
      })
      await RemittanceService.lockQuoteForRemittance(userA, rem.id)
      await RemittanceService.evaluateCompliance(userA, rem.id)
      await RemittanceService.requestFunding(userA, rem.id)
      await RemittanceService.confirmFunding(userA, rem.id, 'dep_wire_123')
      assert.strictEqual(rem.status, 'FUNDED')

      // Off-ramp rail goes offline after funding -> trigger refund
      await RemittanceService.failRemittance('SYSTEM', rem.id, 'Downstream banking rail outage', true)
      assert.strictEqual(rem.status, 'REFUND_PENDING')

      // Process refund back to sender
      await RemittanceService.processRefund('SYSTEM', rem.id, 'refund_tx_hash_008899')
      assert.strictEqual(rem.status, 'REFUNDED')
    })

    test('Cancellation pathway: CREATED -> CANCELLED', async () => {
      const rem = await RemittanceService.createRemittance(userA, {
        senderCurrency: 'tDUST',
        senderAmount: '50.00',
        recipientCurrency: 'USD',
      })
      assert.strictEqual(rem.status, 'CREATED')

      await RemittanceService.cancelRemittance(userA, rem.id, 'Changed mind before locking quote')
      assert.strictEqual(rem.status, 'CANCELLED')
    })

    test('Expiry pathway: QUOTE_LOCKED -> EXPIRED', async () => {
      const rem = await RemittanceService.createRemittance(userA, {
        senderCurrency: 'tDUST',
        senderAmount: '75.00',
        recipientCurrency: 'USD',
      })
      await RemittanceService.lockQuoteForRemittance(userA, rem.id)
      assert.strictEqual(rem.status, 'QUOTE_LOCKED')

      await RemittanceTransitionService.transition(rem, 'EXPIRED', {
        operatorId: 'SYSTEM',
        reason: 'Quote lock TTL elapsed without deposit confirmation',
      })
      assert.strictEqual(rem.status, 'EXPIRED')
    })
  })
})
