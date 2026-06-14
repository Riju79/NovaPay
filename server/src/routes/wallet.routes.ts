import { Router } from 'express'
import { connectWallet, disconnectWallet, getWalletStatus } from '../controllers/wallet.controller'
import { authenticateToken } from '../middleware/auth'

const router = Router()

router.post('/connect', connectWallet)
router.post('/disconnect', authenticateToken as any, disconnectWallet as any)
router.get('/status', authenticateToken as any, getWalletStatus as any)

export default router
