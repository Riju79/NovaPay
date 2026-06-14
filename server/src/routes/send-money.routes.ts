import { Router } from 'express'
import {
  validateRecipient,
  createTransaction,
  submitTransaction,
  getTransactionHistory,
  getWalletBalance
} from '../controllers/send-money.controller'

const router = Router()

// Routes protected by authenticateToken middleware in entry point index.ts
router.post('/validate-recipient', validateRecipient)
router.post('/create-transaction', createTransaction)
router.post('/submit-transaction', submitTransaction)
router.get('/history', getTransactionHistory)
router.get('/balance', getWalletBalance)

export default router
