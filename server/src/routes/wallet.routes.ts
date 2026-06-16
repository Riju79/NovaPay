import { Router } from 'express'
import {
  connectWallet,
  disconnectWallet,
  getWalletStatus,
  prepareUSDCTrustline,
  submitUSDCTrustline
} from '../controllers/wallet.controller'
import { authenticateToken } from '../middleware/auth'

const router = Router()

router.post('/connect', connectWallet)
router.post('/disconnect', authenticateToken as any, disconnectWallet as any)
router.get('/status', authenticateToken as any, getWalletStatus as any)
router.post('/trustline/usdc/prepare', authenticateToken as any, prepareUSDCTrustline as any)
router.post('/trustline/usdc/submit', authenticateToken as any, submitUSDCTrustline as any)

export default router
