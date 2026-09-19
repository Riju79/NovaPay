import { Router } from 'express'
import {
  getPaymentMethods,
  createPaymentMethod,
  setDefaultPaymentMethod,
  getWalletBalances
} from '../controllers/payment-method.controller'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// All routes protected by authenticateToken
router.use(authenticateToken as any)

router.get('/', getPaymentMethods as any)
router.post('/', createPaymentMethod as any)
router.patch('/:id/default', setDefaultPaymentMethod as any)
router.get('/balances', getWalletBalances as any)

export default router
