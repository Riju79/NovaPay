import { Router } from 'express'
import {
  createSubscriptionRecord,
  getSubscriptionRecords,
  executeSubscriptionPayment,
  updateSubscriptionStatus,
  handleRecurringContractAction,
} from '../controllers/recurring.controller'

const router = Router()

router.post('/records', createSubscriptionRecord)
router.get('/records', getSubscriptionRecords)
router.post('/records/:id/execute', executeSubscriptionPayment)
router.patch('/records/:id/status', updateSubscriptionStatus)
router.post('/:action', handleRecurringContractAction)

export default router
