/**
 * Risk Assessment Service
 * Computes multidimensional transaction risk score (0 to 100):
 * - Amount tier weight
 * - Velocity burst frequency
 * - Counterparty novelty
 * - High-risk jurisdiction scoring
 */

import { Prisma } from '@prisma/client'
import prisma from '../../config/db'
import { toDecimal } from '../../utils/money'

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface RiskEvaluationParams {
  userId: string
  senderWallet: string
  recipientWallet: string
  amount: Prisma.Decimal | string
  destinationCountry?: string
}

export interface RiskScoreResult {
  riskScore: number
  riskLevel: RiskLevel
  factors: string[]
  recommendedAction: 'APPROVE' | 'MANUAL_REVIEW' | 'REJECT'
}

export class RiskService {
  // Prohibited jurisdictions (FATF Blacklist / OFAC Comprehensive Sanctions)
  public static readonly PROHIBITED_COUNTRIES = ['KP', 'IR', 'SY', 'CU', 'RU-CR']

  // High-Risk Monitored jurisdictions (FATF Grey List)
  public static readonly ELEVATED_RISK_COUNTRIES = ['MM', 'YE', 'VE', 'SS', 'LY']

  /**
   * Computes comprehensive risk score for a proposed transaction
   */
  public static async evaluateTransactionRisk(params: RiskEvaluationParams): Promise<RiskScoreResult> {
    const { userId, senderWallet, recipientWallet, destinationCountry } = params
    const amountDec = toDecimal(params.amount)
    let score = 10 // baseline risk
    const factors: string[] = []

    // 1. Amount Tier Scoring
    if (amountDec.gt(5000)) {
      score += 45
      factors.push('HIGH_VALUE_TRANSACTION: Amount exceeds 5,000 tDUST')
    } else if (amountDec.gt(1000)) {
      score += 30
      factors.push('ELEVATED_VALUE_TRANSACTION: Amount exceeds 1,000 tDUST')
    } else if (amountDec.gt(250)) {
      score += 15
      factors.push('STANDARD_VALUE_TRANSACTION: Amount exceeds 250 tDUST')
    } else {
      score += 5
      factors.push('MICRO_TRANSACTION: Standard low-value transfer')
    }

    // 2. Jurisdiction Evaluation
    if (destinationCountry) {
      const countryUpper = destinationCountry.toUpperCase().trim()
      if (this.PROHIBITED_COUNTRIES.includes(countryUpper)) {
        score += 85
        factors.push(`PROHIBITED_JURISDICTION: Sanctioned country code (${countryUpper})`)
      } else if (this.ELEVATED_RISK_COUNTRIES.includes(countryUpper)) {
        score += 35
        factors.push(`ELEVATED_RISK_JURISDICTION: FATF monitored country (${countryUpper})`)
      }
    }

    // 3. Counterparty Novelty (Has sender ever paid recipient before?)
    const isKnownRecipient = await this.isKnownCounterparty(senderWallet, recipientWallet)
    if (!isKnownRecipient) {
      score += 15
      factors.push('NEW_COUNTERPARTY: First recorded transfer to this recipient')
    }

    // 4. Short-term Velocity Burst (Number of transactions in past hour)
    const recentTxCount = await this.getRecentTxCountPastHour(senderWallet)
    if (recentTxCount >= 5) {
      score += 25
      factors.push(`HIGH_VELOCITY_BURST: ${recentTxCount} transfers in past hour`)
    } else if (recentTxCount >= 3) {
      score += 10
      factors.push(`MODERATE_VELOCITY: ${recentTxCount} transfers in past hour`)
    }

    // Cap score at 100
    const finalScore = Math.min(100, score)

    // Map to level & recommended action
    let riskLevel: RiskLevel = 'LOW'
    let recommendedAction: 'APPROVE' | 'MANUAL_REVIEW' | 'REJECT' = 'APPROVE'

    if (finalScore >= 86) {
      riskLevel = 'CRITICAL'
      recommendedAction = 'REJECT'
    } else if (finalScore >= 71) {
      riskLevel = 'HIGH'
      recommendedAction = 'MANUAL_REVIEW'
    } else if (finalScore >= 31) {
      riskLevel = 'MEDIUM'
      recommendedAction = 'APPROVE'
    } else {
      riskLevel = 'LOW'
      recommendedAction = 'APPROVE'
    }

    return {
      riskScore: finalScore,
      riskLevel,
      factors,
      recommendedAction,
    }
  }

  /**
   * Checks if sender has previously completed a transaction to recipient
   */
  private static async isKnownCounterparty(sender: string, recipient: string): Promise<boolean> {
    try {
      const pastTx = await prisma.transaction.findFirst({
        where: {
          sender_wallet: sender.trim(),
          recipient_wallet: recipient.trim(),
          status: 'SUCCESS',
        },
      })
      return Boolean(pastTx)
    } catch {
      return false
    }
  }

  /**
   * Counts transfers initiated by wallet in the last 60 minutes
   */
  private static async getRecentTxCountPastHour(sender: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    try {
      return await prisma.transaction.count({
        where: {
          sender_wallet: sender.trim(),
          created_at: { gte: oneHourAgo },
        },
      })
    } catch {
      return 0
    }
  }
}
