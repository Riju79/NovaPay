/**
 * NovaPay Phase 8 Test Suite: FX, Fees and Quotes Engine
 *
 * Tests the complete financial quote lifecycle:
 * User enters amount -> Dynamic FX rate -> Fee calculation -> Quote creation -> Locking -> Expiry -> Replay protection
 *
 * Required Verifications:
 * 1. Dynamic FX rates (never hardcoded, freshness, rate timestamps).
 * 2. Strict Decimal precision (zero float rounding drift).
 * 3. Quote completeness (all 13 required fields present).
 * 4. Quote expiry (automatic TTL expiration).
 * 5. Quote immutability (immutable terms once issued).
 * 6. Quote replay protection (single-use quote execution).
 * 7. Quote ownership (caller verification).
 * 8. Quote locking lifecycle (CREATED -> LOCKED -> EXECUTED).
 */

const { test, describe, beforeEach } = require('node:test')
const assert = require('node:assert')

// Set test environment
process.env.NODE_ENV = 'development'
process.env.JWT_SECRET = 'novapay_test_jwt_secret_token_32chars_minimum!'
process.env.MIDNIGHT_NETWORK = 'preview'

const { QuoteService } = require('../build/services/fx/quote.service')
const { FXRateService } = require('../build/services/fx/fx-rate.service')
const { FeeService } = require('../build/services/fx/fee.service')
const { toDecimal } = require('../build/utils/money')

describe('NovaPay Phase 8: FX, Fees and Quotes Engine', () => {

  const userA = 'user_alice_quotes_001'
  const userB = 'user_bob_attacker_002'

  beforeEach(() => {
    QuoteService.clearCache()
    FXRateService.clearRates()
  })

  // 1. DYNAMIC FX RATES (NEVER HARDCODED)
  describe('1. Dynamic FX Rate Service', () => {
    test('Obtains dynamic exchange rates with rate source and valid timestamps', async () => {
      const rateResult = await FXRateService.getExchangeRate('tDUST', 'USD')

      assert.strictEqual(rateResult.baseCurrency, 'TDUST')
      assert.strictEqual(rateResult.targetCurrency, 'USD')
      assert.ok(rateResult.exchangeRate.gt(0), 'Rate must be strictly positive')
      assert.strictEqual(typeof rateResult.rateSource, 'string')
      assert.ok(rateResult.rateSource.length > 0)
      assert.strictEqual(typeof rateResult.rateTimestamp, 'number')
      assert.ok(rateResult.rateTimestamp > 0)
      assert.strictEqual(rateResult.isStale, false)
    })

    test('Parity check: Identical currency pairs resolve 1:1 via PARITY_ENGINE', async () => {
      const parity = await FXRateService.getExchangeRate('tDUST', 'tDUST')
      assert.strictEqual(parity.exchangeRate.toFixed(8), '1.00000000')
      assert.strictEqual(parity.rateSource, 'PARITY_ENGINE')
    })

    test('Dynamic rate registration: Updates take effect without application restart', async () => {
      // Register custom oracle rate (e.g. 1 tDUST = 2.50000000 EUR)
      FXRateService.registerOracleRate('tDUST', 'EUR', '2.50000000', 'CHAINLINK_PREVIEW_FEED')

      const updated = await FXRateService.getExchangeRate('tDUST', 'EUR')
      assert.strictEqual(updated.exchangeRate.toFixed(8), '2.50000000')
      assert.strictEqual(updated.rateSource, 'CHAINLINK_PREVIEW_FEED')
      assert.ok(Date.now() - updated.rateTimestamp < 5000)
    })
  })

  // 2. DECIMAL FINANCIAL CALCULATIONS (NO FLOAT MATH)
  describe('2. Strict Decimal Fee Calculation', () => {
    test('Calculates itemized fees with exact Decimal precision and zero float rounding error', () => {
      const fees = FeeService.calculateFees({
        sourceAmount: '1000.000000',
        sourceCurrency: 'tDUST',
      })

      // Provider fee: 0.15% of 1000 = 1.500000
      assert.strictEqual(fees.providerFee.toFixed(6), '1.500000')

      // NovaPay fee: 0.25% of 1000 = 2.500000
      assert.strictEqual(fees.novaPayFee.toFixed(6), '2.500000')

      // Network fee: fixed 0.050000 tDUST
      assert.strictEqual(fees.networkFee.toFixed(6), '0.050000')

      // Total fee: 1.5 + 2.5 + 0.05 = 4.050000
      assert.strictEqual(fees.totalFee.toFixed(6), '4.050000')
    })

    test('Enforces platform minimum fee for micro-transactions', () => {
      const microFees = FeeService.calculateFees({
        sourceAmount: '0.100000',
        sourceCurrency: 'tDUST',
      })

      // 0.25% of 0.1 is 0.00025, which is below minimum 0.01
      assert.strictEqual(microFees.novaPayFee.toFixed(6), '0.010000')
      assert.ok(microFees.totalFee.gt(0))
    })
  })

  // 3. QUOTE COMPLETENESS (ALL REQUIRED FIELDS)
  describe('3. Quote Completeness Specification', () => {
    test('Every generated quote contains all 13 mandatory specification fields', async () => {
      const quote = await QuoteService.createQuote(userA, {
        sourceCurrency: 'tDUST',
        destinationCurrency: 'USD',
        sourceAmount: '500.000000',
      })

      // 1. quoteId
      assert.ok(quote.quoteId.startsWith('quote_'))
      // 2. sourceCurrency
      assert.strictEqual(quote.sourceCurrency, 'TDUST')
      // 3. sourceAmount
      assert.strictEqual(quote.sourceAmount, '500.000000')
      // 4. destinationCurrency
      assert.strictEqual(quote.destinationCurrency, 'USD')
      // 5. destinationAmount
      assert.ok(toDecimal(quote.destinationAmount).gt(0))
      // 6. exchangeRate
      assert.ok(toDecimal(quote.exchangeRate).gt(0))
      // 7. rateSource
      assert.strictEqual(typeof quote.rateSource, 'string')
      assert.ok(quote.rateSource.length > 0)
      // 8. providerFee
      assert.ok(toDecimal(quote.providerFee).gte(0))
      // 9. NovaPayFee (exact name check)
      assert.ok('NovaPayFee' in quote)
      assert.ok(toDecimal(quote.NovaPayFee).gte(0))
      // 10. networkFee
      assert.ok(toDecimal(quote.networkFee).gte(0))
      // 11. total
      assert.ok(toDecimal(quote.total).gt(toDecimal(quote.sourceAmount)))
      // 12. createdAt
      assert.ok(!isNaN(Date.parse(quote.createdAt)))
      // 13. expiresAt
      assert.ok(!isNaN(Date.parse(quote.expiresAt)))
      assert.ok(new Date(quote.expiresAt).getTime() > new Date(quote.createdAt).getTime())

      // Status
      assert.strictEqual(quote.status, 'CREATED')
      assert.strictEqual(quote.isLocked, false)
      assert.strictEqual(quote.isExpired, false)
    })
  })

  // 4. QUOTE EXPIRY
  describe('4. Quote Expiry & Automatic Invalidation', () => {
    test('Quote expires automatically after TTL and cannot be locked', async () => {
      // Create quote with short TTL of 1 second
      const quote = await QuoteService.createQuote(userA, {
        sourceCurrency: 'tDUST',
        destinationCurrency: 'USD',
        sourceAmount: '100.00',
        ttlSeconds: 1,
      })

      // Wait 1.1s for quote to expire
      await new Promise((resolve) => setTimeout(resolve, 1100))

      // Verification: Reading quote returns isExpired: true
      const fetched = await QuoteService.getQuote(userA, quote.quoteId)
      assert.strictEqual(fetched.isExpired, true)
      assert.strictEqual(fetched.status, 'EXPIRED')

      // Attempting to lock expired quote throws error
      await assert.rejects(
        async () => {
          await QuoteService.lockQuote(userA, quote.quoteId)
        },
        /expired/i
      )
    })

    test('Cannot execute an expired quote', async () => {
      const quote = await QuoteService.createQuote(userA, {
        sourceCurrency: 'tDUST',
        destinationCurrency: 'USD',
        sourceAmount: '100.00',
        ttlSeconds: 1,
      })

      await new Promise((resolve) => setTimeout(resolve, 1100))

      await assert.rejects(
        async () => {
          await QuoteService.executeQuote(userA, quote.quoteId)
        },
        /expired/i
      )
    })
  })

  // 5. QUOTE IMMUTABILITY
  describe('5. Quote Immutability', () => {
    test('Quote parameters remain strictly immutable throughout its lifecycle', async () => {
      const quote = await QuoteService.createQuote(userA, {
        sourceCurrency: 'tDUST',
        destinationCurrency: 'USD',
        sourceAmount: '750.000000',
      })

      const originalRate = quote.exchangeRate
      const originalDestinationAmount = quote.destinationAmount
      const originalTotal = quote.total

      // Simulate a rate change in the market
      FXRateService.registerOracleRate('tDUST', 'USD', '9.99999999', 'VOLATILE_ORACLE')

      // Lock the quote
      const lockedQuote = await QuoteService.lockQuote(userA, quote.quoteId)

      // Assert that locked quote terms DID NOT CHANGE despite market rate movement
      assert.strictEqual(lockedQuote.exchangeRate, originalRate)
      assert.strictEqual(lockedQuote.destinationAmount, originalDestinationAmount)
      assert.strictEqual(lockedQuote.total, originalTotal)
      assert.strictEqual(lockedQuote.isLocked, true)
    })
  })

  // 6. QUOTE REPLAY PROTECTION
  describe('6. Quote Replay Protection', () => {
    test('Quote cannot be executed more than once (single-use enforcement)', async () => {
      const quote = await QuoteService.createQuote(userA, {
        sourceCurrency: 'tDUST',
        destinationCurrency: 'USD',
        sourceAmount: '200.000000',
      })

      // Lock quote
      await QuoteService.lockQuote(userA, quote.quoteId)

      // First execution: Success
      const executed = await QuoteService.executeQuote(userA, quote.quoteId)
      assert.strictEqual(executed.status, 'EXECUTED')
      assert.strictEqual(executed.isExecuted, true)

      // Replay attempt: Second execution MUST fail
      await assert.rejects(
        async () => {
          await QuoteService.executeQuote(userA, quote.quoteId)
        },
        /Replay attack rejected/i
      )
    })
  })

  // 7. QUOTE OWNERSHIP
  describe('7. Quote Ownership & Authorization', () => {
    test('User B cannot view, lock, or execute User A\'s quote', async () => {
      const quoteA = await QuoteService.createQuote(userA, {
        sourceCurrency: 'tDUST',
        destinationCurrency: 'USD',
        sourceAmount: '300.00',
      })

      // User B attempts to access User A's quote
      await assert.rejects(
        async () => {
          await QuoteService.getQuote(userB, quoteA.quoteId)
        },
        /Access denied/i
      )

      // User B attempts to lock User A's quote
      await assert.rejects(
        async () => {
          await QuoteService.lockQuote(userB, quoteA.quoteId)
        },
        /Access denied/i
      )

      // User B attempts to execute User A's quote
      await assert.rejects(
        async () => {
          await QuoteService.executeQuote(userB, quoteA.quoteId)
        },
        /Access denied/i
      )
    })
  })

  // 8. FULL QUOTE LIFECYCLE
  describe('8. Complete Flow: Amount -> Rate -> Fees -> Quote -> Lock -> Execute', () => {
    test('Seamlessly progresses through the full 6-step lifecycle', async () => {
      // 1. User enters amount & backend calculates rate + fees + creates quote
      const quote = await QuoteService.createQuote(userA, {
        sourceCurrency: 'tDUST',
        destinationCurrency: 'EUR',
        sourceAmount: '1000.000000',
      })
      assert.strictEqual(quote.status, 'CREATED')

      // 2. User locks quote
      const locked = await QuoteService.lockQuote(userA, quote.quoteId)
      assert.strictEqual(locked.status, 'LOCKED')
      assert.strictEqual(locked.isLocked, true)
      assert.ok(locked.lockedAt !== null)

      // 3. User executes transfer with quote
      const executed = await QuoteService.executeQuote(userA, quote.quoteId)
      assert.strictEqual(executed.status, 'EXECUTED')
      assert.strictEqual(executed.isExecuted, true)
      assert.ok(executed.executedAt !== null)
    })
  })
})
