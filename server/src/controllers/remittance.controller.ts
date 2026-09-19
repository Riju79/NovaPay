import { Response } from 'express'
import prisma from '../config/db'
import { AuthRequest } from '../middleware/auth'
import { RemittanceService } from '../services/remittance/remittance.service'
import { RemittanceTransitionService, RemittanceState } from '../services/remittance/remittance-transition.service'

export const getRemittances = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const remittances = await prisma.remittance.findMany({
      where: {
        OR: [
          { sender_id: req.userId },
          { recipient_id: req.userId },
        ],
        deleted_at: null,
      },
      include: {
        beneficiary: true,
        quote: true,
        blockchain_transfers: true,
      },
      orderBy: { created_at: 'desc' },
    })

    return res.status(200).json(
      remittances.map((r) => ({
        id: r.id,
        idempotencyKey: r.idempotency_key,
        senderId: r.sender_id,
        recipientId: r.recipient_id,
        senderCurrency: r.sender_currency,
        senderAmount: r.sender_amount.toFixed(6),
        recipientCurrency: r.recipient_currency,
        recipientAmount: r.recipient_amount.toFixed(6),
        exchangeRate: r.exchange_rate.toFixed(6),
        feeTotal: r.fee_total.toFixed(6),
        status: r.status,
        purpose: r.purpose,
        settlementRail: r.settlement_rail,
        beneficiary: r.beneficiary
          ? {
              id: r.beneficiary.id,
              fullName: r.beneficiary.full_name,
              walletAddress: r.beneficiary.wallet_address,
              payoutMethod: r.beneficiary.payout_method,
            }
          : null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }))
    )
  } catch (err: any) {
    console.error('[Remittance Controller] Error fetching remittances:', err)
    return res.status(500).json({ error: 'Failed to retrieve remittance records.' })
  }
}

export const getRemittanceById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const { id } = req.params
    const remittance = await RemittanceService.getRemittance(req.userId, id)

    return res.status(200).json({
      id: remittance.id,
      idempotencyKey: remittance.idempotency_key,
      senderId: remittance.sender_id,
      quoteId: remittance.quote_id,
      senderCurrency: remittance.sender_currency,
      senderAmount: remittance.sender_amount.toFixed(6),
      recipientCurrency: remittance.recipient_currency,
      recipientAmount: remittance.recipient_amount.toFixed(6),
      exchangeRate: remittance.exchange_rate.toFixed(6),
      feeTotal: remittance.fee_total.toFixed(6),
      status: remittance.status,
      purpose: remittance.purpose,
      settlementRail: remittance.settlement_rail,
      complianceCaseId: remittance.compliance_case_id,
      fundingReference: remittance.funding_reference,
      blockchainTxHash: remittance.blockchain_tx_hash,
      blockHeight: remittance.block_height,
      providerReference: remittance.provider_reference,
      createdAt: remittance.created_at,
      updatedAt: remittance.updated_at,
    })
  } catch (err: any) {
    const status = err.message.includes('Access denied') ? 403 : err.message.includes('not found') ? 404 : 500
    return res.status(status).json({ error: err.message })
  }
}

export const createRemittance = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const {
      beneficiaryId,
      senderCurrency,
      senderAmount,
      recipientCurrency,
      quoteId,
      purpose,
      idempotencyKey,
    } = req.body

    const remittance = await RemittanceService.createRemittance(req.userId, {
      beneficiaryId,
      senderCurrency,
      senderAmount,
      recipientCurrency,
      quoteId,
      purpose,
      idempotencyKey,
    })

    return res.status(201).json({
      id: remittance.id,
      idempotencyKey: remittance.idempotency_key,
      quoteId: remittance.quote_id,
      senderCurrency: remittance.sender_currency,
      senderAmount: remittance.sender_amount.toFixed(6),
      recipientCurrency: remittance.recipient_currency,
      recipientAmount: remittance.recipient_amount.toFixed(6),
      exchangeRate: remittance.exchange_rate.toFixed(6),
      feeTotal: remittance.fee_total.toFixed(6),
      status: remittance.status,
      createdAt: remittance.created_at,
    })
  } catch (err: any) {
    console.error('[Remittance Controller] Error creating remittance:', err)
    const status = err.message.includes('expired') ? 410 : 400
    return res.status(status).json({ error: err.message || 'Failed to create remittance transfer.' })
  }
}

export const transitionRemittance = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const { id } = req.params
    const { targetState, reason, idempotencyKey, evidenceReference } = req.body

    if (!targetState) {
      return res.status(400).json({ error: 'targetState is required.' })
    }

    const remittance = await RemittanceService.getRemittance(req.userId, id)

    const result = await RemittanceTransitionService.transition(
      remittance,
      targetState as RemittanceState,
      {
        operatorId: req.userId,
        reason,
        idempotencyKey,
        evidenceReference,
      }
    )

    return res.status(200).json(result)
  } catch (err: any) {
    const status = err.message.includes('Unauthorized') ? 403 : err.message.includes('Illegal state transition') ? 422 : 400
    return res.status(status).json({ error: err.message })
  }
}

export const cancelRemittance = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const { id } = req.params
    const { reason } = req.body

    const remittance = await RemittanceService.cancelRemittance(req.userId, id, reason)

    return res.status(200).json({
      id: remittance.id,
      status: remittance.status,
      message: 'Remittance transfer cancelled successfully.',
    })
  } catch (err: any) {
    const status = err.message.includes('Access denied') ? 403 : 400
    return res.status(status).json({ error: err.message })
  }
}
