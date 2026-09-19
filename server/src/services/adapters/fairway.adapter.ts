/**
 * Fairway Decentralized KYC/AML Compliance Adapter
 * Provider: FAIRWAY
 * Status: BLOCKED
 *
 * Missing Requirements:
 * 1. No official npm package, SDK, or public repository published under "Fairway" for Midnight or Cardano.
 * 2. No publicly available REST/gRPC API specification or OpenAPI documentation.
 * 3. No sandbox credentials or testnet API gateways provisioned.
 * 4. No Midnight-compatible zero-knowledge compliance verification keys published.
 */

import { serverConfig } from '../../config/environment'

export interface FairwayScreeningRequest {
  walletAddress: string
  did?: string
  jurisdiction?: string
  transactionContext?: {
    amount: string
    asset: string
    recipient: string
  }
}

export interface FairwayScreeningResult {
  provider: 'FAIRWAY'
  status: 'BLOCKED' | 'APPROVED' | 'REJECTED' | 'IN_REVIEW'
  caseId?: string
  riskScore?: number
  amlPassed: boolean
  pepPassed: boolean
  sanctionsPassed: boolean
  isBlocked: boolean
  blockedReason: string
  timestamp: number
}

export interface IFairwayAdapter {
  screenWallet(params: FairwayScreeningRequest): Promise<FairwayScreeningResult>
  getCaseStatus(caseId: string): Promise<FairwayScreeningResult>
  isAvailable(): boolean
}

export class FairwayAdapter implements IFairwayAdapter {
  private apiUrl: string
  private apiKey?: string
  private clientId?: string
  private isConfigured: boolean

  constructor() {
    this.apiUrl = serverConfig.fairway.apiUrl || 'https://api.sandbox.fairway.compliance/v1'
    this.apiKey = serverConfig.fairway.apiKey
    this.clientId = serverConfig.fairway.clientId
    this.isConfigured = Boolean(this.apiKey && this.apiKey.trim().length > 0)
  }

  public isAvailable(): boolean {
    return this.isConfigured
  }

  /**
   * Screen a wallet address against Fairway KYC/AML.
   * If credentials/SDK are missing, strictly returns BLOCKED status.
   */
  public async screenWallet(params: FairwayScreeningRequest): Promise<FairwayScreeningResult> {
    if (!this.isConfigured) {
      console.warn('[FairwayAdapter] Screening requested but Fairway integration is BLOCKED: Missing API key and public SDK.')
      return {
        provider: 'FAIRWAY',
        status: 'BLOCKED',
        amlPassed: false,
        pepPassed: false,
        sanctionsPassed: false,
        isBlocked: true,
        blockedReason:
          'Fairway compliance provider is BLOCKED. No public SDK, OpenAPI endpoint, or sandbox API key is currently provisioned for Midnight Preview.',
        timestamp: Date.now(),
      }
    }

    try {
      const res = await fetch(`${this.apiUrl}/screen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'X-Client-Id': this.clientId || '',
        },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        throw new Error(`Fairway API HTTP error: ${res.status} ${res.statusText}`)
      }

      const data = (await res.json()) as any
      return {
        provider: 'FAIRWAY',
        status: data.status || 'IN_REVIEW',
        caseId: data.caseId,
        riskScore: data.riskScore,
        amlPassed: Boolean(data.amlPassed),
        pepPassed: Boolean(data.pepPassed),
        sanctionsPassed: Boolean(data.sanctionsPassed),
        isBlocked: false,
        blockedReason: '',
        timestamp: Date.now(),
      }
    } catch (err: any) {
      return {
        provider: 'FAIRWAY',
        status: 'BLOCKED',
        amlPassed: false,
        pepPassed: false,
        sanctionsPassed: false,
        isBlocked: true,
        blockedReason: `Fairway compliance provider is BLOCKED: ${err.message || err}. No public SDK, OpenAPI endpoint, or sandbox API key is currently provisioned for Midnight Preview.`,
        timestamp: Date.now(),
      }
    }
  }

  public async getCaseStatus(caseId: string): Promise<FairwayScreeningResult> {
    if (!this.isConfigured) {
      return {
        provider: 'FAIRWAY',
        status: 'BLOCKED',
        caseId,
        amlPassed: false,
        pepPassed: false,
        sanctionsPassed: false,
        isBlocked: true,
        blockedReason: 'Fairway provider is BLOCKED. Cannot poll case status without live API credentials.',
        timestamp: Date.now(),
      }
    }

    try {
      const res = await fetch(`${this.apiUrl}/cases/${encodeURIComponent(caseId)}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'X-Client-Id': this.clientId || '',
        },
      })
      const data = (await res.json()) as any
      return {
        provider: 'FAIRWAY',
        status: data.status || 'IN_REVIEW',
        caseId: data.caseId || caseId,
        riskScore: data.riskScore,
        amlPassed: Boolean(data.amlPassed),
        pepPassed: Boolean(data.pepPassed),
        sanctionsPassed: Boolean(data.sanctionsPassed),
        isBlocked: false,
        blockedReason: '',
        timestamp: Date.now(),
      }
    } catch (err: any) {
      return {
        provider: 'FAIRWAY',
        status: 'BLOCKED',
        caseId,
        amlPassed: false,
        pepPassed: false,
        sanctionsPassed: false,
        isBlocked: true,
        blockedReason: `Fairway case lookup failed: ${err.message || err}`,
        timestamp: Date.now(),
      }
    }
  }
}

export const fairwayAdapter = new FairwayAdapter()
