import { Router } from 'express'
import {
  createChallenge,
  verifyWalletAuth,
  getAuthenticatedMe,
  refreshSession,
  logout,
} from '../controllers/auth.controller'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// Public challenge & verification routes
router.post('/challenge', createChallenge as any)
router.post('/verify', verifyWalletAuth as any)
router.post('/refresh', refreshSession as any)

// Protected session routes
router.get('/me', authenticateToken as any, getAuthenticatedMe as any)
router.post('/logout', authenticateToken as any, logout as any)

export default router
