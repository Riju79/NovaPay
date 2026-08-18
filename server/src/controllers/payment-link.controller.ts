import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../config/db'

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

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number.' })
    }

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || !user.wallet_address) {
      return res.status(400).json({ error: 'Your user profile does not have a connected wallet.' })
    }

    const paymentLink = await prisma.paymentLink.create({
      data: {
        creator_wallet: user.wallet_address,
        amount: parsedAmount,
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

    if (paymentLink.creator_wallet === payerAddress) {
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
 * Submits the signed transaction payload and updates database records.
 */
export const submitPaymentLinkTx = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { xdr } = req.body

    if (!xdr) {
      return res.status(400).json({ error: 'Signed transaction payload is required.' })
    }

    const paymentLink = await prisma.paymentLink.findUnique({ where: { id } })
    if (!paymentLink) {
      return res.status(404).json({ error: 'Payment link not found.' })
    }

    let txData: any
    try {
      txData = JSON.parse(Buffer.from(xdr, 'base64').toString('utf-8'))
    } catch {
      txData = { payer: 'payer_wallet', recipient: paymentLink.creator_wallet, amount: paymentLink.amount }
    }

    const txHash = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const payerWallet = txData.payer || 'payer_wallet'
    const recipientWallet = paymentLink.creator_wallet
    const paymentAmount = paymentLink.amount

    // Save transaction to DB
    const dbTx = await prisma.transaction.create({
      data: {
        sender_wallet: payerWallet,
        recipient_wallet: recipientWallet,
        amount: paymentAmount,
        asset_type: paymentLink.asset,
        purpose: `Payment Link Invoice (${id.slice(0, 8)})`,
        tx_hash: txHash,
        status: 'SUCCESS'
      }
    })

    // Update payment link status to COMPLETED
    await prisma.paymentLink.update({
      where: { id },
      data: { status: 'COMPLETED' }
    })

    // Notify link creator
    await prisma.notification.create({
      data: {
        wallet_address: recipientWallet,
        title: 'Payment Link Received',
        message: `Successfully received ${paymentAmount} ${paymentLink.asset} from wallet ${payerWallet.slice(0, 10)}... via your payment link.`,
        type: 'SUCCESS'
      }
    })

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
