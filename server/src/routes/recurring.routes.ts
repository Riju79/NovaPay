import { Router } from 'express'
import {
  createSubscriptionRecord,
  getSubscriptionRecords,
  executeSubscriptionPayment,
  updateSubscriptionStatus,
  handleRecurringContractAction,
} from '../controllers/recurring.controller'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// All recurring routes require authenticated session
router.use(authenticateToken as any)

router.post('/records', createSubscriptionRecord as any)
router.get('/records', getSubscriptionRecords as any)
router.post('/records/:id/execute', executeSubscriptionPayment as any)
router.patch('/records/:id/status', updateSubscriptionStatus as any)
router.post('/:action', handleRecurringContractAction as any)

export default router
