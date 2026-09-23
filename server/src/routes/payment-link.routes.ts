import { Router } from 'express'
import {
  createPaymentLink,
  getPaymentLinkById,
  preparePaymentLinkTx,
  submitPaymentLinkTx
} from '../controllers/payment-link.controller'
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth'
import { idempotencyMiddleware } from '../middleware/idempotency'

const router = Router()

// createPaymentLink is protected, getPaymentLinkById is public
router.post('/', authenticateToken as any, idempotencyMiddleware as any, createPaymentLink as any)
router.get('/:id', getPaymentLinkById as any)
router.post('/:id/prepare', preparePaymentLinkTx as any)
router.post('/:id/submit', optionalAuthenticateToken as any, idempotencyMiddleware as any, submitPaymentLinkTx as any)

export default router

