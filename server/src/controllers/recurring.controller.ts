import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const createSubscriptionRecord = async (req: Request, res: Response) => {
  try {
    const { id, payer, recipient, amount, frequencySeconds, nextPaymentTime, endTime, maxPayments, paymentCount, status, txHash } = req.body
    if (!id || !payer || !recipient || !amount) {
      return res.status(400).json({ error: 'Missing required subscription fields' })
    }

    const record = await prisma.subscriptionRecord.create({
      data: {
        id,
        payer,
        recipient,
        amount: parseFloat(amount),
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
    console.error('createSubscriptionRecord error:', err)
    return res.status(500).json({ error: err?.message || 'Failed to create subscription record' })
  }
}

export const getSubscriptionRecords = async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.query
    const whereClause = walletAddress
      ? {
          OR: [
            { payer: String(walletAddress) },
            { recipient: String(walletAddress) },
          ],
        }
      : {}

    const records = await prisma.subscriptionRecord.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
    })

    return res.json(
      records.map((r) => ({
        id: r.id,
        payer: r.payer,
        recipient: r.recipient,
        amount: r.amount,
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
    console.error('getSubscriptionRecords error:', err)
    return res.status(500).json({ error: err?.message || 'Failed to fetch subscription records' })
  }
}

export const executeSubscriptionPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { txHash, currentTime } = req.body

    const existing = await prisma.subscriptionRecord.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Subscription not found' })

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
    console.error('executeSubscriptionPayment error:', err)
    return res.status(500).json({ error: err?.message || 'Failed to execute subscription payment' })
  }
}

export const updateSubscriptionStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { status, txHash } = req.body

    const updated = await prisma.subscriptionRecord.update({
      where: { id },
      data: {
        status: Number(status),
        ...(txHash ? { tx_hash: txHash } : {}),
      },
    })

    return res.json(updated)
  } catch (err: any) {
    console.error('updateSubscriptionStatus error:', err)
    return res.status(500).json({ error: err?.message || 'Failed to update subscription status' })
  }
}

export const handleRecurringContractAction = async (req: Request, res: Response) => {
  try {
    const { action } = req.params
    const txHash = `mn_tx_recurring_${action}_${Date.now()}`

    return res.json({
      success: true,
      action,
      txHash,
      timestamp: Date.now(),
    })
  } catch (err: any) {
    return res.status(500).json({ error: 'Recurring action processing failed' })
  }
}
