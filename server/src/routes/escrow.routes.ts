import { Router } from 'express'
import {
  createEscrowRecord,
  getEscrowRecords,
  updateEscrowStatus,
  handleEscrowContractAction,
} from '../controllers/escrow.controller'

const router = Router()

router.post('/records', createEscrowRecord)
router.get('/records', getEscrowRecords)
router.patch('/records/:id/status', updateEscrowStatus)
router.post('/:action', handleEscrowContractAction)

export default router
