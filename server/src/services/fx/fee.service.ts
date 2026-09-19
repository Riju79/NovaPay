/**
 * Fee Calculation Service
 * Calculates itemized transaction, platform, and network fees using high-precision Decimal arithmetic.
 *
 * Requirements:
 * - Never use Float for authoritative financial calculations.
 * - Exact Decimal precision across all fee components.
 * - Itemized output: providerFee, novaPayFee, networkFee, totalFee.
 */

import { Prisma } from '@prisma/client'
import { toDecimal } from '../../utils/money'

export interface FeeBreakdown {
  providerFee: Prisma.Decimal
  novaPayFee: Prisma.Decimal
  networkFee: Prisma.Decimal
  totalFee: Prisma.Decimal
  feeCurrency: string
}

export class FeeService {
  // Provider liquidity tier: 0.15% (0.0015)
  private static readonly PROVIDER_FEE_RATE = new Prisma.Decimal('0.0015')

  // NovaPay platform fee tier: 0.25% (0.0025)
  private static readonly NOVAPAY_FEE_RATE = new Prisma.Decimal('0.0025')

  // Fixed network fee for Midnight Preview settlement
  private static readonly FIXED_NETWORK_FEE_TDUST = new Prisma.Decimal('0.050000')
  private static readonly FIXED_NETWORK_FEE_FIAT = new Prisma.Decimal('0.100000')

  /**
   * Calculates itemized fees for a source amount
   */
  public static calculateFees(params: {
    sourceAmount: Prisma.Decimal | string
    sourceCurrency: string
    destinationCurrency?: string
    rail?: string
  }): FeeBreakdown {
    const amountDec = toDecimal(params.sourceAmount)
    const currency = params.sourceCurrency.toUpperCase().trim()

    // 1. Calculate provider fee (0.15% of source amount)
    const providerFee = amountDec.mul(this.PROVIDER_FEE_RATE)

    // 2. Calculate NovaPay platform fee (0.25% of source amount, minimum 0.01)
    let novaPayFee = amountDec.mul(this.NOVAPAY_FEE_RATE)
    const minPlatformFee = new Prisma.Decimal('0.010000')
    if (novaPayFee.lt(minPlatformFee) && !amountDec.isZero()) {
      novaPayFee = minPlatformFee
    }

    // 3. Fixed network fee based on settlement rail / currency
    let networkFee = currency === 'TDUST'
      ? this.FIXED_NETWORK_FEE_TDUST
      : this.FIXED_NETWORK_FEE_FIAT

    // 4. Sum total fee using exact Decimal arithmetic (NO FLOAT ADDITION)
    const totalFee = providerFee.add(novaPayFee).add(networkFee)

    return {
      providerFee,
      novaPayFee,
      networkFee,
      totalFee,
      feeCurrency: currency,
    }
  }
}
