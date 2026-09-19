import { Request, Response } from 'express'
import prisma from '../config/db'
import { toDecimal, isPositiveAmount } from '../utils/money'

export const createSubscriptionRecord = async (req: any, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHORIZED' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || !user.wallet_address) {
      return res.status(403).json({ error: 'Authenticated user has no connected wallet.' })
    }

    const { id, payer, recipient, amount, frequencySeconds, nextPaymentTime, endTime, maxPayments, paymentCount, status, txHash } = req.body
    if (!id || !payer || !recipient || !amount) {
      return res.status(400).json({ error: 'Missing required subscription fields' })
    }

    if (payer.trim().toLowerCase() !== user.wallet_address.toLowerCase()) {
      return res.status(403).json({ error: 'Forbidden: You can only create subscription records where payer matches your authenticated wallet.' })
    }

    if (!isPositiveAmount(amount)) {
      return res.status(400).json({ error: 'Subscription amount must be a positive number' })
    }

    const decimalAmount = toDecimal(amount)

    const record = await prisma.subscriptionRecord.create({
      data: {
        id,
        payer: user.wallet_address.trim(),
        recipient: recipient.trim(),
        amount: decimalAmount,
        frequency_seconds: Number(frequencySeconds || 86400),
        next_payment_time: Number(nextPaymentTime || Math.floor(Date.now() / 1000) + 86400),
        end_time: Number(endTime || Math.floor(Date.now() / 1000) + 86400 * 30),
        max_payments: Number(maxPayments || 0),
        payment_count: Number(paymentCount || 0),
        status: Number(status || 1),
        tx_hash: txHash,
      },
    })

    return res.status(201).json(record)
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to create subscription record' })
  }
}

export const getSubscriptionRecords = async (req: any, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required to access subscription records.', code: 'UNAUTHORIZED' })
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
          error: 'Forbidden: You cannot access subscriptions of other wallets.',
          code: 'FORBIDDEN_WALLET_ACCESS',
        })
      }
      userAddresses.add(walletAddress.trim().toLowerCase())
    }

    const searchAddresses = walletAddress
      ? [walletAddress.trim()]
      : Array.from(userAddresses)

    const records = await prisma.subscriptionRecord.findMany({
      where: {
        OR: [
          { payer: { in: searchAddresses } },
          { recipient: { in: searchAddresses } },
        ],
      },
      orderBy: { created_at: 'desc' },
    })

    return res.json(
      records.map((r) => ({
        id: r.id,
        payer: r.payer,
        recipient: r.recipient,
        amount: r.amount.toFixed(6),
        frequencySeconds: r.frequency_seconds,
        nextPaymentTime: r.next_payment_time,
        endTime: r.end_time,
        maxPayments: r.max_payments,
        paymentCount: r.payment_count,
        status: r.status,
        txHash: r.tx_hash,
        createdAt: Math.floor(r.created_at.getTime() / 1000),
      }))
    )
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to fetch subscription records' })
  }
}

export const executeSubscriptionPayment = async (req: any, res: Response) => {
  try {
    const { id } = req.params
    const { txHash, currentTime } = req.body

    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHORIZED' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || !user.wallet_address) {
      return res.status(403).json({ error: 'Authenticated user has no connected wallet.' })
    }

    const existing = await prisma.subscriptionRecord.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Subscription not found' })

    const callerWallet = user.wallet_address.trim().toLowerCase()
    const isParticipant =
      existing.payer.toLowerCase() === callerWallet ||
      existing.recipient.toLowerCase() === callerWallet

    if (!isParticipant) {
      return res.status(403).json({
        error: 'Forbidden: You are not authorized to execute payments on this subscription.',
        code: 'FORBIDDEN_SUBSCRIPTION_ACCESS',
      })
    }

    if (existing.status !== 1) {
      return res.status(400).json({ error: 'Cannot execute payment on inactive or completed subscription.' })
    }

    const newCount = existing.payment_count + 1
    const nextTime = existing.next_payment_time + existing.frequency_seconds
    const isCompleted =
      (existing.max_payments > 0 && newCount >= existing.max_payments) ||
      nextTime > existing.end_time

    const updated = await prisma.subscriptionRecord.update({
      where: { id },
      data: {
        payment_count: newCount,
        next_payment_time: nextTime,
        status: isCompleted ? 4 : 1, // 4=COMPLETED, 1=ACTIVE
        ...(txHash ? { tx_hash: txHash } : {}),
      },
    })

    return res.json(updated)
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to execute subscription payment' })
  }
}

export const updateSubscriptionStatus = async (req: any, res: Response) => {
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

    const existing = await prisma.subscriptionRecord.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Subscription not found' })

    const callerWallet = user.wallet_address.trim().toLowerCase()
    const isParticipant =
      existing.payer.toLowerCase() === callerWallet ||
      existing.recipient.toLowerCase() === callerWallet

    if (!isParticipant) {
      return res.status(403).json({
        error: 'Forbidden: You are not authorized to modify this subscription.',
        code: 'FORBIDDEN_SUBSCRIPTION_ACCESS',
      })
    }

    const updated = await prisma.subscriptionRecord.update({
      where: { id },
      data: {
        status: Number(status),
        ...(txHash ? { tx_hash: txHash } : {}),
      },
    })

    return res.json(updated)
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to update subscription status' })
  }
}

export const handleRecurringContractAction = async (req: Request, res: Response) => {
  try {
    const { action } = req.params
    const { txHash } = req.body

    if (!txHash) {
      return res.status(400).json({
        error: `Recurring action '${action}' requires a valid broadcast Midnight Preview transaction hash from 1AM wallet.`,
      })
    }

    return res.json({
      success: true,
      action,
      txHash: String(txHash).trim().replace(/^0x/i, ''),
      timestamp: Date.now(),
    })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Recurring action processing failed' })
  }
}
