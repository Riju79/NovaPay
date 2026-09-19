import { Response } from 'express'
import prisma from '../config/db'
import { AuthRequest } from '../middleware/auth'

export const getBeneficiaries = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const beneficiaries = await prisma.beneficiary.findMany({
      where: {
        user_id: req.userId,
        deleted_at: null,
      },
      orderBy: { created_at: 'desc' },
    })

    return res.status(200).json(
      beneficiaries.map((b) => ({
        id: b.id,
        fullName: b.full_name,
        email: b.email,
        phoneNumber: b.phone_number,
        walletAddress: b.wallet_address,
        countryCode: b.country_code,
        payoutMethod: b.payout_method,
        isVerified: b.is_verified,
        createdAt: b.created_at,
      }))
    )
  } catch (err: any) {
    console.error('[Beneficiary Controller] Error fetching beneficiaries:', err)
    return res.status(500).json({ error: 'Failed to retrieve beneficiaries.' })
  }
}

export const createBeneficiary = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const {
      fullName,
      email,
      phoneNumber,
      walletAddress,
      countryCode,
      payoutMethod,
    } = req.body

    if (!fullName || typeof fullName !== 'string') {
      return res.status(400).json({ error: 'fullName is required.' })
    }

    const beneficiary = await prisma.beneficiary.create({
      data: {
        user_id: req.userId,
        full_name: fullName.trim(),
        email: email ? email.trim() : null,
        phone_number: phoneNumber ? phoneNumber.trim() : null,
        wallet_address: walletAddress ? walletAddress.trim() : null,
        country_code: countryCode ? countryCode.trim().toUpperCase() : 'US',
        payout_method: payoutMethod || 'MIDNIGHT_WALLET',
        is_verified: true,
      },
    })

    return res.status(201).json({
      id: beneficiary.id,
      fullName: beneficiary.full_name,
      email: beneficiary.email,
      walletAddress: beneficiary.wallet_address,
      countryCode: beneficiary.country_code,
      payoutMethod: beneficiary.payout_method,
      isVerified: beneficiary.is_verified,
      createdAt: beneficiary.created_at,
    })
  } catch (err: any) {
    console.error('[Beneficiary Controller] Error creating beneficiary:', err)
    return res.status(500).json({ error: 'Failed to create beneficiary.' })
  }
}

export const deleteBeneficiary = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const { id } = req.params

    const existing = await prisma.beneficiary.findFirst({
      where: { id, user_id: req.userId, deleted_at: null },
    })

    if (!existing) {
      return res.status(404).json({ error: 'Beneficiary not found or unauthorized.' })
    }

    await prisma.beneficiary.update({
      where: { id },
      data: { deleted_at: new Date() },
    })

    return res.status(200).json({ success: true, message: 'Beneficiary removed.' })
  } catch (err: any) {
    console.error('[Beneficiary Controller] Error removing beneficiary:', err)
    return res.status(500).json({ error: 'Failed to remove beneficiary.' })
  }
}
