import { Router } from 'express'
import {
  getRemittances,
  getRemittanceById,
  createRemittance,
  transitionRemittance,
  cancelRemittance,
} from '../controllers/remittance.controller'
import { authenticateToken } from '../middleware/auth'
import { idempotencyMiddleware } from '../middleware/idempotency'

const router = Router()

router.get('/', authenticateToken as any, getRemittances as any)
router.get('/:id', authenticateToken as any, getRemittanceById as any)
router.post('/', authenticateToken as any, idempotencyMiddleware as any, createRemittance as any)
router.post('/:id/transition', authenticateToken as any, idempotencyMiddleware as any, transitionRemittance as any)
router.post('/:id/cancel', authenticateToken as any, cancelRemittance as any)

export default router
