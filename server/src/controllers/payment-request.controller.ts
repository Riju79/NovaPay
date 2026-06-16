import { Response } from 'express'
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

// Initialize Stellar Horizon Server for Testnet
const horizonServer = new Horizon.Server('https://horizon-testnet.stellar.org')

// Circle's official USDC Testnet asset definition
const USDC_ASSET = new Asset(
  'USDC',
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
)

/**
 * Helper to get the correct Stellar Asset object
 */
const getStellarAsset = (assetSymbol: string) => {
  return assetSymbol === 'USDC' ? USDC_ASSET : Asset.native()
}

/**
 * Endpoint: POST /api/payment-requests
 * Creates a new pending payment request.
 */
export const createPaymentRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { recipientWallet, amount, asset, purpose, message } = req.body

    // 1. Basic validation
    if (!recipientWallet || !amount || !purpose) {
      return res.status(400).json({ error: 'Recipient address, amount, and purpose are required.' })
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number.' })
    }

    const assetSymbol = (asset || 'USDC').toUpperCase()
    if (assetSymbol !== 'USDC' && assetSymbol !== 'XLM') {
      return res.status(400).json({ error: 'Supported assets are XLM and USDC.' })
    }

    // 2. Validate wallet formats
    if (!StrKey.isValidEd25519PublicKey(recipientWallet)) {
      return res.status(400).json({ error: 'Invalid recipient Stellar wallet address format.' })
    }

    // Retrieve requester details
    const requester = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!requester || !requester.wallet_address) {
      return res.status(400).json({ error: 'Your user profile does not have a linked Stellar wallet.' })
    }

    // 3. User cannot request money from themselves
    if (requester.wallet_address === recipientWallet) {
      return res.status(400).json({ error: 'You cannot request money from your own wallet address.' })
    }

    // 4. Create request in database
    const request = await prisma.paymentRequest.create({
      data: {
        requester_wallet: requester.wallet_address,
        recipient_wallet: recipientWallet,
        amount: parsedAmount,
        asset: assetSymbol,
        purpose,
        message: message || null,
        status: 'PENDING'
      }
    })

    // 5. Generate New Request Notification for the recipient
    // Try to customize message with requester's full name
    const requesterName = requester.full_name || 'A user'
    await prisma.notification.create({
      data: {
        wallet_address: recipientWallet,
        title: 'New Payment Request',
        message: `${requesterName} has requested ${parsedAmount} ${assetSymbol} from you for ${purpose}.`,
        type: 'INFO'
      }
    })

    return res.status(201).json(request)
  } catch (err: any) {
    console.error('Create payment request error:', err)
    return res.status(500).json({ error: 'Internal server error creating payment request.' })
  }
}

/**
 * Endpoint: GET /api/payment-requests
 * Retrieves list of payment requests related to the authenticated user.
 */
export const getPaymentRequests = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || !user.wallet_address) {
      return res.json([])
    }

    // Fetch all requests involving the user's wallet (either as requester or recipient)
    const requests = await prisma.paymentRequest.findMany({
      where: {
        OR: [
          { requester_wallet: user.wallet_address },
          { recipient_wallet: user.wallet_address }
        ]
      },
      orderBy: { created_at: 'desc' }
    })

    return res.json(requests)
  } catch (err: any) {
    console.error('Get payment requests error:', err)
    return res.status(500).json({ error: 'Internal server error fetching payment requests.' })
  }
}

/**
 * Endpoint: GET /api/payment-requests/:id
 * Retrieves details of a single request.
 */
export const getPaymentRequestById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const request = await prisma.paymentRequest.findUnique({ where: { id } })
    
    if (!request) {
      return res.status(404).json({ error: 'Payment request not found.' })
    }

    // Validate that the request belongs to the authenticated user
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || !user.wallet_address) {
      return res.status(400).json({ error: 'User wallet not connected.' })
    }

    if (
      request.requester_wallet !== user.wallet_address &&
      request.recipient_wallet !== user.wallet_address
    ) {
      return res.status(403).json({ error: 'You are not authorized to view this request.' })
    }

    return res.json(request)
  } catch (err: any) {
    console.error('Get payment request details error:', err)
    return res.status(500).json({ error: 'Internal server error fetching payment request details.' })
  }
}

/**
 * Endpoint: PATCH /api/payment-requests/:id/decline
 * Declines a pending request.
 */
export const declinePaymentRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const request = await prisma.paymentRequest.findUnique({ where: { id } })

    if (!request) {
      return res.status(404).json({ error: 'Payment request not found.' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || !user.wallet_address) {
      return res.status(400).json({ error: 'User wallet not connected.' })
    }

    // Only the recipient of the request can decline it
    if (request.recipient_wallet !== user.wallet_address) {
      return res.status(403).json({ error: 'Only the request recipient can decline it.' })
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot decline a request in '${request.status}' status.` })
    }

    const updatedRequest = await prisma.paymentRequest.update({
      where: { id },
      data: { status: 'DECLINED' }
    })

    // Notify the requester
    const recipientName = user.full_name || 'The recipient'
    await prisma.notification.create({
      data: {
        wallet_address: request.requester_wallet,
        title: 'Request Declined',
        message: `${recipientName} has declined your payment request of ${request.amount} ${request.asset}.`,
        type: 'ERROR'
      }
    })

    return res.json(updatedRequest)
  } catch (err: any) {
    console.error('Decline request error:', err)
    return res.status(500).json({ error: 'Internal server error declining payment request.' })
  }
}

/**
 * Endpoint: PATCH /api/payment-requests/:id/pay
 * dual-mode:
 * 1. If payload DOES NOT have 'xdr': prepares the unsigned transaction.
 * 2. If payload DOES have 'xdr': submits the signed transaction.
 */
export const payPaymentRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { xdr } = req.body

    const request = await prisma.paymentRequest.findUnique({ where: { id } })
    if (!request) {
      return res.status(404).json({ error: 'Payment request not found.' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || !user.wallet_address) {
      return res.status(400).json({ error: 'User does not have a connected wallet.' })
    }

    // Only the request recipient is authorized to pay it
    if (request.recipient_wallet !== user.wallet_address) {
      return res.status(403).json({ error: 'Only the request recipient can pay it.' })
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: `This request is already '${request.status}' and cannot be paid.` })
    }

    // Mode A: Prepare transaction envelope
    if (!xdr) {
      // 1. Query Horizon for payer's details
      let payerAccount: any
      try {
        payerAccount = await horizonServer.loadAccount(user.wallet_address)
      } catch (err: any) {
        const is404 = err.status === 404 || (err.response && err.response.status === 404)
        if (is404) {
          return res.status(400).json({
            error: 'Your Stellar account is unfunded on Testnet. Fund it with friendbot first.'
          })
        }
        throw err
      }

      // 2. Validate balance and trustline for the asset
      const stellarAsset = getStellarAsset(request.asset)
      
      if (request.asset === 'USDC') {
        // Find USDC balance/trustline
        const usdcBalance = payerAccount.balances.find(
          (b: any) =>
            b.asset_code === 'USDC' &&
            b.asset_issuer === 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
        )

        if (!usdcBalance) {
          return res.status(400).json({
            error: 'USDC trustline is not established. Add a USDC trustline in your wallet first.'
          })
        }

        const balanceNum = parseFloat(usdcBalance.balance)
        if (balanceNum < request.amount) {
          return res.status(400).json({
            error: `Insufficient USDC. Your wallet has ${balanceNum} USDC, but request requires ${request.amount} USDC.`
          })
        }

        // Also check if they have native XLM for standard fee
        const nativeBalance = payerAccount.balances.find((b: any) => b.asset_type === 'native')
        const xlmBalanceNum = nativeBalance ? parseFloat(nativeBalance.balance) : 0
        if (xlmBalanceNum < 0.00001) {
          return res.status(400).json({
            error: 'Insufficient XLM. You need at least 0.00001 XLM for the Stellar network gas fee.'
          })
        }
      } else {
        // Native XLM balance check
        const nativeBalance = payerAccount.balances.find((b: any) => b.asset_type === 'native')
        const balanceNum = nativeBalance ? parseFloat(nativeBalance.balance) : 0
        const needed = request.amount + 0.00001 // Amount + fee

        if (balanceNum < needed) {
          return res.status(400).json({
            error: `Insufficient XLM balance. Your wallet has ${balanceNum} XLM, but payment requires ${needed} XLM.`
          })
        }
      }

      // 3. Construct source account object
      const sourceAccount = new Account(user.wallet_address, payerAccount.sequence)

      // 4. Build transaction
      const transaction = new TransactionBuilder(sourceAccount, {
        fee: '100', // 100 stroops = 0.00001 XLM base fee
        networkPassphrase: Networks.TESTNET
      })
        .addOperation(
          Operation.payment({
            destination: request.requester_wallet,
            asset: stellarAsset,
            amount: request.amount.toFixed(7)
          })
        )
        .setTimeout(300)
        .build()

      const preparedXdr = transaction.toEnvelope().toXDR('base64')
      return res.json({ xdr: preparedXdr, request })
    }

    // Mode B: Submit signed transaction
    let tx: Transaction
    try {
      tx = new Transaction(xdr, Networks.TESTNET)
    } catch (err) {
      return res.status(400).json({ error: 'Invalid transaction XDR format.' })
    }

    const txHash = tx.hash().toString('hex')
    const senderWallet = tx.source
    const paymentOp = tx.operations[0]

    if (!paymentOp || paymentOp.type !== 'payment') {
      return res.status(400).json({ error: 'Transaction does not contain a valid payment operation.' })
    }

    // Server-side security checks
    if (senderWallet !== user.wallet_address) {
      return res.status(400).json({ error: 'Source address on transaction does not match your connected wallet.' })
    }
    if (paymentOp.destination !== request.requester_wallet) {
      return res.status(400).json({ error: 'Destination address on transaction does not match the requester.' })
    }
    if (parseFloat(paymentOp.amount) !== request.amount) {
      return res.status(400).json({ error: 'Transaction amount does not match the requested amount.' })
    }

    // Submit to Horizon
    try {
      console.log(`Submitting payment for request ${id} (${txHash}) to Horizon...`)
      const result = await horizonServer.submitTransaction(tx)
      console.log('Horizon submission success:', result.hash)

      // 1. Create a successful entry in the general Transaction table
      const dbTx = await prisma.transaction.create({
        data: {
          sender_wallet: senderWallet,
          recipient_wallet: paymentOp.destination,
          amount: request.amount,
          asset_type: request.asset,
          purpose: request.purpose,
          tx_hash: txHash,
          status: 'SUCCESS'
        }
      })

      // 2. Update Payment Request status
      const updatedRequest = await prisma.paymentRequest.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          transaction_hash: txHash
        }
      })

      // 3. Generate notifications
      // Notify Payer (user who is paying)
      await prisma.notification.create({
        data: {
          wallet_address: senderWallet,
          title: 'Request Paid',
          message: `Successfully paid request of ${request.amount} ${request.asset} to ${request.requester_wallet.slice(0, 10)}...`,
          type: 'SUCCESS'
        }
      })

      // Notify Requester (who will receive the money)
      const payerName = user.full_name || 'The recipient'
      await prisma.notification.create({
        data: {
          wallet_address: request.requester_wallet,
          title: 'Request Paid',
          message: `${payerName} has paid your request of ${request.amount} ${request.asset}.`,
          type: 'SUCCESS'
        }
      })

      return res.json({
        success: true,
        txHash: txHash,
        request: updatedRequest,
        transaction: dbTx
      })
    } catch (err: any) {
      console.error('Stellar Horizon payment submission failure:', err)
      const errorMessage =
        err.response?.data?.extras?.result_codes?.transaction ||
        err.message ||
        'Transaction submission failed'

      // Log failed general Transaction
      const dbTxFailed = await prisma.transaction.create({
        data: {
          sender_wallet: senderWallet,
          recipient_wallet: paymentOp.destination,
          amount: request.amount,
          asset_type: request.asset,
          purpose: request.purpose,
          tx_hash: txHash,
          status: 'FAILED'
        }
      })

      // Generate failure notification for payer
      await prisma.notification.create({
        data: {
          wallet_address: senderWallet,
          title: 'Payment Request Failed',
          message: `Failed to pay request of ${request.amount} ${request.asset}: ${errorMessage}.`,
          type: 'ERROR'
        }
      })

      return res.status(400).json({
        error: 'Stellar network rejected the transaction.',
        code: errorMessage,
        transaction: dbTxFailed
      })
    }
  } catch (err: any) {
    console.error('Pay request error:', err)
    return res.status(500).json({ error: 'Internal server error executing payment.' })
  }
}
