import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../config/db'

/**
 * Fetch all notifications for the authenticated user
 */
export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const queryAddress = (req.query.walletAddress as string) || (req.query.address as string)

    if (queryAddress) {
      const notifications = await prisma.notification.findMany({
        where: { wallet_address: queryAddress },
        orderBy: { created_at: 'desc' }
      })
      return res.json(notifications)
    }

    if (req.userId && typeof req.userId === 'string') {
      const user = await prisma.user.findUnique({ where: { id: req.userId } })
      if (user && user.wallet_address) {
        const notifications = await prisma.notification.findMany({
          where: { wallet_address: user.wallet_address },
          orderBy: { created_at: 'desc' }
        })
        return res.json(notifications)
      }
    }

    // Default fallback: return all recent notifications
    const allNotifs = await prisma.notification.findMany({
      orderBy: { created_at: 'desc' },
      take: 50
    })

    return res.json(allNotifs)
  } catch (err: any) {
    console.error('Fetch notifications error:', err)
    return res.status(500).json({ error: 'Server error retrieving notifications' })
  }
}

/**
 * Mark a notification as read
 */
export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { id } = req.params

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || !user.wallet_address) {
      return res.status(400).json({ error: 'User wallet not connected' })
    }

    const notification = await prisma.notification.findFirst({
      where: { id, wallet_address: user.wallet_address }
    })

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { is_read: true }
    })

    return res.json(updated)
  } catch (err: any) {
    console.error('Mark notification read error:', err)
    return res.status(500).json({ error: 'Server error updating notification status' })
  }
}

/**
 * Delete a notification
 */
export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { id } = req.params

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || !user.wallet_address) {
      return res.status(400).json({ error: 'User wallet not connected' })
    }

    const notification = await prisma.notification.findFirst({
      where: { id, wallet_address: user.wallet_address }
    })

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    await prisma.notification.delete({
      where: { id }
    })

    return res.json({ success: true, message: 'Notification deleted successfully' })
  } catch (err: any) {
    console.error('Delete notification error:', err)
    return res.status(500).json({ error: 'Server error deleting notification' })
  }
}

/**
 * Clear all notifications for the user
 */
export const clearAllNotifications = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || !user.wallet_address) {
      return res.status(400).json({ error: 'User wallet not connected' })
    }

    await prisma.notification.deleteMany({
      where: { wallet_address: user.wallet_address }
    })

    return res.json({ success: true, message: 'All notifications cleared successfully' })
  } catch (err: any) {
    console.error('Clear all notifications error:', err)
    return res.status(500).json({ error: 'Server error clearing notifications' })
  }
}
