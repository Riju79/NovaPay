import { Prisma } from '@prisma/client'

/**
 * Validates and converts financial values into exact Prisma.Decimal instances.
 * Prevents IEEE-754 floating point arithmetic loss.
 */
export function toDecimal(value: string | number | Prisma.Decimal | bigint): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    return value
  }

  if (typeof value === 'bigint') {
    return new Prisma.Decimal(value.toString())
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      throw new Error('Invalid financial amount: not a finite number')
    }
    return new Prisma.Decimal(value.toString())
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed || !/^-?\d+(\.\d+)?$/.test(trimmed)) {
      throw new Error(`Invalid financial string representation: '${value}'`)
    }
    return new Prisma.Decimal(trimmed)
  }

  throw new Error(`Unsupported financial value type: ${typeof value}`)
}

/**
 * Validates whether an amount is positive and non-zero
 */
export function isPositiveAmount(amount: string | number | Prisma.Decimal): boolean {
  try {
    const dec = toDecimal(amount)
    return dec.isPositive() && !dec.isZero()
  } catch {
    return false
  }
}

/**
 * Converts human readable amount (e.g. 10.500000 tDUST) to integer base units (10_500_000n)
 */
export function toBaseUnits(amount: string | number | Prisma.Decimal, decimals = 6): bigint {
  const dec = toDecimal(amount)
  const factor = new Prisma.Decimal(10).pow(decimals)
  return BigInt(dec.mul(factor).toFixed(0))
}

/**
 * Converts base units (e.g. 10_500_000n) to Prisma.Decimal (10.500000)
 */
export function fromBaseUnits(baseUnits: bigint, decimals = 6): Prisma.Decimal {
  const factor = new Prisma.Decimal(10).pow(decimals)
  return new Prisma.Decimal(baseUnits.toString()).div(factor)
}
