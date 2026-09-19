import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../config/db'
import { toDecimal, isPositiveAmount } from '../utils/money'

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
    const { recipientWallet, amount, asset, purpose, message, requesterWallet, senderAddress } = req.body

    // 1. Basic validation
    if (!recipientWallet || !amount || !purpose) {
      return res.status(400).json({ error: 'Recipient address, amount, and purpose are required.' })
    }

    if (!isPositiveAmount(amount)) {
      return res.status(400).json({ error: 'Amount must be a positive number.' })
    }

    const decimalAmount = toDecimal(amount)
    const assetSymbol = (asset || 'tDUST').toUpperCase()

    // 2. Validate wallet formats
    if (!isValidWalletAddress(recipientWallet)) {
      return res.status(400).json({ error: 'Invalid recipient wallet address format.' })
    }

    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required to create a payment request.', code: 'UNAUTHORIZED' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || !user.wallet_address) {
      return res.status(400).json({ error: 'No wallet connected to your authenticated profile.' })
    }

    const effectiveRequesterWallet = user.wallet_address.trim()

    // 3. User cannot request money from themselves
    if (effectiveRequesterWallet.toLowerCase() === recipientWallet.toLowerCase()) {
      return res.status(400).json({ error: 'You cannot request money from your own wallet address.' })
    }

    // 4. Create request in database
    const request = await prisma.paymentRequest.create({
      data: {
        requester_id: user.id,
        requester_wallet: effectiveRequesterWallet,
        recipient_wallet: recipientWallet.trim(),
        amount: decimalAmount,
        asset: assetSymbol,
        purpose: purpose ? purpose.trim() : 'Payment Request',
        message: message ? message.trim() : null,
        status: 'PENDING',
      }
    })

    return res.status(201).json(request)
  } catch (err: any) {
    console.error('Create payment request error:', err)
    return res.status(500).json({ error: 'Internal server error while creating payment request.' })
  }
}

/**
 * Endpoint: GET /api/payment-requests
 * Retrieves list of payment requests related to the authenticated user.
 */
export const getPaymentRequests = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHORIZED' })
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

    const queryAddress = (req.query.walletAddress as string) || (req.query.address as string) || (req.query.wallet as string)
    if (queryAddress && !userAddresses.has(queryAddress.trim().toLowerCase())) {
      const matchingWallet = await prisma.wallet.findFirst({
        where: {
          user_id: user.id,
          OR: [
            { address: queryAddress.trim() },
            { shielded_address: queryAddress.trim() },
            { unshielded_address: queryAddress.trim() },
          ],
        },
      })

      if (!matchingWallet) {
        return res.status(403).json({
          error: 'Forbidden: You cannot view payment requests of other wallets.',
          code: 'FORBIDDEN_WALLET_ACCESS',
        })
      }
      userAddresses.add(queryAddress.trim().toLowerCase())
    }

    const searchAddresses = queryAddress
      ? [queryAddress.trim()]
      : Array.from(userAddresses)

    const requests = await prisma.paymentRequest.findMany({
      where: {
        OR: [
          { requester_wallet: { in: searchAddresses } },
          { recipient_wallet: { in: searchAddresses } },
          { requester_id: user.id },
        ],
      },
      orderBy: { created_at: 'desc' },
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
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHORIZED' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { wallets: true },
    })
    if (!user) {
      return res.status(404).json({ error: 'User not found.' })
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

    const { id } = req.params
    const request = await prisma.paymentRequest.findUnique({ where: { id } })
    
    if (!request) {
      return res.status(404).json({ error: 'Payment request not found.' })
    }

    const isAuthorized =
      request.requester_id === user.id ||
      userAddresses.has(request.requester_wallet.toLowerCase()) ||
      userAddresses.has(request.recipient_wallet.toLowerCase())

    if (!isAuthorized) {
      return res.status(403).json({ error: 'You are not authorized to view this request.', code: 'FORBIDDEN' })
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

    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHORIZED' })
    }

    const request = await prisma.paymentRequest.findUnique({ where: { id } })
    if (!request) {
      return res.status(404).json({ error: 'Payment request not found.' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { wallets: true },
    })
    if (!user) {
      return res.status(403).json({ error: 'Authenticated profile has no linked wallet.' })
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

    if (!userAddresses.has(request.recipient_wallet.toLowerCase())) {
      return res.status(403).json({ error: 'Only the designated request recipient can decline it.' })
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot decline a request in '${request.status}' status.` })
    }

    const updateResult = await prisma.paymentRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'DECLINED' },
    })

    if (updateResult.count === 0) {
      return res.status(409).json({ error: 'Payment request has already been updated or processed.' })
    }

    const updatedRequest = await prisma.paymentRequest.findUnique({ where: { id } })

    await prisma.notification.create({
      data: {
        wallet_address: request.requester_wallet,
        title: 'Request Declined',
        message: `${(user.wallet_address || request.recipient_wallet).slice(0, 10)}... has declined your payment request of ${request.amount} ${request.asset}.`,
        type: 'ERROR',
      },
    }).catch(() => {})

    return res.json(updatedRequest)
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal server error declining payment request.' })
  }
}

/**
 * Endpoint: PATCH /api/payment-requests/:id/pay
 */
export const payPaymentRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { xdr, txHash: clientTxHash } = req.body

    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHORIZED' })
    }

    const request = await prisma.paymentRequest.findUnique({ where: { id } })
    if (!request) {
      return res.status(404).json({ error: 'Payment request not found.' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { wallets: true },
    })
    if (!user) {
      return res.status(403).json({ error: 'Please connect your authenticated 1AM wallet first.' })
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

    if (!userAddresses.has(request.recipient_wallet.toLowerCase())) {
      return res.status(403).json({ error: 'Only the designated request recipient can pay it.' })
    }

    const effectiveAddress = user.wallet_address?.trim() || request.recipient_wallet

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
          payer: effectiveAddress,
        })
      ).toString('base64')

      return res.json({ xdr: preparedPayload, request })
    }

    // Mode B: Submit transaction
    const finalTxHash = clientTxHash || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Replay check: verify tx_hash not already used
    const existingTx = await prisma.transaction.findUnique({ where: { tx_hash: finalTxHash } })
    if (existingTx) {
      return res.status(409).json({ error: 'Duplicate payment: Transaction hash has already been registered.', code: 'DUPLICATE_TX_HASH' })
    }

    // Atomic status transition lock
    const updateResult = await prisma.paymentRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'COMPLETED',
        transaction_hash: finalTxHash,
      },
    })

    if (updateResult.count === 0) {
      return res.status(409).json({ error: 'Payment request was already completed or updated by a concurrent request.', code: 'RACE_CONDITION_BLOCKED' })
    }

    // Create entry in Transaction table
    const dbTx = await prisma.transaction.create({
      data: {
        sender_wallet: effectiveAddress,
        recipient_wallet: request.requester_wallet,
        amount: request.amount,
        asset_type: request.asset,
        purpose: request.purpose,
        tx_hash: finalTxHash,
        status: 'SUCCESS',
      },
    })

    const updatedRequest = await prisma.paymentRequest.findUnique({ where: { id } })

    // Notifications
    await prisma.notification.create({
      data: {
        wallet_address: effectiveAddress,
        title: 'Request Paid',
        message: `Successfully paid request of ${request.amount} ${request.asset} to ${request.requester_wallet.slice(0, 10)}...`,
        type: 'SUCCESS'
      }
    }).catch(() => {})

    await prisma.notification.create({
      data: {
        wallet_address: request.requester_wallet,
        title: 'Request Paid',
        message: `Wallet ${effectiveAddress.slice(0, 10)}... has paid your request of ${request.amount} ${request.asset}.`,
        type: 'SUCCESS'
      }
    }).catch(() => {})

    return res.json({
      success: true,
      txHash: finalTxHash,
      request: updatedRequest,
      transaction: dbTx
    })
  } catch (err: any) {
    console.error('Pay request error:', err)
    return res.status(500).json({ error: 'Internal server error executing payment.' })
  }
}
