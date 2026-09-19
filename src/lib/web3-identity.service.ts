/**
 * Web3-Native Privacy-Preserving Identity & Compliance Service
 * Connects client application to decentralized identity pipeline:
 * DID -> Verifiable Credential -> ZK Compliance Predicates -> Proof Verification
 */

import { API_URL } from '../config'
import { getAuthHeaders } from './auth'

export interface ClientComplianceReport {
  userId: string
  did: string
  overallCompliant: boolean
  predicates: {
    KYC_VERIFIED: boolean
    JURISDICTION_ALLOWED: boolean
    AGE_REQUIREMENT_SATISFIED: boolean
    SANCTIONS_CLEARED: boolean
  }
  activeCredentialsCount: number
  verifiedProofsCount: number
  providers: {
    fairway: { status: string; isBlocked: boolean; note: string }
    identus: { status: string; isAvailable: boolean; note: string }
    triplePlay: { status: string; isBlocked: boolean; note: string }
  }
}

export class Web3IdentityService {
  /**
   * Fetches decentralized identity compliance status for the authenticated user
   */
  public static async getComplianceStatus(): Promise<ClientComplianceReport | null> {
    try {
      const res = await fetch(`${API_URL}/api/compliance/status`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }

  /**
   * Requests issuance of a privacy-preserving KYC Verifiable Credential via Identus
   */
  public static async requestKYCCredential(claims: {
    amlCleared?: boolean
    jurisdictionAllowed?: boolean
    ageOver18?: boolean
    sanctionsCleared?: boolean
    countryCode?: string
  }): Promise<{ success: boolean; credentialId?: string; rawJwtVc?: string; error?: string }> {
    try {
      const res = await fetch(`${API_URL}/api/compliance/issue-credential`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          amlCleared: claims.amlCleared ?? true,
          jurisdictionAllowed: claims.jurisdictionAllowed ?? true,
          ageOver18: claims.ageOver18 ?? true,
          sanctionsCleared: claims.sanctionsCleared ?? true,
          countryCode: claims.countryCode || 'US',
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to issue credential' }
      }

      return {
        success: true,
        credentialId: data.credentialId,
        rawJwtVc: data.rawJwtVc,
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error requesting credential' }
    }
  }

  /**
   * Submits cryptographic evidence or verifiable presentation to backend for verification.
   * Note: The backend strictly rejects bare `kycApproved=true` assertions.
   */
  public static async submitProofEvidence(params: {
    presentationJwt?: string
    zkProofHash?: string
    verificationKeyId?: string
    publicInputs?: Record<string, any>
  }): Promise<{ verified: boolean; proofRecordId?: string; error?: string }> {
    try {
      const res = await fetch(`${API_URL}/api/compliance/verify-proof`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(params),
      })

      const data = await res.json()
      if (!res.ok || !data.verified) {
        return { verified: false, error: data.error || 'Proof verification rejected by server' }
      }

      return { verified: true, proofRecordId: data.proofRecordId }
    } catch (err: any) {
      return { verified: false, error: err?.message || 'Failed to submit proof' }
    }
  }
}
