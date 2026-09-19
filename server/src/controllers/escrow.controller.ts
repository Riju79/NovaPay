import { Request, Response } from 'express'
import prisma from '../config/db'
import { toDecimal, isPositiveAmount } from '../utils/money'

export const createEscrowRecord = async (req: any, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHORIZED' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || !user.wallet_address) {
      return res.status(403).json({ error: 'Authenticated user has no connected wallet.' })
    }

    const { id, payer, payee, arbiter, amount, status, txHash, deadline } = req.body
    if (!id || !payer || !payee || !amount) {
      return res.status(400).json({ error: 'Missing required escrow fields' })
    }

    if (payer.trim().toLowerCase() !== user.wallet_address.toLowerCase()) {
      return res.status(403).json({ error: 'Forbidden: You can only create escrow records as the payer with your authenticated wallet.' })
    }

    if (!isPositiveAmount(amount)) {
      return res.status(400).json({ error: 'Escrow amount must be a positive number' })
    }

    const decimalAmount = toDecimal(amount)

    const record = await prisma.escrowRecord.create({
      data: {
        id,
        payer: user.wallet_address.trim(),
        payee: payee.trim(),
        arbiter: arbiter || user.wallet_address.trim(),
        amount: decimalAmount,
        status: status || 0,
        tx_hash: txHash,
        deadline: deadline || Math.floor(Date.now() / 1000) + 86400 * 7,
      },
    })

    return res.status(201).json(record)
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to create escrow record' })
  }
}

export const getEscrowRecords = async (req: any, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required to access escrow records.', code: 'UNAUTHORIZED' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { wallets: true },
    })
    if (!user) {
      return res.json([])
    }

    const userAddresses = new Set<string>()
    if (user.wallet_address) userAddresses.add(user.wallet_address.trim().toLowerCase())
    if (user.wallets) {
      for (const w of user.wallets) {
        if (w.address) userAddresses.add(w.address.trim().toLowerCase())
        if (w.shielded_address) userAddresses.add(w.shielded_address.trim().toLowerCase())
        if (w.unshielded_address) userAddresses.add(w.unshielded_address.trim().toLowerCase())
      }
    }

    const { walletAddress } = req.query
    if (walletAddress && typeof walletAddress === 'string' && !userAddresses.has(walletAddress.trim().toLowerCase())) {
      const matchingWallet = await prisma.wallet.findFirst({
        where: {
          user_id: user.id,
          OR: [
            { address: walletAddress.trim() },
            { shielded_address: walletAddress.trim() },
            { unshielded_address: walletAddress.trim() },
          ],
        },
      })
      if (!matchingWallet) {
        return res.status(403).json({
          error: 'Forbidden: You cannot access escrow records of other wallets.',
          code: 'FORBIDDEN_WALLET_ACCESS',
        })
      }
      userAddresses.add(walletAddress.trim().toLowerCase())
    }

    const searchAddresses = walletAddress
      ? [walletAddress.trim()]
      : Array.from(userAddresses)

    const records = await prisma.escrowRecord.findMany({
      where: {
        OR: [
          { payer: { in: searchAddresses } },
          { payee: { in: searchAddresses } },
          { arbiter: { in: searchAddresses } },
        ],
      },
      orderBy: { created_at: 'desc' },
    })

    return res.json(
      records.map((r) => ({
        id: r.id,
        payer: r.payer,
        payee: r.payee,
        arbiter: r.arbiter,
        amount: r.amount.toFixed(6),
        status: r.status,
        txHash: r.tx_hash,
        deadline: r.deadline,
        createdAt: Math.floor(r.created_at.getTime() / 1000),
      }))
    )
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to fetch escrow records' })
  }
}

export const updateEscrowStatus = async (req: any, res: Response) => {
  try {
    const { id } = req.params
    const { status, txHash } = req.body

    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHORIZED' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || !user.wallet_address) {
      return res.status(403).json({ error: 'Authenticated user has no connected wallet.' })
    }

    const existing = await prisma.escrowRecord.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Escrow record not found.' })
    }

    const callerWallet = user.wallet_address.trim().toLowerCase()
    const isParticipant =
      existing.payer.toLowerCase() === callerWallet ||
      existing.payee.toLowerCase() === callerWallet ||
      existing.arbiter.toLowerCase() === callerWallet

    if (!isParticipant) {
      return res.status(403).json({
        error: 'Forbidden: You are not an authorized participant (payer, payee, or arbiter) of this escrow record.',
        code: 'FORBIDDEN_ESCROW_ACCESS',
      })
    }

    const updated = await prisma.escrowRecord.update({
      where: { id },
      data: {
        status: Number(status),
        ...(txHash ? { tx_hash: txHash } : {}),
      },
    })

    return res.json(updated)
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to update escrow status' })
  }
}

export const handleEscrowContractAction = async (req: Request, res: Response) => {
  try {
    const { action } = req.params
    const { txHash } = req.body

    if (!txHash) {
      return res.status(400).json({
        error: `Escrow action '${action}' requires a valid broadcast Midnight Preview transaction hash from 1AM wallet.`,
      })
    }

    return res.json({
      success: true,
      action,
      txHash: String(txHash).trim().replace(/^0x/i, ''),
      timestamp: Date.now(),
    })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Escrow action processing failed' })
  }
}
