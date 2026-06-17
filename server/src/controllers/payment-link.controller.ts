import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../config/db'
import {
  StrKey,
  Horizon,
  TransactionBuilder,
  Account,
  Asset,
  Operation,
  Networks,
  Transaction
} from '@stellar/stellar-sdk'

const horizonServer = new Horizon.Server('https://horizon-testnet.stellar.org')
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

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
 * Prepares an unsigned transaction for a public payment link.
 */
export const preparePaymentLinkTx = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { payerAddress } = req.body

    if (!payerAddress) {
      return res.status(400).json({ error: 'Payer wallet address is required.' })
    }

    if (!StrKey.isValidEd25519PublicKey(payerAddress)) {
      return res.status(400).json({ error: 'Invalid Stellar public address format.' })
    }

    const paymentLink = await prisma.paymentLink.findUnique({ where: { id } })
    if (!paymentLink || paymentLink.status !== 'ACTIVE') {
      return res.status(404).json({ error: 'Active payment link not found.' })
    }

    if (paymentLink.creator_wallet === payerAddress) {
      return res.status(400).json({ error: 'You cannot pay your own payment link.' })
    }

    // Load payer account sequence from Horizon
    let payerAccount: any
    try {
      payerAccount = await horizonServer.loadAccount(payerAddress)
    } catch (err: any) {
      const is404 = err.status === 404 || (err.response && err.response.status === 404)
      if (is404) {
        return res.status(400).json({
          error: 'Your Stellar account is unfunded on Testnet. Fund your account with Friendbot first.'
        })
      }
      throw err
    }

    // Set Asset type
    let stellarAsset: Asset
    if (paymentLink.asset === 'USDC') {
      stellarAsset = new Asset('USDC', USDC_ISSUER)
    } else {
      stellarAsset = Asset.native()
    }

    // Build the transaction source account object
    const sourceAccount = new Account(payerAddress, payerAccount.sequence)

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: '100', // 100 stroops
      networkPassphrase: Networks.TESTNET
    })
      .addOperation(
        Operation.payment({
          destination: paymentLink.creator_wallet,
          asset: stellarAsset,
          amount: paymentLink.amount.toFixed(7)
        })
      )
      .setTimeout(300)
      .build()

    const xdr = transaction.toEnvelope().toXDR('base64')

    return res.json({
      xdr,
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
 * Submits the signed transaction to Horizon and updates the database records.
 */
export const submitPaymentLinkTx = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { xdr } = req.body

    if (!xdr) {
      return res.status(400).json({ error: 'Signed transaction XDR is required.' })
    }

    const paymentLink = await prisma.paymentLink.findUnique({ where: { id } })
    if (!paymentLink) {
      return res.status(404).json({ error: 'Payment link not found.' })
    }

    let tx: Transaction
    try {
      tx = new Transaction(xdr, Networks.TESTNET)
    } catch (err) {
      return res.status(400).json({ error: 'Invalid transaction XDR format.' })
    }

    const txHash = tx.hash().toString('hex')
    const payerWallet = tx.source
    const paymentOp = tx.operations[0]

    if (!paymentOp || paymentOp.type !== 'payment') {
      return res.status(400).json({ error: 'Transaction does not contain a valid payment operation.' })
    }

    const recipientWallet = paymentOp.destination
    const paymentAmount = parseFloat(paymentOp.amount)

    if (recipientWallet !== paymentLink.creator_wallet) {
      return res.status(400).json({ error: 'Transaction recipient does not match the invoice creator.' })
    }

    // Submit transaction to Horizon
    console.log(`Submitting payment link transaction ${txHash} to Horizon...`)
    const result = await horizonServer.submitTransaction(tx)
    console.log('Horizon submission success:', result.hash)

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

    // Notify the link creator
    await prisma.notification.create({
      data: {
        wallet_address: recipientWallet,
        title: 'Payment Link Received',
        message: `Successfully received ${paymentAmount} ${paymentLink.asset} from wallet ${payerWallet.slice(0, 10)}... via your payment link.`,
        type: 'SUCCESS'
      }
    })

    // If the payer has an account, notify them too
    const payerUser = await prisma.user.findUnique({ where: { wallet_address: payerWallet } })
    if (payerUser) {
      await prisma.notification.create({
        data: {
          wallet_address: payerWallet,
          title: 'Payment Link Sent',
          message: `Successfully paid ${paymentAmount} ${paymentLink.asset} to wallet ${recipientWallet.slice(0, 10)}... via invoice link.`,
          type: 'SUCCESS'
        }
      })
    }

    return res.json({
      success: true,
      txHash,
      ledger: result.ledger,
      transaction: dbTx
    })
  } catch (err: any) {
    console.error('Submit payment link tx error:', err)
    const errorMessage = err.response?.data?.extras?.result_codes?.transaction || err.message || 'Transaction submission failed'
    return res.status(400).json({
      error: 'Stellar network rejected this transaction.',
      code: errorMessage
    })
  }
}
