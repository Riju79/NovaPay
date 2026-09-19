import { Router } from 'express'
import {
  createEscrowRecord,
  getEscrowRecords,
  updateEscrowStatus,
  handleEscrowContractAction,
} from '../controllers/escrow.controller'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// All escrow routes require authenticated session
router.use(authenticateToken as any)

router.post('/records', createEscrowRecord as any)
router.get('/records', getEscrowRecords as any)
router.patch('/records/:id/status', updateEscrowStatus as any)
router.post('/:action', handleEscrowContractAction as any)

export default router
