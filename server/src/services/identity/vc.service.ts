/**
 * Verifiable Credential (VC) Service
 * Manages W3C Verifiable Credentials for KYC and compliance claims.
 * Enforces zero exposure of raw PII / identity documents.
 */

import crypto from 'crypto'
import prisma from '../../config/db'
import { identusAdapter, IssuedVerifiableCredential } from '../adapters/identus.adapter'
import { DIDService } from './did.service'

export interface KYCClaimsInput {
  amlCleared: boolean
  jurisdictionAllowed: boolean
  ageOver18: boolean
  sanctionsCleared: boolean
  countryCode?: string
}

export class VCService {
  public static memoryCache: Map<string, any[]> = new Map()

  /**
   * Issues a privacy-preserving KYC Verifiable Credential for a user
   */
  public static async issueKYCCredential(
    userId: string,
    claims: KYCClaimsInput,
    validityDays: number = 365
  ): Promise<IssuedVerifiableCredential> {
    const userDID = await DIDService.getOrCreateUserDID(userId)

    // Construct privacy-preserving predicates
    // Notice: Raw name, passport number, and street addresses are NOT stored!
    const sanitizedClaims = {
      kycVerified: true,
      amlCleared: Boolean(claims.amlCleared),
      jurisdictionAllowed: Boolean(claims.jurisdictionAllowed),
      ageOver18: Boolean(claims.ageOver18),
      sanctionsCleared: Boolean(claims.sanctionsCleared),
      countryCodeHash: claims.countryCode
        ? crypto.createHash('sha256').update(claims.countryCode.toUpperCase().trim()).digest('hex')
        : undefined,
      issuedAt: Math.floor(Date.now() / 1000),
    }

    const issuedVC = await identusAdapter.issueCredential({
      subjectDid: userDID.did,
      credentialType: 'NovapayKYCCredential',
      claims: sanitizedClaims,
      validityDays,
    })

    // Store in memory cache for offline/test environments
    const memEntry = {
      id: `vc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      credentialType: issuedVC.credentialType,
      issuerDid: issuedVC.issuerDid,
      subjectDid: issuedVC.subjectDid,
      issuanceDate: new Date(issuedVC.issuanceDate),
      expirationDate: new Date(issuedVC.expirationDate),
      status: 'ISSUED',
      predicates: {
        kycVerified: Boolean(sanitizedClaims.kycVerified),
        amlCleared: Boolean(sanitizedClaims.amlCleared),
        jurisdictionAllowed: Boolean(sanitizedClaims.jurisdictionAllowed),
        ageOver18: Boolean(sanitizedClaims.ageOver18),
        sanctionsCleared: Boolean(sanitizedClaims.sanctionsCleared),
      },
    }
    const currentList = this.memoryCache.get(userId) || []
    currentList.unshift(memEntry)
    this.memoryCache.set(userId, currentList)

    // Store credential metadata in PostgreSQL
    try {
      await prisma.verifiableCredential.create({
        data: {
          identity_id: userDID.id,
          credential_type: issuedVC.credentialType,
          issuer_did: issuedVC.issuerDid,
          subject_did: issuedVC.subjectDid,
          issuance_date: new Date(issuedVC.issuanceDate),
          expiration_date: new Date(issuedVC.expirationDate),
          status: 'ISSUED',
          raw_jwt_vc: issuedVC.rawJwtVc,
          claims_json: JSON.stringify(sanitizedClaims),
        },
      })
    } catch (err) {
      console.warn('[VCService] Database record creation skipped or mocked in test:', err)
    }

    return issuedVC
  }

  /**
   * Fetches all active credentials for a user without exposing raw PII
   */
  public static async getUserCredentials(userId: string) {
    let credentials: any[] = []
    try {
      const didRecord = await prisma.dIDIdentity.findFirst({
        where: { user_id: userId, status: 'ACTIVE' },
        include: {
          credentials: {
            where: { status: 'ISSUED' },
            orderBy: { issuance_date: 'desc' },
          },
        },
      })

      if (didRecord && didRecord.credentials && didRecord.credentials.length > 0) {
        credentials = didRecord.credentials
      }
    } catch {
      credentials = []
    }

    if (credentials.length === 0 && this.memoryCache.has(userId)) {
      return this.memoryCache.get(userId) || []
    }

    return credentials.map((vc) => {
      let parsedClaims: any = {}
      try {
        parsedClaims = JSON.parse(vc.claims_json)
      } catch {
        parsedClaims = {}
      }

      return {
        id: vc.id,
        credentialType: vc.credential_type,
        issuerDid: vc.issuer_did,
        subjectDid: vc.subject_did,
        issuanceDate: vc.issuance_date,
        expirationDate: vc.expiration_date,
        status: vc.status,
        predicates: {
          kycVerified: Boolean(parsedClaims.kycVerified),
          amlCleared: Boolean(parsedClaims.amlCleared),
          jurisdictionAllowed: Boolean(parsedClaims.jurisdictionAllowed),
          ageOver18: Boolean(parsedClaims.ageOver18),
          sanctionsCleared: Boolean(parsedClaims.sanctionsCleared),
        },
      }
    })
  }

  /**
   * Verifies credential validity and checks whether it has expired or been revoked
   */
  public static verifyCredentialValidity(expirationDate: Date | string, status: string): boolean {
    if (status !== 'ISSUED') return false
    const expTime = new Date(expirationDate).getTime()
    return expTime > Date.now()
  }
}
