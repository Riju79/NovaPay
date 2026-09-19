import { Router } from 'express'
import {
  getNotifications,
  markAsRead,
  deleteNotification,
  clearAllNotifications
} from '../controllers/notification.controller'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// All notification routes strictly require authentication
router.use(authenticateToken as any)

router.get('/', getNotifications)
router.put('/:id/read', markAsRead)
router.delete('/:id', deleteNotification)
router.delete('/', clearAllNotifications)

export default router
