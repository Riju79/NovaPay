import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  userId?: string
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Access token missing or invalid' })
  }

  try {
    const secret = process.env.JWT_SECRET || 'novapay_jwt_access_secret_token_1827'
    const decoded = jwt.verify(token, secret) as { userId: string }
    req.userId = decoded.userId
    next()
  } catch (err) {
    console.error('JWT verification error:', err)
    return res.status(403).json({ error: 'Access token expired or unauthorized' })
  }
}
