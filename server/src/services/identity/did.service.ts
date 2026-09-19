/**
 * Decentralized Identity (DID) Service
 * Manages W3C DIDs for NovaPay users via Identus adapter.
 */

import prisma from '../../config/db'
import { identusAdapter } from '../adapters/identus.adapter'

export class DIDService {
  private static memoryCache = new Map<string, any>()

  /**
   * Retrieves or creates a decentralized identity for a NovaPay user
   */
  public static async getOrCreateUserDID(userId: string): Promise<{
    id: string
    did: string
    method: string
    status: string
    isNew: boolean
  }> {
    if (!userId) {
      throw new Error('User ID is required to resolve DID.')
    }

    // Check existing memory cache first
    const cached = this.memoryCache.get(userId)
    if (cached) {
      return { ...cached, isNew: false }
    }

    // Check existing DID record
    let existing = null
    try {
      existing = await prisma.dIDIdentity.findFirst({
        where: { user_id: userId, status: 'ACTIVE' },
        include: { credentials: true },
      })
    } catch {
      existing = null
    }

    if (existing) {
      const res = {
        id: existing.id,
        did: existing.did,
        method: existing.method,
        status: existing.status,
      }
      this.memoryCache.set(userId, res)
      return { ...res, isNew: false }
    }

    // Generate new W3C DID via Identus adapter
    const didDoc = await identusAdapter.createDID('prism')

    let newRecord: any = null
    try {
      newRecord = await prisma.dIDIdentity.create({
        data: {
          user_id: userId,
          did: didDoc.did,
          method: didDoc.method,
          status: didDoc.status,
          verification_method: didDoc.verificationMethod,
        },
      })
    } catch {
      newRecord = {
        id: `did_id_${Date.now()}`,
        did: didDoc.did,
        method: didDoc.method,
        status: didDoc.status,
      }
    }

    this.memoryCache.set(userId, {
      id: newRecord.id,
      did: newRecord.did,
      method: newRecord.method,
      status: newRecord.status,
    })

    return {
      id: newRecord.id,
      did: newRecord.did,
      method: newRecord.method,
      status: newRecord.status,
      isNew: true,
    }
  }

  /**
   * Validates DID format conforming to W3C specification
   */
  public static validateDID(did: string): boolean {
    if (!did || typeof did !== 'string') return false
    const clean = did.trim()
    // W3C DID format regex: did:<method>:<method-specific-id>
    return /^did:[a-z0-9]+:[a-zA-Z0-9.\-_:]+$/.test(clean) && clean.length >= 12
  }

  /**
   * Resolves DID metadata
   */
  public static async resolveDID(did: string) {
    if (!this.validateDID(did)) {
      throw new Error(`Invalid W3C DID identifier: ${did}`)
    }
    return identusAdapter.resolveDID(did)
  }
}
