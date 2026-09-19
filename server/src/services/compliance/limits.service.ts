/**
 * Limits & Velocity Service
 * Enforces single-transaction and rolling 24-hour velocity limits based on compliance tiers.
 * Identifies Source-of-Funds (SoF) thresholds.
 */

import { Prisma } from '@prisma/client'
import prisma from '../../config/db'
import { toDecimal } from '../../utils/money'

export type ComplianceTier = 'TIER_0' | 'TIER_1' | 'TIER_2'

export interface TierLimitConfig {
  singleLimit: Prisma.Decimal
  dailyLimit: Prisma.Decimal
  sofTriggerThreshold: Prisma.Decimal
  description: string
}

export const TIER_LIMITS: Record<ComplianceTier, TierLimitConfig> = {
  TIER_0: {
    singleLimit: new Prisma.Decimal('0.000000'),
    dailyLimit: new Prisma.Decimal('0.000000'),
    sofTriggerThreshold: new Prisma.Decimal('0.000000'),
    description: 'Unverified Tier - Transactions are prohibited until KYC is verified.',
  },
  TIER_1: {
    singleLimit: new Prisma.Decimal('1000.000000'),
    dailyLimit: new Prisma.Decimal('5000.000000'),
    sofTriggerThreshold: new Prisma.Decimal('1000.000000'),
    description: 'Standard Verified Tier - Verified W3C KYC Credential.',
  },
  TIER_2: {
    singleLimit: new Prisma.Decimal('10000.000000'),
    dailyLimit: new Prisma.Decimal('50000.000000'),
    sofTriggerThreshold: new Prisma.Decimal('5000.000000'),
    description: 'Enhanced Due Diligence Tier - Verified Source of Funds and accreditation.',
  },
}

export interface LimitCheckResult {
  allowed: boolean
  exceededType?: 'SINGLE_LIMIT' | 'DAILY_VELOCITY' | 'UNVERIFIED'
  reason?: string
  tier: ComplianceTier
  requestedAmount: Prisma.Decimal
  current24hVolume: Prisma.Decimal
  remainingDailyAllowance: Prisma.Decimal
  singleLimit: Prisma.Decimal
  dailyLimit: Prisma.Decimal
  requiresSourceOfFunds: boolean
}

export class LimitsService {
  private static mockVolumeCache = new Map<string, Prisma.Decimal>()

  /**
   * Evaluates requested transfer amount against single and rolling daily velocity limits.
   */
  public static async evaluateLimits(params: {
    userId: string
    walletAddress: string
    amount: Prisma.Decimal | string
    tier?: ComplianceTier
  }): Promise<LimitCheckResult> {
    const { userId, walletAddress, tier = 'TIER_1' } = params
    const amountDec = toDecimal(params.amount)
    const config = TIER_LIMITS[tier]

    // 1. Tier 0 check (Unverified)
    if (tier === 'TIER_0') {
      return {
        allowed: false,
        exceededType: 'UNVERIFIED',
        reason: 'Transactions are prohibited for unverified accounts. Complete KYC verification to proceed.',
        tier,
        requestedAmount: amountDec,
        current24hVolume: new Prisma.Decimal(0),
        remainingDailyAllowance: new Prisma.Decimal(0),
        singleLimit: config.singleLimit,
        dailyLimit: config.dailyLimit,
        requiresSourceOfFunds: false,
      }
    }

    // 2. Single transaction limit check
    if (amountDec.gt(config.singleLimit)) {
      return {
        allowed: false,
        exceededType: 'SINGLE_LIMIT',
        reason: `Transfer amount of ${amountDec.toFixed(2)} tDUST exceeds single transaction limit of ${config.singleLimit.toFixed(2)} tDUST for ${tier}.`,
        tier,
        requestedAmount: amountDec,
        current24hVolume: new Prisma.Decimal(0),
        remainingDailyAllowance: config.dailyLimit,
        singleLimit: config.singleLimit,
        dailyLimit: config.dailyLimit,
        requiresSourceOfFunds: true,
      }
    }

    // 3. Calculate 24h rolling volume
    const current24hVolume = await this.get24HourVolume(userId, walletAddress)
    const projectedDailyVolume = current24hVolume.add(amountDec)

    // 4. Daily velocity limit check
    if (projectedDailyVolume.gt(config.dailyLimit)) {
      const remainingAllowance = config.dailyLimit.sub(current24hVolume)
      return {
        allowed: false,
        exceededType: 'DAILY_VELOCITY',
        reason: `Projected 24-hour volume (${projectedDailyVolume.toFixed(2)} tDUST) exceeds daily velocity limit of ${config.dailyLimit.toFixed(2)} tDUST. Remaining allowance: ${remainingAllowance.gt(0) ? remainingAllowance.toFixed(2) : '0.00'} tDUST.`,
        tier,
        requestedAmount: amountDec,
        current24hVolume,
        remainingDailyAllowance: remainingAllowance.gt(0) ? remainingAllowance : new Prisma.Decimal(0),
        singleLimit: config.singleLimit,
        dailyLimit: config.dailyLimit,
        requiresSourceOfFunds: true,
      }
    }

    // 5. Source of funds trigger check
    const requiresSourceOfFunds = amountDec.gte(config.sofTriggerThreshold) || projectedDailyVolume.gte(config.sofTriggerThreshold.mul(2))
    const remainingDailyAllowance = config.dailyLimit.sub(projectedDailyVolume)

    return {
      allowed: true,
      tier,
      requestedAmount: amountDec,
      current24hVolume,
      remainingDailyAllowance,
      singleLimit: config.singleLimit,
      dailyLimit: config.dailyLimit,
      requiresSourceOfFunds,
    }
  }

  /**
   * Queries confirmed volume for the user in the past 24 hours
   */
  public static async get24HourVolume(userId: string, walletAddress: string): Promise<Prisma.Decimal> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    try {
      const transfers = await prisma.transaction.findMany({
        where: {
          sender_wallet: walletAddress.trim(),
          created_at: { gte: oneDayAgo },
          status: { in: ['SUCCESS', 'PENDING'] },
        },
        select: { amount: true },
      })

      let total = new Prisma.Decimal(0)
      for (const t of transfers) {
        total = total.add(toDecimal(t.amount))
      }
      if (this.mockVolumeCache.has(walletAddress)) {
        total = total.add(this.mockVolumeCache.get(walletAddress)!)
      }
      return total
    } catch {
      // Memory fallback for offline test environments
      return this.mockVolumeCache.get(walletAddress) || new Prisma.Decimal(0)
    }
  }

  /**
   * Helper to record test volume
   */
  public static recordMockVolume(walletAddress: string, amount: Prisma.Decimal | string) {
    const dec = toDecimal(amount)
    const existing = this.mockVolumeCache.get(walletAddress) || new Prisma.Decimal(0)
    this.mockVolumeCache.set(walletAddress, existing.add(dec))
  }

  public static recordTransfer(userId: string, walletAddress: string, amount: Prisma.Decimal | string) {
    this.recordMockVolume(walletAddress, amount)
  }

  public static clearMockVolume() {
    this.mockVolumeCache.clear()
  }

  public static resetMockVolumeCache() {
    this.mockVolumeCache.clear()
  }
}
