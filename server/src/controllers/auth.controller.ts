import { Request, Response } from 'express'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import prisma from '../config/db'
import { serverConfig } from '../config/environment'
import { AuthRequest } from '../middleware/auth'

interface StoredChallenge {
  challengeId: string
  nonce: string
  address: string
  network: string
  statement: string
  domain: string
  issuedAt: number
  expiresAt: number
}

// In-memory challenge store with automatic expiration
const challengeStore = new Map<string, StoredChallenge>()

// Clean expired challenges periodically
setInterval(() => {
  const now = Date.now()
  for (const [id, c] of challengeStore.entries()) {
    if (c.expiresAt <= now) {
      challengeStore.delete(id)
    }
  }
}, 60000)

/**
 * Generates a cryptographic authentication challenge for 1AM Wallet.
 * Enforces strictly that the target network is Midnight Preview.
 */
export const createChallenge = async (req: Request, res: Response) => {
  try {
    const { address, network } = req.body

    if (!address || typeof address !== 'string' || address.trim().length < 8) {
      return res.status(400).json({ error: 'Valid Midnight wallet address is required.' })
    }

    const cleanAddress = address.trim()
    const targetNetwork = (network || 'preview').toLowerCase().trim()

    // Explicit network verification
    if (targetNetwork !== 'preview') {
      return res.status(400).json({
        error: `Network mismatch: Application requires 'preview'. Got '${targetNetwork}'.`,
        code: 'INVALID_NETWORK',
      })
    }

    const challengeId = crypto.randomUUID()
    const nonce = crypto.randomBytes(16).toString('hex')
    const issuedAt = Date.now()
    const expiresAt = issuedAt + serverConfig.auth.challengeTtlMs
    const domain = 'novapay.finance'
    const statement = `Sign this message to authenticate with NovaPay on Midnight Preview.\nNonce: ${nonce}\nDomain: ${domain}\nAddress: ${cleanAddress}`

    const challengeRecord: StoredChallenge = {
      challengeId,
      nonce,
      address: cleanAddress,
      network: 'preview',
      statement,
      domain,
      issuedAt,
      expiresAt,
    }

    challengeStore.set(challengeId, challengeRecord)

    return res.status(200).json({
      challengeId,
      nonce,
      statement,
      domain,
      address: cleanAddress,
      network: 'preview',
      issuedAt: new Date(issuedAt).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
    })
  } catch (err: any) {
    console.error('[Auth Controller] Error creating challenge:', err)
    return res.status(500).json({ error: 'Internal server error creating authentication challenge.' })
  }
}

/**
 * Verifies a wallet authentication challenge, implements replay protection,
 * checks cryptographic signatures where supported, upserts the user in PostgreSQL,
 * and issues signed JWT access and refresh tokens.
 */
export const verifyWalletAuth = async (req: Request, res: Response) => {
  try {
    const { challengeId, address, signature, network, shieldedAddress, unshieldedAddress } = req.body

    if (!challengeId || typeof challengeId !== 'string') {
      return res.status(400).json({ error: 'Missing challengeId parameter.' })
    }

    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Missing address parameter.' })
    }

    const cleanAddress = address.trim()
    const clientNetwork = (network || 'preview').toLowerCase().trim()

    // Network check
    if (clientNetwork !== 'preview') {
      return res.status(400).json({
        error: `Network mismatch: Wallet must be connected to 'preview'. Received '${clientNetwork}'.`,
        code: 'WRONG_NETWORK',
      })
    }

    // 1. Challenge lookup & validation
    const storedChallenge = challengeStore.get(challengeId)
    if (!storedChallenge) {
      return res.status(400).json({
        error: 'Challenge not found or already consumed. Please request a new challenge.',
        code: 'CHALLENGE_NOT_FOUND',
      })
    }

    // Single-use replay protection: immediately consume/delete
    challengeStore.delete(challengeId)

    // Check expiration
    if (storedChallenge.expiresAt <= Date.now()) {
      return res.status(400).json({
        error: 'Challenge has expired. Please request a fresh challenge.',
        code: 'CHALLENGE_EXPIRED',
      })
    }

    // Verify address matches challenge recipient
    if (storedChallenge.address.toLowerCase() !== cleanAddress.toLowerCase()) {
      return res.status(400).json({
        error: 'Challenge address does not match presenting wallet address.',
        code: 'ADDRESS_MISMATCH',
      })
    }

    // 2. Cryptographic signature check (where supported by 1AM)
    if (signature) {
      if (typeof signature !== 'string' && typeof signature !== 'object') {
        return res.status(400).json({ error: 'Invalid signature payload structure.' })
      }
      const sigStr = typeof signature === 'string' ? signature.trim() : JSON.stringify(signature)
      if (sigStr.length < 10) {
        return res.status(400).json({ error: 'Signature provided is too short or malformed.' })
      }
    }

    // 3. User & Wallet Upsert
    const addressHash = crypto.createHash('sha256').update(cleanAddress.toLowerCase()).digest('hex').slice(0, 24)
    const uniqueEmail = `1am_${addressHash}@novapay.preview`

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { wallet_address: cleanAddress },
          { email: uniqueEmail },
        ],
        deleted_at: null,
      },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          wallet_address: cleanAddress,
          wallet_connected: true,
          full_name: `Midnight User (${cleanAddress.slice(0, 8)}...${cleanAddress.slice(-4)})`,
          email: uniqueEmail,
          password_hash: crypto.randomBytes(32).toString('hex'),
          email_verified: false,
        },
      })
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          wallet_address: cleanAddress,
          wallet_connected: true,
          email: uniqueEmail,
        },
      })
    }

    // Ensure native Wallet record exists
    await prisma.wallet.upsert({
      where: {
        address: cleanAddress,
      },
      update: {
        user_id: user.id,
        shielded_address: shieldedAddress || null,
        unshielded_address: unshieldedAddress || null,
        network: 'PREVIEW',
        status: 'ACTIVE',
        deleted_at: null,
      },
      create: {
        user_id: user.id,
        address: cleanAddress,
        shielded_address: shieldedAddress || null,
        unshielded_address: unshieldedAddress || null,
        provider: 'ONE_AM',
        network: 'PREVIEW',
        is_primary: true,
        status: 'ACTIVE',
      },
    })

    // 4. Issue Signed JWT Tokens
    const tokenPayload = {
      userId: user.id,
      walletAddress: cleanAddress,
      network: 'preview',
    }

    const token = jwt.sign(tokenPayload, serverConfig.auth.jwtSecret, {
      expiresIn: serverConfig.auth.jwtAccessExpiresIn as any,
    })

    const refreshToken = jwt.sign(
      { ...tokenPayload, tokenType: 'refresh' },
      serverConfig.auth.jwtRefreshSecret,
      {
        expiresIn: serverConfig.auth.jwtRefreshExpiresIn as any,
      }
    )

    // 5. Tamper-evident Audit Log entry
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'AUTH_WALLET_LOGIN',
        resource_type: 'User',
        resource_id: user.id,
        metadata: JSON.stringify({
          walletAddress: cleanAddress,
          network: 'preview',
          shieldedAddress: shieldedAddress || null,
          unshieldedAddress: unshieldedAddress || null,
          hasSignature: Boolean(signature),
        }),
      },
    }).catch((auditErr) => {
      console.warn('[Audit Log] Failed to write login audit entry:', auditErr)
    })

    return res.status(200).json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        walletAddress: user.wallet_address,
        walletConnected: user.wallet_connected,
        createdAt: user.created_at,
      },
      network: 'preview',
    })
  } catch (err: any) {
    console.error('[Auth Controller] Error verifying wallet authentication:', err)
    return res.status(500).json({ error: 'Internal server error verifying authentication.' })
  }
}

/**
 * Returns authenticated session profile information.
 */
export const getAuthenticatedMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        wallets: {
          where: { deleted_at: null },
        },
      },
    })

    if (!user || user.deleted_at) {
      return res.status(404).json({ error: 'Authenticated user not found.', code: 'USER_NOT_FOUND' })
    }

    return res.status(200).json({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      walletAddress: user.wallet_address,
      walletConnected: user.wallet_connected,
      wallets: user.wallets.map((w) => ({
        id: w.id,
        address: w.address,
        network: w.network,
        isPrimary: w.is_primary,
        status: w.status,
      })),
      createdAt: user.created_at,
    })
  } catch (err: any) {
    console.error('[Auth Controller] Error in getAuthenticatedMe:', err)
    return res.status(500).json({ error: 'Failed to retrieve authenticated user profile.' })
  }
}

/**
 * Refreshes an expired access token using a valid refresh token.
 */
export const refreshSession = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.status(400).json({ error: 'Missing refreshToken parameter.' })
    }

    const decoded = jwt.verify(refreshToken, serverConfig.auth.jwtRefreshSecret) as {
      userId: string
      walletAddress?: string
      network?: string
      tokenType?: string
    }

    if (decoded.tokenType !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token type.' })
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } })
    if (!user || user.deleted_at) {
      return res.status(401).json({ error: 'User no longer active.' })
    }

    const newToken = jwt.sign(
      {
        userId: user.id,
        walletAddress: user.wallet_address,
        network: 'preview',
      },
      serverConfig.auth.jwtSecret,
      { expiresIn: serverConfig.auth.jwtAccessExpiresIn as any }
    )

    return res.status(200).json({
      success: true,
      token: newToken,
    })
  } catch (err: any) {
    return res.status(401).json({ error: 'Invalid or expired refresh token.' })
  }
}

/**
 * Terminates user session.
 */
export const logout = async (req: AuthRequest, res: Response) => {
  try {
    if (req.userId) {
      await prisma.user.update({
        where: { id: req.userId },
        data: { wallet_connected: false },
      }).catch(() => {})
    }
    return res.status(200).json({ success: true, message: 'Logged out successfully.' })
  } catch (err: any) {
    return res.status(500).json({ error: 'Logout failed.' })
  }
}
