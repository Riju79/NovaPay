import { Router } from 'express'
import { signup, login, refresh, logout, me } from '../controllers/auth.controller'
import { authenticateToken } from '../middleware/auth'

const router = Router()

router.post('/signup', signup)
router.post('/login', login)
router.post('/logout', logout)
router.post('/refresh', refresh)
router.get('/me', authenticateToken as any, me as any)

export default router
