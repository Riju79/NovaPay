import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { serverConfig } from '../config/environment'

export interface AuthRequest extends Request {
  userId?: string
  walletAddress?: string
  network?: string
}

export interface DecodedToken {
  userId: string
  walletAddress?: string
  network?: string
  iat?: number
  exp?: number
}

/**
 * Strict authentication middleware: requires a valid JWT token signed
 * by the server's cryptographic JWT_SECRET.
 */
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Access token missing or invalid.',
      code: 'UNAUTHORIZED',
    })
  }

  try {
    const secret = serverConfig.auth.jwtSecret
    const decoded = jwt.verify(token, secret) as DecodedToken

    req.userId = decoded.userId
    req.walletAddress = decoded.walletAddress
    req.network = decoded.network
    next()
  } catch (err: any) {
    if (err?.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Access token has expired. Please refresh session.',
        code: 'SESSION_EXPIRED',
      })
    }
    return res.status(401).json({
      error: 'Access token is invalid or unauthorized.',
      code: 'INVALID_TOKEN',
    })
  }
}

/**
 * Optional authentication middleware: attaches decoded claims if present,
 * but allows requests to proceed if unauthenticated.
 */
export const optionalAuthenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return next()
  }

  try {
    const secret = serverConfig.auth.jwtSecret
    const decoded = jwt.verify(token, secret) as DecodedToken

    req.userId = decoded.userId
    req.walletAddress = decoded.walletAddress
    req.network = decoded.network
  } catch {
    // Non-fatal for optional auth
  }
  next()
}
