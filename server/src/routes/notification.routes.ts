import { Router } from 'express'
import {
  getNotifications,
  markAsRead,
  deleteNotification,
  clearAllNotifications
} from '../controllers/notification.controller'

const router = Router()

router.get('/', getNotifications)
router.put('/:id/read', markAsRead)
router.delete('/:id', deleteNotification)
router.delete('/', clearAllNotifications)

export default router
