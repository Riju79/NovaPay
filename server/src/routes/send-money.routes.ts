import { Router } from 'express'
import {
  validateRecipient,
  createTransaction,
  submitTransaction,
  confirmTransaction,
  getTransactionHistory,
  getWalletBalance,
  getTransactionByHash
} from '../controllers/send-money.controller'
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth'
import { idempotencyMiddleware } from '../middleware/idempotency'
import { validateRequestBody } from '../middleware/validation'

const router = Router()

// Recipient address validation does not require a strict JWT session.
// Uses optionalAuthenticateToken so it can optionally identify self-transfers if a valid session exists.
router.post(
  '/validate-recipient',
  optionalAuthenticateToken as any,
  validateRequestBody({
    recipientAddress: { required: true, type: 'address' },
  }),
  validateRecipient as any
)

// All send-money transaction endpoints require authenticated session
router.use(authenticateToken as any)

router.post(
  '/create-transaction',
  idempotencyMiddleware,
  validateRequestBody({
    recipientAddress: { required: true, type: 'address' },
    amount: { required: true, type: 'amount' },
  }),
  createTransaction as any
)

router.post(
  '/submit-transaction',
  idempotencyMiddleware,
  validateRequestBody({
    recipient: { required: true, type: 'address' },
    amount: { required: true, type: 'amount' },
  }),
  submitTransaction as any
)

router.post(
  '/confirm-transaction',
  validateRequestBody({
    txHash: { required: true, type: 'txHash' },
  }),
  confirmTransaction as any
)

router.get('/history', getTransactionHistory as any)
router.get('/balance', getWalletBalance as any)
router.get('/transaction/:txHash', getTransactionByHash as any)

export default router
