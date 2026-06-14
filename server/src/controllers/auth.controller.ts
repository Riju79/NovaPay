import { Request, Response } from 'express'
import bcryptjs from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../config/db'
import { AuthRequest } from '../middleware/auth'

// Helper to generate access and refresh JWT tokens
const generateTokens = (userId: string) => {
  const accessSecret = process.env.JWT_SECRET || 'novapay_jwt_access_secret_token_1827'
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'novapay_jwt_refresh_secret_token_9821'

  const accessToken = jwt.sign({ userId }, accessSecret, { expiresIn: '15m' })
  const refreshToken = jwt.sign({ userId }, refreshSecret, { expiresIn: '7d' })

  return { accessToken, refreshToken }
}

export const signup = async (req: Request, res: Response) => {
  try {
    const { full_name, email, password, wallet_address } = req.body

    // 1. Basic validation
    if (!full_name || !email || !password || !wallet_address) {
      return res.status(400).json({ error: 'All fields (name, email, password, wallet address) are required' })
    }

    // 2. Validate email uniqueness
    const existingEmail = await prisma.user.findUnique({ where: { email } })
    if (existingEmail) {
      return res.status(400).json({ error: 'An account with this email address already exists' })
    }

    // 3. Validate wallet address uniqueness
    const existingWallet = await prisma.user.findUnique({ where: { wallet_address } })
    if (existingWallet) {
      return res.status(400).json({ error: 'This Stellar wallet is already linked to another account' })
    }

    // 4. Hash password
    const salt = await bcryptjs.genSalt(10)
    const password_hash = await bcryptjs.hash(password, salt)

    // 5. Create user in database
    const user = await prisma.user.create({
      data: {
        full_name,
        email,
        password_hash,
        wallet_address,
        wallet_connected: true,
      },
    })

    // 6. Generate session tokens
    const { accessToken, refreshToken } = generateTokens(user.id)

    // Store refresh token in secure cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    return res.status(201).json({
      accessToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        wallet_address: user.wallet_address,
        wallet_connected: user.wallet_connected,
        email_verified: user.email_verified,
        profile_picture: user.profile_picture,
        created_at: user.created_at,
      },
    })
  } catch (err: any) {
    console.error('Signup error:', err)
    return res.status(500).json({ error: 'Internal server error during registration' })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    // 1. Basic validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // 2. Retrieve user
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password credentials' })
    }

    // 3. Compare password hash
    const isMatch = await bcryptjs.compare(password, user.password_hash)
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password credentials' })
    }

    // 4. Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id)

    // Set cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    // Update wallet connected flag if connected
    if (!user.wallet_connected) {
      await prisma.user.update({
        where: { id: user.id },
        data: { wallet_connected: true },
      })
    }

    return res.json({
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
      },
    })
  } catch (err: any) {
    console.error('Login error:', err)
    return res.status(500).json({ error: 'Internal server error during login' })
  }
}

export const refresh = async (req: Request, res: Response) => {
  try {
    // Look up refresh token in cookies or request body
    let refreshToken = req.body?.refreshToken
    if (!refreshToken && req.headers.cookie) {
      const match = req.headers.cookie.match(/refreshToken=([^;]+)/)
      if (match) refreshToken = match[1]
    }
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token is missing' })
    }

    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'novapay_jwt_refresh_secret_token_9821'
    
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, refreshSecret) as { userId: string }
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } })
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid refresh session' })
    }

    // Generate fresh tokens
    const tokens = generateTokens(user.id)

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    return res.json({
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        wallet_address: user.wallet_address,
        wallet_connected: user.wallet_connected,
        email_verified: user.email_verified,
        profile_picture: user.profile_picture,
        created_at: user.created_at,
      },
    })
  } catch (err: any) {
    console.error('Refresh token error:', err)
    return res.status(401).json({ error: 'Session expired or invalid refresh token' })
  }
}

export const me = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user) {
      return res.status(404).json({ error: 'User account not found' })
    }

    return res.json({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      wallet_address: user.wallet_address,
      wallet_connected: user.wallet_connected,
      email_verified: user.email_verified,
      profile_picture: user.profile_picture,
      created_at: user.created_at,
    })
  } catch (err: any) {
    console.error('Fetch me error:', err)
    return res.status(500).json({ error: 'Internal server error fetching account details' })
  }
}

export const logout = async (req: Request, res: Response) => {
  try {
    res.clearCookie('refreshToken')
    return res.json({ message: 'Session logged out successfully' })
  } catch (err: any) {
    console.error('Logout error:', err)
    return res.status(500).json({ error: 'Internal server error during logout' })
  }
}
