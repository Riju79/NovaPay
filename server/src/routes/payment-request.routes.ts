import { Router } from 'express'
import {
  createPaymentRequest,
  getPaymentRequests,
  getPaymentRequestById,
  declinePaymentRequest,
  payPaymentRequest
} from '../controllers/payment-request.controller'

const router = Router()

// All routes are protected by authenticateToken middleware in index.ts
router.post('/', createPaymentRequest)
router.get('/', getPaymentRequests)
router.get('/:id', getPaymentRequestById)
router.patch('/:id/pay', payPaymentRequest)
router.patch('/:id/decline', declinePaymentRequest)

export default router
