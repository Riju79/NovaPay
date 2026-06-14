import { Request, Response } from 'express'
import prisma from '../config/db'
import jwt from 'jsonwebtoken'
import { AuthRequest } from '../middleware/auth'

// Helper to generate access and refresh JWT tokens
const generateTokens = (userId: string) => {
  const accessSecret = process.env.JWT_SECRET || 'novapay_jwt_access_secret_token_1827'
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'novapay_jwt_refresh_secret_token_9821'

  const accessToken = jwt.sign({ userId }, accessSecret, { expiresIn: '15m' })
  const refreshToken = jwt.sign({ userId }, refreshSecret, { expiresIn: '7d' })

  return { accessToken, refreshToken }
}

export const connectWallet = async (req: Request, res: Response) => {
  try {
    const { wallet_address } = req.body
    if (!wallet_address) {
      return res.status(400).json({ error: 'wallet_address is required' })
    }

    // Check if user exists with this wallet
    const user = await prisma.user.findUnique({ where: { wallet_address } })

    if (user) {
      // Auto login
      const { accessToken, refreshToken } = generateTokens(user.id)
      
      // Update connection status
      if (!user.wallet_connected) {
        await prisma.user.update({
          where: { id: user.id },
          data: { wallet_connected: true }
        })
      }

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })

      return res.json({
        exists: true,
        accessToken,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          wallet_address: user.wallet_address,
          wallet_connected: true,
          email_verified: user.email_verified,
          profile_picture: user.profile_picture,
          created_at: user.created_at,
        }
      })
    } else {
      // Wallet address does not exist in DB -> client needs to redirect to signup
      return res.json({ exists: false, wallet_address })
    }
  } catch (err: any) {
    console.error('Connect wallet error:', err)
    return res.status(500).json({ error: 'Internal server error connecting wallet' })
  }
}

export const disconnectWallet = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: { wallet_connected: false }
    })

    return res.json({ message: 'Wallet disconnected from current session successfully' })
  } catch (err: any) {
    console.error('Disconnect wallet error:', err)
    return res.status(500).json({ error: 'Internal server error disconnecting wallet' })
  }
}

export const getWalletStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    return res.json({
      wallet_address: user.wallet_address,
      wallet_connected: user.wallet_connected
    })
  } catch (err: any) {
    console.error('Get wallet status error:', err)
    return res.status(500).json({ error: 'Internal server error fetching wallet status' })
  }
}
