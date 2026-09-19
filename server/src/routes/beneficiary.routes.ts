import { Router } from 'express'
import {
  getBeneficiaries,
  createBeneficiary,
  deleteBeneficiary,
} from '../controllers/beneficiary.controller'
import { authenticateToken } from '../middleware/auth'

const router = Router()

router.get('/', authenticateToken as any, getBeneficiaries as any)
router.post('/', authenticateToken as any, createBeneficiary as any)
router.delete('/:id', authenticateToken as any, deleteBeneficiary as any)

export default router
