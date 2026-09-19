import { Response } from 'express'
import prisma from '../config/db'
import { AuthRequest } from '../middleware/auth'

export const getComplianceCases = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const cases = await prisma.complianceCase.findMany({
      where: {
        user_id: req.userId,
      },
      include: {
        compliance_proofs: true,
      },
      orderBy: { created_at: 'desc' },
    })

    return res.status(200).json(
      cases.map((c) => ({
        id: c.id,
        provider: c.provider,
        providerCaseId: c.provider_case_id,
        status: c.status,
        riskScore: c.risk_score ? c.risk_score.toFixed(2) : null,
        screeningNotes: c.screening_notes,
        amlPassed: c.aml_check_passed,
        pepPassed: c.pep_check_passed,
        sanctionsPassed: c.sanctions_check_passed,
        proofs: c.compliance_proofs.map((p) => ({
          id: p.id,
          proofEngine: p.proof_engine,
          zkProofHash: p.zk_proof_hash,
          status: p.status,
          verifiedAt: p.verified_at,
          createdAt: p.created_at,
        })),
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }))
    )
  } catch (err: any) {
    console.error('[Compliance Controller] Error fetching compliance cases:', err)
    return res.status(500).json({ error: 'Failed to retrieve compliance cases.' })
  }
}

export const getComplianceCaseById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const { id } = req.params

    const c = await prisma.complianceCase.findFirst({
      where: {
        id,
        user_id: req.userId,
      },
      include: {
        compliance_proofs: true,
      },
    })

    if (!c) {
      return res.status(404).json({ error: 'Compliance case not found or unauthorized.' })
    }

    return res.status(200).json({
      id: c.id,
      provider: c.provider,
      providerCaseId: c.provider_case_id,
      status: c.status,
      riskScore: c.risk_score ? c.risk_score.toFixed(2) : null,
      screeningNotes: c.screening_notes,
      amlPassed: c.aml_check_passed,
      pepPassed: c.pep_check_passed,
      sanctionsPassed: c.sanctions_check_passed,
      proofs: c.compliance_proofs.map((p) => ({
        id: p.id,
        proofEngine: p.proof_engine,
        zkProofHash: p.zk_proof_hash,
        status: p.status,
        verifiedAt: p.verified_at,
        createdAt: p.created_at,
      })),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    })
  } catch (err: any) {
    console.error('[Compliance Controller] Error fetching compliance case:', err)
    return res.status(500).json({ error: 'Failed to retrieve compliance case.' })
  }
}

/**
 * GET /api/compliance/status
 * Returns decentralized identity and compliance predicate status
 */
export const getComplianceStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const { ComplianceProofService } = await import('../services/identity/compliance-proof.service')
    const report = await ComplianceProofService.evaluateUserCompliance(req.userId)

    return res.status(200).json(report)
  } catch (err: any) {
    console.error('[Compliance Controller] Error fetching compliance status:', err)
    return res.status(500).json({ error: 'Failed to evaluate compliance status.' })
  }
}

/**
 * POST /api/compliance/verify-proof
 * Verifies presentation or cryptographic proof evidence.
 * REJECTS bare kycApproved assertions without proof.
 */
export const submitProofVerification = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const { presentationJwt, zkProofHash, verificationKeyId, publicInputs, kycApproved } = req.body

    // Anti-bypass check: if frontend sends bare kycApproved flag without proof, reject immediately
    if (kycApproved !== undefined && !presentationJwt && !zkProofHash) {
      return res.status(400).json({
        error: 'Bare frontend approvals (kycApproved=true) are prohibited. Cryptographic evidence or verifiable presentation required.',
        code: 'EVIDENCE_REQUIRED',
      })
    }

    const { ComplianceProofService } = await import('../services/identity/compliance-proof.service')
    const result = await ComplianceProofService.verifyEvidenceSubmission({
      userId: req.userId,
      presentationJwt,
      zkProofHash,
      verificationKeyId,
      publicInputs,
      rawAssertion: kycApproved,
    })

    if (!result.verified) {
      return res.status(400).json({
        error: result.reason || 'Proof verification failed.',
        code: 'VERIFICATION_FAILED',
      })
    }

    return res.status(200).json({
      success: true,
      verified: true,
      proofRecordId: result.proofRecordId,
      predicates: result.evaluatedPredicates,
      verifiedAt: Date.now(),
    })
  } catch (err: any) {
    console.error('[Compliance Controller] Error submitting proof:', err)
    return res.status(500).json({ error: 'Failed to process compliance proof.' })
  }
}

/**
 * POST /api/compliance/issue-credential
 * Issues a privacy-preserving KYC Verifiable Credential via Identus
 */
export const issueKYCCredential = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const { amlCleared, jurisdictionAllowed, ageOver18, sanctionsCleared, countryCode } = req.body

    const { VCService } = await import('../services/identity/vc.service')
    const issuedVC = await VCService.issueKYCCredential(req.userId, {
      amlCleared: Boolean(amlCleared),
      jurisdictionAllowed: Boolean(jurisdictionAllowed),
      ageOver18: Boolean(ageOver18),
      sanctionsCleared: Boolean(sanctionsCleared),
      countryCode: countryCode || 'US',
    })

    return res.status(201).json({
      success: true,
      credentialId: issuedVC.id,
      credentialType: issuedVC.credentialType,
      subjectDid: issuedVC.subjectDid,
      issuanceDate: issuedVC.issuanceDate,
      expirationDate: issuedVC.expirationDate,
      rawJwtVc: issuedVC.rawJwtVc,
    })
  } catch (err: any) {
    console.error('[Compliance Controller] Error issuing credential:', err)
    return res.status(500).json({ error: err?.message || 'Failed to issue verifiable credential.' })
  }
}

/**
 * POST /api/compliance/screen
 * Screens a transaction through the compliance pipeline (KYC, sanctions, jurisdiction, limits, risk)
 */
export const screenTransaction = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const { senderWallet, recipientWallet, amount, asset, destinationCountry, sourceOfFundsDeclared, complianceProofToken } = req.body

    if (!senderWallet || !recipientWallet || !amount) {
      return res.status(400).json({ error: 'Missing required parameters: senderWallet, recipientWallet, amount' })
    }

    const { ComplianceService } = await import('../services/compliance/compliance.service')
    const result = await ComplianceService.screenTransaction({
      userId: req.userId,
      senderWallet,
      recipientWallet,
      amount,
      asset: asset || 'tDUST',
      destinationCountry: destinationCountry || 'US',
      sourceOfFundsDeclared: Boolean(sourceOfFundsDeclared),
      complianceProofToken,
    })

    return res.status(200).json({
      decision: result.decision,
      allowedToBroadcast: result.allowedToBroadcast,
      caseId: result.caseId,
      reason: result.decisionReason,
      risk: result.risk,
      limits: result.limits,
      identity: result.identity,
      checks: result.checks,
      screenedAt: result.screenedAt,
    })
  } catch (err: any) {
    console.error('[Compliance Controller] Error screening transaction:', err)
    return res.status(500).json({ error: err?.message || 'Failed to screen transaction.' })
  }
}

