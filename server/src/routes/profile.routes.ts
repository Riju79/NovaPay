import { Router } from 'express'
import { getProfile, updateProfile } from '../controllers/profile.controller'
import { authenticateToken } from '../middleware/auth'

const router = Router()

router.get('/', authenticateToken as any, getProfile as any)
router.put('/update', authenticateToken as any, updateProfile as any)

export default router
