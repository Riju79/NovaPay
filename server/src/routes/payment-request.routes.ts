import { Router } from 'express'
import {
  createPaymentRequest,
  getPaymentRequests,
  getPaymentRequestById,
  declinePaymentRequest,
  payPaymentRequest
} from '../controllers/payment-request.controller'
import { authenticateToken } from '../middleware/auth'
import { idempotencyMiddleware } from '../middleware/idempotency'

const router = Router()

// All payment-request endpoints require authenticated session
router.use(authenticateToken as any)

router.post('/', idempotencyMiddleware as any, createPaymentRequest as any)
router.get('/', getPaymentRequests as any)
router.get('/:id', getPaymentRequestById as any)
router.patch('/:id/pay', idempotencyMiddleware as any, payPaymentRequest as any)
router.patch('/:id/decline', declinePaymentRequest as any)

export default router
