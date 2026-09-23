import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../config/db'
import { toDecimal, isPositiveAmount } from '../utils/money'

const isValidWalletAddress = (address: string): boolean => {
  if (!address || typeof address !== 'string') return false
  return address.length >= 10
}

/**
 * Endpoint: POST /api/payment-links
 * Generates and stores a unique payment link.
 */
export const createPaymentLink = async (req: AuthRequest, res: Response) => {
  try {
    const { amount, asset } = req.body

    if (!amount || !asset) {
      return res.status(400).json({ error: 'Amount and asset are required.' })
    }

    if (!isPositiveAmount(amount)) {
      return res.status(400).json({ error: 'Amount must be a positive number.' })
    }

    const decimalAmount = toDecimal(amount)

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || !user.wallet_address) {
      return res.status(400).json({ error: 'Your user profile does not have a connected wallet.' })
    }

    const paymentLink = await prisma.paymentLink.create({
      data: {
        creator_id: user.id,
        creator_wallet: user.wallet_address,
        amount: decimalAmount,
        asset: asset.toUpperCase(),
        status: 'ACTIVE'
      }
    })

    return res.status(201).json(paymentLink)
  } catch (err: any) {
    console.error('Create payment link error:', err)
    return res.status(500).json({ error: 'Server error generating payment link.' })
  }
}

/**
 * Endpoint: GET /api/payment-links/:id
 * Resolves details of a payment link by its unique ID.
 */
export const getPaymentLinkById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const paymentLink = await prisma.paymentLink.findUnique({ where: { id } })
    if (!paymentLink) {
      return res.status(404).json({ error: 'Payment link not found.' })
    }

    return res.json(paymentLink)
  } catch (err: any) {
    console.error('Get payment link error:', err)
    return res.status(500).json({ error: 'Server error fetching payment link details.' })
  }
}

/**
 * Endpoint: POST /api/payment-links/:id/prepare
 * Prepares an unsigned transaction payload for a public payment link.
 */
export const preparePaymentLinkTx = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { payerAddress } = req.body

    if (!payerAddress) {
      return res.status(400).json({ error: 'Payer wallet address is required.' })
    }

    if (!isValidWalletAddress(payerAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address format.' })
    }

    const paymentLink = await prisma.paymentLink.findUnique({ where: { id } })
    if (!paymentLink || paymentLink.status !== 'ACTIVE') {
      return res.status(404).json({ error: 'Active payment link not found.' })
    }

    if (paymentLink.creator_wallet.toLowerCase() === payerAddress.toLowerCase()) {
      return res.status(400).json({ error: 'You cannot pay your own payment link.' })
    }

    const mockPayload = Buffer.from(
      JSON.stringify({
        linkId: id,
        payer: payerAddress,
        recipient: paymentLink.creator_wallet,
        amount: paymentLink.amount,
        asset: paymentLink.asset
      })
    ).toString('base64')

    return res.json({
      xdr: mockPayload,
      amount: paymentLink.amount,
      asset: paymentLink.asset,
      recipient: paymentLink.creator_wallet
    })
  } catch (err: any) {
    console.error('Prepare payment link tx error:', err)
    return res.status(500).json({ error: 'Server error preparing transaction.' })
  }
}

/**
 * Endpoint: POST /api/payment-links/:id/submit
 * Submits the confirmed transaction payload and updates database records.
 */
export const submitPaymentLinkTx = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { xdr, txHash: clientTxHash, payerWallet: bodyPayerWallet, payerAddress, senderAddress } = req.body

    const txHash = clientTxHash || req.body.txHash || (xdr ? `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` : null)

    if (!xdr && !txHash) {
      return res.status(400).json({ error: 'Transaction hash or signed payload is required.' })
    }

    const paymentLink = await prisma.paymentLink.findUnique({ where: { id } })
    if (!paymentLink) {
      return res.status(404).json({ error: 'Payment link not found.' })
    }

    if (paymentLink.status !== 'ACTIVE') {
      return res.status(409).json({
        error: `This payment link is '${paymentLink.status}' and cannot be paid again.`,
        code: 'LINK_ALREADY_SETTLED',
      })
    }

    let txData: any = {}
    if (xdr) {
      try {
        txData = JSON.parse(Buffer.from(xdr, 'base64').toString('utf-8'))
      } catch {
        txData = {}
      }
    }

    const payerWallet = (
      bodyPayerWallet ||
      payerAddress ||
      senderAddress ||
      txData.payer ||
      req.walletAddress ||
      ''
    ).trim() || 'payer_wallet'

    const recipientWallet = paymentLink.creator_wallet.trim()
    const paymentAmount = paymentLink.amount

    if (payerWallet !== 'payer_wallet' && payerWallet.toLowerCase() === recipientWallet.toLowerCase()) {
      return res.status(400).json({ error: 'You cannot pay your own payment link.' })
    }

    // Replay check
    const existingTx = await prisma.transaction.findUnique({ where: { tx_hash: txHash } })
    if (existingTx) {
      return res.status(409).json({ error: 'Transaction hash already used.', code: 'DUPLICATE_TX_HASH' })
    }

    // Atomic race-condition lock
    const updateResult = await prisma.paymentLink.updateMany({
      where: { id, status: 'ACTIVE' },
      data: { status: 'COMPLETED' },
    })

    if (updateResult.count === 0) {
      return res.status(409).json({
        error: 'Concurrent settlement detected: Payment link was already settled.',
        code: 'RACE_CONDITION_BLOCKED',
      })
    }

    // Find payer user if registered
    let senderUser = null
    if (req.userId) {
      senderUser = await prisma.user.findUnique({ where: { id: req.userId } })
    }
    if (!senderUser && payerWallet !== 'payer_wallet') {
      const payerCandidates = [payerWallet, payerWallet.toLowerCase()]
      senderUser = await prisma.user.findFirst({
        where: {
          OR: [
            { wallet_address: { in: payerCandidates } },
            { wallets: { some: { address: { in: payerCandidates } } } },
            { wallets: { some: { shielded_address: { in: payerCandidates } } } },
            { wallets: { some: { unshielded_address: { in: payerCandidates } } } },
          ],
        },
      })
    }

    // Find recipient user
    let recipientUser = null
    if (paymentLink.creator_id) {
      recipientUser = await prisma.user.findUnique({ where: { id: paymentLink.creator_id } })
    }
    if (!recipientUser && recipientWallet) {
      const recipientCandidates = [recipientWallet, recipientWallet.toLowerCase()]
      recipientUser = await prisma.user.findFirst({
        where: {
          OR: [
            { wallet_address: { in: recipientCandidates } },
            { wallets: { some: { address: { in: recipientCandidates } } } },
            { wallets: { some: { shielded_address: { in: recipientCandidates } } } },
            { wallets: { some: { unshielded_address: { in: recipientCandidates } } } },
          ],
        },
      })
    }

    // Save transaction to DB
    const dbTx = await prisma.transaction.create({
      data: {
        sender_id: senderUser?.id || null,
        recipient_id: recipientUser?.id || null,
        sender_wallet: payerWallet,
        recipient_wallet: recipientWallet,
        amount: paymentAmount,
        asset_type: paymentLink.asset,
        purpose: `Payment Link Invoice (${id.slice(0, 8)})`,
        tx_hash: txHash,
        status: 'SUCCESS',
      },
    })

    // Notify link creator
    await prisma.notification.create({
      data: {
        user_id: recipientUser?.id || null,
        wallet_address: recipientWallet,
        title: 'Payment Link Received',
        message: `Successfully received ${paymentAmount} ${paymentLink.asset} from wallet ${payerWallet.slice(0, 10)}... via your payment link.`,
        type: 'SUCCESS'
      }
    })

    // Notify payer if known
    if (payerWallet !== 'payer_wallet') {
      await prisma.notification.create({
        data: {
          user_id: senderUser?.id || null,
          wallet_address: payerWallet,
          title: 'Payment Link Settled',
          message: `Successfully paid ${paymentAmount} ${paymentLink.asset} to wallet ${recipientWallet.slice(0, 10)}... for invoice #${id.slice(0, 8)}.`,
          type: 'SUCCESS'
        }
      }).catch((e) => console.warn('Payer notification skipped:', e))
    }

    return res.json({
      success: true,
      txHash,
      ledger: 100,
      transaction: dbTx
    })
  } catch (err: any) {
    console.error('Submit payment link tx error:', err)
    return res.status(400).json({
      error: 'Transaction submission rejected.'
    })
  }
}

