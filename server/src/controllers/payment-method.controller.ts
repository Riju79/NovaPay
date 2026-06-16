import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../config/db'
import { Horizon, StrKey } from '@stellar/stellar-sdk'

const horizonServer = new Horizon.Server('https://horizon-testnet.stellar.org')

// Circle's official USDC Testnet issuer address
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

/**
 * Endpoint: GET /api/payment-methods
 * Retrieves all payment methods for the authenticated user.
 * Automatically inserts Freighter wallet as default if it's linked but not registered.
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

    // Auto-onboard/initialize Freighter as default if user has a linked wallet address
    if (user.wallet_address) {
      const hasFreighter = methods.some(
        (m) => m.provider === 'FREIGHTER' && m.wallet_address === user.wallet_address
      )

      if (!hasFreighter) {
        // If there are other default methods, decide if this should be default
        const hasAnyDefault = methods.some((m) => m.is_default)
        const newMethod = await prisma.paymentMethod.create({
          data: {
            user_id: user.id,
            provider: 'FREIGHTER',
            wallet_address: user.wallet_address,
            is_default: !hasAnyDefault, // Set as default if there is no other default
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

    // Validate wallet address
    if (!StrKey.isValidEd25519PublicKey(walletAddress)) {
      return res.status(400).json({ error: 'Invalid Stellar wallet address format.' })
    }

    // Unset other defaults if this is requested to be default
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
 * Sets a payment method as the default source.
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

    // Unset all default flags for this user
    await prisma.paymentMethod.updateMany({
      where: { user_id: req.userId },
      data: { is_default: false }
    })

    // Set target method as default
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
 * Fetches native XLM and USDC balances from Stellar Horizon for the connected wallet.
 */
export const getWalletBalances = async (req: AuthRequest, res: Response) => {
  try {
    const { address } = req.query

    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Wallet address parameter is required.' })
    }

    if (!StrKey.isValidEd25519PublicKey(address)) {
      return res.status(400).json({ error: 'Invalid Stellar wallet address.' })
    }

    try {
      const account = await horizonServer.loadAccount(address)
      
      // Native XLM
      const nativeBalance = account.balances.find((b) => b.asset_type === 'native')
      
      // USDC stablecoin
      const usdcBalance = account.balances.find(
        (b: any) => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER
      )

      return res.json({
        xlm: nativeBalance ? nativeBalance.balance : '0.0000000',
        usdc: usdcBalance ? usdcBalance.balance : '0.0000000',
        isNotFunded: false
      })
    } catch (err: any) {
      const is404 = err.status === 404 || (err.response && err.response.status === 404)
      if (is404) {
        // Unfunded account on Testnet
        return res.json({
          xlm: '0.0000000',
          usdc: '0.0000000',
          isNotFunded: true
        })
      }
      throw err
    }
  } catch (err: any) {
    console.error('Get wallet balances error:', err)
    return res.status(500).json({ error: 'Stellar network error retrieving wallet balances.' })
  }
}
