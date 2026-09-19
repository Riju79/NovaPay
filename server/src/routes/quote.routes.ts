import { Router } from 'express'
import { createQuote, getQuote, lockQuote, executeQuote } from '../controllers/quote.controller'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// All quote operations require valid authenticated user session
router.post('/', authenticateToken as any, createQuote as any)
router.get('/:id', authenticateToken as any, getQuote as any)
router.post('/:id/lock', authenticateToken as any, lockQuote as any)
router.post('/:id/execute', authenticateToken as any, executeQuote as any)

export default router
