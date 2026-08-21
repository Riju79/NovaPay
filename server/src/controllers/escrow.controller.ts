import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const createEscrowRecord = async (req: Request, res: Response) => {
  try {
    const { id, payer, payee, arbiter, amount, status, txHash, deadline } = req.body
    if (!id || !payer || !payee || !amount) {
      return res.status(400).json({ error: 'Missing required escrow fields' })
    }

    const record = await prisma.escrowRecord.create({
      data: {
        id,
        payer,
        payee,
        arbiter: arbiter || payer,
        amount: parseFloat(amount),
        status: status || 0,
        tx_hash: txHash,
        deadline: deadline || Math.floor(Date.now() / 1000) + 86400 * 7,
      },
    })

    return res.status(201).json(record)
  } catch (err: any) {
    console.error('createEscrowRecord error:', err)
    return res.status(500).json({ error: err?.message || 'Failed to create escrow record' })
  }
}

export const getEscrowRecords = async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.query
    const whereClause = walletAddress
      ? {
          OR: [
            { payer: String(walletAddress) },
            { payee: String(walletAddress) },
            { arbiter: String(walletAddress) },
          ],
        }
      : {}

    const records = await prisma.escrowRecord.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
    })

    return res.json(
      records.map((r) => ({
        id: r.id,
        payer: r.payer,
        payee: r.payee,
        arbiter: r.arbiter,
        amount: r.amount,
        status: r.status,
        txHash: r.tx_hash,
        deadline: r.deadline,
        createdAt: Math.floor(r.created_at.getTime() / 1000),
      }))
    )
  } catch (err: any) {
    console.error('getEscrowRecords error:', err)
    return res.status(500).json({ error: err?.message || 'Failed to fetch escrow records' })
  }
}

export const updateEscrowStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { status, txHash } = req.body

    const updated = await prisma.escrowRecord.update({
      where: { id },
      data: {
        status: Number(status),
        ...(txHash ? { tx_hash: txHash } : {}),
      },
    })

    return res.json(updated)
  } catch (err: any) {
    console.error('updateEscrowStatus error:', err)
    return res.status(500).json({ error: err?.message || 'Failed to update escrow status' })
  }
}

export const handleEscrowContractAction = async (req: Request, res: Response) => {
  try {
    const { action } = req.params
    const payload = req.body
    const txHash = `mn_tx_escrow_${action}_${Date.now()}`

    return res.json({
      success: true,
      action,
      txHash,
      timestamp: Date.now(),
    })
  } catch (err: any) {
    return res.status(500).json({ error: 'Escrow action processing failed' })
  }
}
