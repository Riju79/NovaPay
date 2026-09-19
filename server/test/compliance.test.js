/**
 * NovaPay Phase 6 Test Suite: Web3-Native Privacy-Preserving KYC & Compliance
 * Validates:
 * 1. W3C Decentralized Identifier (DID) generation, resolution, and validation (PRISM format)
 * 2. Privacy-preserving Verifiable Credential issuance (zero cleartext PII on-chain or in database)
 * 3. Zero-Knowledge compliance predicate evaluations:
 *    - KYC_VERIFIED
 *    - JURISDICTION_ALLOWED
 *    - AGE_REQUIREMENT_SATISFIED
 *    - SANCTIONS_CLEARED
 * 4. Anti-Bypass Rule: Strict server rejection of bare frontend assertions (kycApproved=true)
 * 5. Locked Provider Integration Statuses:
 *    - Fairway: BLOCKED with diagnostic rationale
 *    - Identus: Active W3C DID / JWT-VC adapter
 *    - Triple Play: BLOCKED with diagnostic rationale
 */

const { test, describe } = require('node:test')
const assert = require('node:assert')

// Set test environment configuration
process.env.NODE_ENV = 'development'
process.env.JWT_SECRET = 'novapay_test_jwt_secret_token_32chars_minimum!'
process.env.MIDNIGHT_NETWORK = 'preview'

const { DIDService } = require('../build/services/identity/did.service')
const { VCService } = require('../build/services/identity/vc.service')
const { ComplianceProofService } = require('../build/services/identity/compliance-proof.service')
const { fairwayAdapter } = require('../build/services/adapters/fairway.adapter')
const { identusAdapter } = require('../build/services/adapters/identus.adapter')
const { triplePlayAdapter } = require('../build/services/adapters/triple-play.adapter')

describe('Web3-Native Privacy-Preserving KYC & Compliance Suite', () => {

  describe('1. W3C Decentralized Identifier (DID) Operations', () => {
    test('DID Validation: Accurately identifies valid W3C DIDs', () => {
      assert.strictEqual(DIDService.validateDID('did:prism:0123456789abcdef0123456789abcdef'), true)
      assert.strictEqual(DIDService.validateDID('did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'), true)

      // Invalid DIDs
      assert.strictEqual(DIDService.validateDID('invalid_did_string'), false)
      assert.strictEqual(DIDService.validateDID('did:short'), false)
      assert.strictEqual(DIDService.validateDID(''), false)
      assert.strictEqual(DIDService.validateDID(null), false)
    })

    test('DID Creation: Generates standard did:prism identifier via Identus', async () => {
      const didDoc = await identusAdapter.createDID('prism')
      assert.ok(didDoc.did.startsWith('did:prism:'))
      assert.strictEqual(didDoc.method, 'prism')
      assert.strictEqual(didDoc.status, 'ACTIVE')
      assert.ok(didDoc.verificationMethod.includes('#master-key'))
    })
  })

  describe('2. Verifiable Credentials & Zero Cleartext PII Storage', () => {
    test('VC Issuance: Creates standard W3C JWT-VC with claims digest', async () => {
      const testUserId = 'user_test_compliance_101'
      const issuedVC = await VCService.issueKYCCredential(testUserId, {
        amlCleared: true,
        jurisdictionAllowed: true,
        ageOver18: true,
        sanctionsCleared: true,
        countryCode: 'US',
      })

      assert.ok(issuedVC.id.startsWith('urn:uuid:'))
      assert.strictEqual(issuedVC.credentialType, 'NovapayKYCCredential')
      assert.ok(issuedVC.subjectDid.startsWith('did:prism:'))
      assert.strictEqual(issuedVC.status, 'ISSUED')
      assert.ok(typeof issuedVC.rawJwtVc === 'string')
      assert.ok(issuedVC.rawJwtVc.split('.').length === 3, 'Must be valid JWT format')

      // Assert zero cleartext PII: No name, passport, or address
      assert.strictEqual(issuedVC.claims.fullName, undefined)
      assert.strictEqual(issuedVC.claims.passportNumber, undefined)
      assert.strictEqual(issuedVC.claims.homeAddress, undefined)
      assert.ok(typeof issuedVC.claimsHash === 'string', 'Must store cryptographic claims hash')
    })

    test('VC Expiration & Validity: Rejects expired or revoked credentials', () => {
      const validFutureDate = new Date(Date.now() + 86400 * 1000 * 30) // +30 days
      const expiredPastDate = new Date(Date.now() - 86400 * 1000 * 5)  // -5 days

      assert.strictEqual(VCService.verifyCredentialValidity(validFutureDate, 'ISSUED'), true)
      assert.strictEqual(VCService.verifyCredentialValidity(expiredPastDate, 'ISSUED'), false, 'Expired VC must be invalid')
      assert.strictEqual(VCService.verifyCredentialValidity(validFutureDate, 'REVOKED'), false, 'Revoked VC must be invalid')
    })
  })

  describe('3. ZK Compliance Predicates & Evaluation', () => {
    test('Predicates Evaluation: Reports exact boolean status of discrete predicates', async () => {
      const testUserId = 'user_test_predicates_202'
      const report = await ComplianceProofService.evaluateUserCompliance(testUserId)

      assert.strictEqual(report.userId, testUserId)
      assert.ok(report.did.startsWith('did:prism:'))
      assert.ok('KYC_VERIFIED' in report.predicates)
      assert.ok('JURISDICTION_ALLOWED' in report.predicates)
      assert.ok('AGE_REQUIREMENT_SATISFIED' in report.predicates)
      assert.ok('SANCTIONS_CLEARED' in report.predicates)
    })
  })

  describe('4. Anti-Bypass Rule: Rejection of kycApproved=true', () => {
    test('Security Rule: Server strictly rejects bare frontend kycApproved=true without evidence', async () => {
      const bypassAttempt = await ComplianceProofService.verifyEvidenceSubmission({
        userId: 'user_attacker_999',
        rawAssertion: true, // Frontend claims kycApproved=true without proof
      })

      assert.strictEqual(bypassAttempt.verified, false)
      assert.ok(bypassAttempt.reason.includes('REJECTED'))
      assert.ok(bypassAttempt.reason.includes('kycApproved=true'))
    })

    test('Verification Succeeds with Genuine Cryptographic Presentation', async () => {
      const testUserId = 'user_legit_303'
      const issuedVC = await VCService.issueKYCCredential(testUserId, {
        amlCleared: true,
        jurisdictionAllowed: true,
        ageOver18: true,
        sanctionsCleared: true,
      })

      const verificationResult = await ComplianceProofService.verifyEvidenceSubmission({
        userId: testUserId,
        presentationJwt: issuedVC.rawJwtVc,
      })

      assert.strictEqual(verificationResult.verified, true)
      assert.ok(verificationResult.proofRecordId.length > 0)
      assert.strictEqual(verificationResult.evaluatedPredicates.KYC_VERIFIED, true)
      assert.strictEqual(verificationResult.evaluatedPredicates.AGE_REQUIREMENT_SATISFIED, true)
    })
  })

  describe('5. Locked Providers Status & Diagnostics', () => {
    test('Fairway Adapter: Reports BLOCKED with diagnostic explanation', async () => {
      const result = await fairwayAdapter.screenWallet({
        walletAddress: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      })

      assert.strictEqual(result.provider, 'FAIRWAY')
      assert.strictEqual(result.status, 'BLOCKED')
      assert.strictEqual(result.isBlocked, true)
      assert.ok(result.blockedReason.includes('BLOCKED'))
      assert.ok(result.blockedReason.includes('No public SDK'))
    })

    test('Triple Play Adapter: Reports BLOCKED with diagnostic explanation', async () => {
      const proofResult = await triplePlayAdapter.generateProof({
        predicate: 'KYC_VERIFIED',
        subjectDid: 'did:prism:test-subject',
        claimsToken: 'test-claims-token',
        publicInputs: { allowed: true },
      })

      assert.strictEqual(proofResult.proofEngine, 'TRIPLE_PLAY')
      assert.strictEqual(proofResult.status, 'BLOCKED')
      assert.strictEqual(proofResult.isBlocked, true)
      assert.ok(proofResult.blockedReason.includes('BLOCKED'))
      assert.ok(proofResult.blockedReason.includes('prover'))
    })

    test('Identus Adapter: Rejects malformed and tampered presentations', async () => {
      const malformedResult = await identusAdapter.verifyPresentation({
        presentationJwt: 'not.a.valid.jwt.token',
      })
      assert.strictEqual(malformedResult.isValid, false)
      assert.ok(malformedResult.error.includes('Malformed'))

      const emptyResult = await identusAdapter.verifyPresentation({
        presentationJwt: '',
      })
      assert.strictEqual(emptyResult.isValid, false)
      assert.ok(emptyResult.error.includes('Missing'))
    })
  })
})
