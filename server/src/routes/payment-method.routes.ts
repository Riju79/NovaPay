import { Router } from 'express'
import {
  getPaymentMethods,
  createPaymentMethod,
  setDefaultPaymentMethod,
  getWalletBalances
} from '../controllers/payment-method.controller'

const router = Router()

// All routes protected by authenticateToken in index.ts
router.get('/', getPaymentMethods)
router.post('/', createPaymentMethod)
router.patch('/:id/default', setDefaultPaymentMethod)
router.get('/balances', getWalletBalances)

export default router
