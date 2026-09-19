import { Router } from 'express'
import {
  getComplianceCases,
  getComplianceCaseById,
  getComplianceStatus,
  submitProofVerification,
  issueKYCCredential,
  screenTransaction
} from '../controllers/compliance.controller'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// Enforce authenticated session for all compliance routes
router.use(authenticateToken as any)

router.get('/status', getComplianceStatus as any)
router.post('/screen', screenTransaction as any)
router.post('/verify-proof', submitProofVerification as any)
router.post('/issue-credential', issueKYCCredential as any)
router.get('/cases', getComplianceCases as any)
router.get('/cases/:id', getComplianceCaseById as any)

export default router
