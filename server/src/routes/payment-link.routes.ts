import { Router } from 'express'
import {
  createPaymentLink,
  getPaymentLinkById,
  preparePaymentLinkTx,
  submitPaymentLinkTx
} from '../controllers/payment-link.controller'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// createPaymentLink is protected, getPaymentLinkById is public
router.post('/', authenticateToken, createPaymentLink)
router.get('/:id', getPaymentLinkById)
router.post('/:id/prepare', preparePaymentLinkTx)
router.post('/:id/submit', submitPaymentLinkTx)

export default router
