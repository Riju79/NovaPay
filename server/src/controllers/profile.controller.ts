import { Response } from 'express'
import prisma from '../config/db'
import { AuthRequest } from '../middleware/auth'
import bcryptjs from 'bcryptjs'

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user) {
      return res.status(404).json({ error: 'Profile not found' })
    }

    return res.json({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      wallet_address: user.wallet_address,
      wallet_connected: user.wallet_connected,
      email_verified: user.email_verified,
      profile_picture: user.profile_picture,
      created_at: user.created_at,
    })
  } catch (err: any) {
    console.error('Get profile error:', err)
    return res.status(500).json({ error: 'Internal server error fetching profile details' })
  }
}

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { full_name, email, profile_picture, password, new_password } = req.body

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user) {
      return res.status(404).json({ error: 'Profile not found' })
    }

    const updateData: any = {}

    if (full_name) updateData.full_name = full_name
    if (profile_picture !== undefined) updateData.profile_picture = profile_picture

    if (email && email !== user.email) {
      // Check duplicate email
      const duplicate = await prisma.user.findUnique({ where: { email } })
      if (duplicate) {
        return res.status(400).json({ error: 'Email address is already in use by another account' })
      }
      updateData.email = email
    }

    // Handle password change if requested
    if (password && new_password) {
      const isMatch = await bcryptjs.compare(password, user.password_hash)
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password input is incorrect' })
      }
      const salt = await bcryptjs.genSalt(10)
      updateData.password_hash = await bcryptjs.hash(new_password, salt)
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
    })

    return res.json({
      id: updatedUser.id,
      full_name: updatedUser.full_name,
      email: updatedUser.email,
      wallet_address: updatedUser.wallet_address,
      wallet_connected: updatedUser.wallet_connected,
      email_verified: updatedUser.email_verified,
      profile_picture: updatedUser.profile_picture,
      created_at: updatedUser.created_at,
    })
  } catch (err: any) {
    console.error('Update profile error:', err)
    return res.status(500).json({ error: 'Internal server error updating profile details' })
  }
}
