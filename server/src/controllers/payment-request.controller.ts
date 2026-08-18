import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../config/db'

// Generic address format validator
const isValidWalletAddress = (address: string): boolean => {
  if (!address || typeof address !== 'string') return false
  return address.length >= 10
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

    // 2. Validate wallet formats
    if (!isValidWalletAddress(recipientWallet)) {
      return res.status(400).json({ error: 'Invalid recipient wallet address format.' })
    }

    // Retrieve requester details
    const requester = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!requester || !requester.wallet_address) {
      return res.status(400).json({ error: 'Your user profile does not have a linked wallet.' })
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

    if (request.recipient_wallet !== user.wallet_address) {
      return res.status(403).json({ error: 'Only the request recipient can pay it.' })
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: `This request is already '${request.status}' and cannot be paid.` })
    }

    // Mode A: Prepare transaction envelope
    if (!xdr) {
      const preparedPayload = Buffer.from(
        JSON.stringify({
          requestId: id,
          amount: request.amount,
          asset: request.asset,
          requester: request.requester_wallet,
          payer: user.wallet_address
        })
      ).toString('base64')

      return res.json({ xdr: preparedPayload, request })
    }

    // Mode B: Submit transaction
    const txHash = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Create entry in Transaction table
    const dbTx = await prisma.transaction.create({
      data: {
        sender_wallet: user.wallet_address,
        recipient_wallet: request.requester_wallet,
        amount: request.amount,
        asset_type: request.asset,
        purpose: request.purpose,
        tx_hash: txHash,
        status: 'SUCCESS'
      }
    })

    // Update Payment Request status
    const updatedRequest = await prisma.paymentRequest.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        transaction_hash: txHash
      }
    })

    // Notifications
    await prisma.notification.create({
      data: {
        wallet_address: user.wallet_address,
        title: 'Request Paid',
        message: `Successfully paid request of ${request.amount} ${request.asset} to ${request.requester_wallet.slice(0, 10)}...`,
        type: 'SUCCESS'
      }
    })

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
    console.error('Pay request error:', err)
    return res.status(500).json({ error: 'Internal server error executing payment.' })
  }
}
