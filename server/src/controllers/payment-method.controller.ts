import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../config/db'

const isValidWalletAddress = (address: string): boolean => {
  if (!address || typeof address !== 'string') return false
  return address.length >= 10
}

/**
 * Endpoint: GET /api/payment-methods
 * Retrieves all payment methods for the authenticated user.
 */
export const getPaymentMethods = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user) {
      return res.status(404).json({ error: 'User not found.' })
    }

    let methods = await prisma.paymentMethod.findMany({
      where: { user_id: user.id }
    })

    if (user.wallet_address) {
      const hasDefaultWallet = methods.some(
        (m) => m.wallet_address === user.wallet_address
      )

      if (!hasDefaultWallet) {
        const hasAnyDefault = methods.some((m) => m.is_default)
        const newMethod = await prisma.paymentMethod.create({
          data: {
            user_id: user.id,
            provider: 'LACE_MIDNIGHT',
            wallet_address: user.wallet_address,
            is_default: !hasAnyDefault,
            status: 'ACTIVE'
          }
        })
        methods.push(newMethod)
      }
    }

    return res.json(methods)
  } catch (err: any) {
    console.error('Fetch payment methods error:', err)
    return res.status(500).json({ error: 'Server error retrieving payment methods.' })
  }
}

/**
 * Endpoint: POST /api/payment-methods
 * Registers a new payment method.
 */
export const createPaymentMethod = async (req: AuthRequest, res: Response) => {
  try {
    const { provider, walletAddress, isDefault } = req.body

    if (!provider || !walletAddress) {
      return res.status(400).json({ error: 'Provider and wallet address are required.' })
    }

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!isValidWalletAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address format.' })
    }

    if (isDefault) {
      await prisma.paymentMethod.updateMany({
        where: { user_id: req.userId },
        data: { is_default: false }
      })
    }

    const method = await prisma.paymentMethod.create({
      data: {
        user_id: req.userId,
        provider: provider.toUpperCase(),
        wallet_address: walletAddress,
        is_default: !!isDefault,
        status: 'ACTIVE'
      }
    })

    return res.status(201).json(method)
  } catch (err: any) {
    console.error('Create payment method error:', err)
    return res.status(500).json({ error: 'Server error creating payment method.' })
  }
}

/**
 * Endpoint: PATCH /api/payment-methods/:id/default
 * Sets a payment method as default.
 */
export const setDefaultPaymentMethod = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const targetMethod = await prisma.paymentMethod.findUnique({ where: { id } })
    if (!targetMethod || targetMethod.user_id !== req.userId) {
      return res.status(404).json({ error: 'Payment method not found.' })
    }

    await prisma.paymentMethod.updateMany({
      where: { user_id: req.userId },
      data: { is_default: false }
    })

    const updated = await prisma.paymentMethod.update({
      where: { id },
      data: { is_default: true }
    })

    return res.json(updated)
  } catch (err: any) {
    console.error('Set default payment method error:', err)
    return res.status(500).json({ error: 'Server error setting default payment method.' })
  }
}

/**
 * Endpoint: GET /api/payment-methods/balances
 * Fetches native and USDC balances for connected wallet.
 */
export const getWalletBalances = async (req: AuthRequest, res: Response) => {
  try {
    const { address } = req.query

    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Wallet address parameter is required.' })
    }

    if (!isValidWalletAddress(address)) {
      return res.status(400).json({ error: 'Invalid wallet address.' })
    }

    // Query transactions in DB involving this wallet address
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { sender_wallet: address },
          { recipient_wallet: address }
        ],
        status: 'COMPLETED'
      }
    })

    let tDustNet = 0
    let usdcNet = 0

    for (const tx of transactions) {
      const amt = Number(tx.amount) || 0
      const curr = (tx.asset_type || 'tDUST').toUpperCase()

      if (tx.recipient_wallet === address) {
        if (curr.includes('USDC')) usdcNet += amt
        else tDustNet += amt
      } else if (tx.sender_wallet === address) {
        if (curr.includes('USDC')) usdcNet -= amt
        else tDustNet -= amt
      }
    }

    const tDustStr = tDustNet > 0 ? tDustNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '0.00'
    const usdcStr = usdcNet > 0 ? usdcNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '0.00'

    return res.json({
      tDust: tDustStr,
      midnight: tDustStr,
      xlm: '0.00',
      usdc: usdcStr,
      isNotFunded: tDustNet === 0 && usdcNet === 0
    })
  } catch (err: any) {
    console.error('Get wallet balances error:', err)
    return res.status(500).json({ error: 'Server error retrieving wallet balances.' })
  }
}
