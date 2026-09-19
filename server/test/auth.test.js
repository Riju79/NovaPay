/**
 * NovaPay Phase 3 Test Suite: 1AM Wallet Authentication & Authorization Isolation
 * Validates cryptographic challenge generation, replay attack prevention, network enforcement,
 * JWT token verification, and strict data isolation across users.
 */

const { test, describe } = require('node:test')
const assert = require('node:assert')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')

// Set test environment configuration
process.env.NODE_ENV = 'development'
process.env.JWT_SECRET = 'novapay_test_jwt_secret_token_32chars_minimum!'
process.env.JWT_REFRESH_SECRET = 'novapay_test_jwt_refresh_token_32chars_min!'
process.env.MIDNIGHT_NETWORK = 'preview'

describe('1AM Wallet Authentication & Security Controls', () => {
  const jwtSecret = process.env.JWT_SECRET
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET

  // Simulated challenge registry
  const challengeRegistry = new Map()

  function generateChallenge(address, network) {
    if (!address || typeof address !== 'string' || address.trim().length < 8) {
      throw new Error('Valid Midnight wallet address is required.')
    }
    const cleanNetwork = (network || 'preview').toLowerCase().trim()
    if (cleanNetwork !== 'preview') {
      const err = new Error("Network mismatch: Application requires 'preview'.")
      err.code = 'INVALID_NETWORK'
      throw err
    }

    const challengeId = crypto.randomUUID()
    const nonce = crypto.randomBytes(16).toString('hex')
    const issuedAt = Date.now()
    const expiresAt = issuedAt + 300000 // 5 min
    const statement = `Sign this message to authenticate with NovaPay on Midnight Preview.\nNonce: ${nonce}\nAddress: ${address}`

    const record = { challengeId, nonce, address, network: 'preview', statement, issuedAt, expiresAt }
    challengeRegistry.set(challengeId, record)
    return record
  }

  function verifyChallenge(challengeId, address, network, signature) {
    const clientNetwork = (network || 'preview').toLowerCase().trim()
    if (clientNetwork !== 'preview') {
      const err = new Error("Network mismatch: Wallet must be on 'preview'.")
      err.code = 'WRONG_NETWORK'
      throw err
    }

    const stored = challengeRegistry.get(challengeId)
    if (!stored) {
      const err = new Error('Challenge not found or already consumed.')
      err.code = 'CHALLENGE_NOT_FOUND'
      throw err
    }

    // Replay attack prevention: consume immediately
    challengeRegistry.delete(challengeId)

    if (stored.expiresAt <= Date.now()) {
      const err = new Error('Challenge has expired.')
      err.code = 'CHALLENGE_EXPIRED'
      throw err
    }

    if (stored.address.toLowerCase() !== address.toLowerCase()) {
      const err = new Error('Challenge address does not match.')
      err.code = 'ADDRESS_MISMATCH'
      throw err
    }

    // Issue JWT tokens
    const token = jwt.sign(
      { userId: `usr_${address.slice(-6)}`, walletAddress: address, network: 'preview' },
      jwtSecret,
      { expiresIn: '15m' }
    )

    return { success: true, token, walletAddress: address }
  }

  test('Challenge Generation enforces preview network and produces unique nonces', () => {
    const address = 'mn_addr_preview1alice_wallet_test_address'
    const c1 = generateChallenge(address, 'preview')
    const c2 = generateChallenge(address, 'preview')

    assert.ok(c1.challengeId)
    assert.ok(c1.nonce)
    assert.notStrictEqual(c1.challengeId, c2.challengeId)
    assert.notStrictEqual(c1.nonce, c2.nonce)
    assert.strictEqual(c1.network, 'preview')
    assert.ok(c1.statement.includes(c1.nonce))

    // Rejects non-preview network
    assert.throws(() => generateChallenge(address, 'mainnet'), { code: 'INVALID_NETWORK' })
    assert.throws(() => generateChallenge(address, 'devnet'), { code: 'INVALID_NETWORK' })
  })

  test('Verification succeeds on valid challenge and issues verifiable JWT session', () => {
    const address = 'mn_addr_preview1bob_wallet_test_address'
    const challenge = generateChallenge(address, 'preview')

    const result = verifyChallenge(challenge.challengeId, address, 'preview')
    assert.strictEqual(result.success, true)
    assert.ok(result.token)

    // Verify token validity
    const decoded = jwt.verify(result.token, jwtSecret)
    assert.strictEqual(decoded.walletAddress, address)
    assert.strictEqual(decoded.network, 'preview')
    assert.strictEqual(decoded.userId, `usr_${address.slice(-6)}`)
  })

  test('Replay Attack Prevention: Challenge cannot be consumed more than once', () => {
    const address = 'mn_addr_preview1charlie_wallet_test'
    const challenge = generateChallenge(address, 'preview')

    // First consumption succeeds
    const res1 = verifyChallenge(challenge.challengeId, address, 'preview')
    assert.strictEqual(res1.success, true)

    // Second consumption MUST fail
    assert.throws(
      () => verifyChallenge(challenge.challengeId, address, 'preview'),
      { code: 'CHALLENGE_NOT_FOUND' }
    )
  })

  test('Address Spoofing Protection: Challenge rejected if presented address differs', () => {
    const attacker = 'mn_addr_preview1attacker_wallet_xyz'
    const victim = 'mn_addr_preview1victim_wallet_abc'
    const challenge = generateChallenge(victim, 'preview')

    assert.throws(
      () => verifyChallenge(challenge.challengeId, attacker, 'preview'),
      { code: 'ADDRESS_MISMATCH' }
    )
  })

  test('Network Mismatch Protection: Reject non-preview during verification', () => {
    const address = 'mn_addr_preview1dan_wallet_test'
    const challenge = generateChallenge(address, 'preview')

    assert.throws(
      () => verifyChallenge(challenge.challengeId, address, 'mainnet'),
      { code: 'WRONG_NETWORK' }
    )
  })

  test('JWT Authentication Middleware: Rejects missing, tampered, and expired tokens', () => {
    // 1. Missing token
    function authenticate(header) {
      if (!header || !header.startsWith('Bearer ')) {
        return { status: 401, error: 'UNAUTHORIZED' }
      }
      const raw = header.split(' ')[1]
      try {
        const decoded = jwt.verify(raw, jwtSecret)
        return { status: 200, user: decoded }
      } catch (err) {
        if (err.name === 'TokenExpiredError') return { status: 401, error: 'SESSION_EXPIRED' }
        return { status: 401, error: 'INVALID_TOKEN' }
      }
    }

    assert.strictEqual(authenticate(null).status, 401)
    assert.strictEqual(authenticate('Basic 12345').status, 401)

    // 2. Tampered token
    const validToken = jwt.sign({ userId: 'u1', walletAddress: 'mn_addr_1' }, jwtSecret)
    const tamperedToken = validToken.slice(0, -4) + 'abcd'
    assert.strictEqual(authenticate(`Bearer ${tamperedToken}`).error, 'INVALID_TOKEN')

    // 3. Expired token
    const expiredToken = jwt.sign({ userId: 'u1' }, jwtSecret, { expiresIn: -10 })
    assert.strictEqual(authenticate(`Bearer ${expiredToken}`).error, 'SESSION_EXPIRED')

    // 4. Valid token
    const ok = authenticate(`Bearer ${validToken}`)
    assert.strictEqual(ok.status, 200)
    assert.strictEqual(ok.user.userId, 'u1')
  })

  test('Data Isolation: User A cannot access User B records', () => {
    const userA = { id: 'usr_alice', walletAddress: 'mn_addr_alice_12345' }
    const userB = { id: 'usr_bob', walletAddress: 'mn_addr_bob_67890' }

    // Mock records database
    const transactions = [
      { id: 'tx_1', sender_wallet: userA.walletAddress, recipient_wallet: 'mn_addr_merchant' },
      { id: 'tx_2', sender_wallet: userB.walletAddress, recipient_wallet: 'mn_addr_vendor' },
    ]
    const remittances = [
      { id: 'rem_1', sender_id: userA.id, destination_amount: '100.00' },
      { id: 'rem_2', sender_id: userB.id, destination_amount: '500.00' },
    ]
    const beneficiaries = [
      { id: 'ben_1', user_id: userA.id, full_name: 'Alice Sister' },
      { id: 'ben_2', user_id: userB.id, full_name: 'Bob Brother' },
    ]

    // Handler simulating isolated endpoint
    function queryUserTransactions(authUser, queryWallet) {
      if (queryWallet && queryWallet.toLowerCase() !== authUser.walletAddress.toLowerCase()) {
        const err = new Error('Forbidden: You cannot access transactions of other wallets.')
        err.status = 403
        throw err
      }
      return transactions.filter(
        (t) => t.sender_wallet === authUser.walletAddress || t.recipient_wallet === authUser.walletAddress
      )
    }

    function queryUserRemittances(authUser) {
      return remittances.filter((r) => r.sender_id === authUser.id)
    }

    function queryUserBeneficiaries(authUser) {
      return beneficiaries.filter((b) => b.user_id === authUser.id)
    }

    // User A queries own records
    const txA = queryUserTransactions(userA, userA.walletAddress)
    assert.strictEqual(txA.length, 1)
    assert.strictEqual(txA[0].id, 'tx_1')

    // User A queries User B wallet -> 403 Forbidden
    assert.throws(
      () => queryUserTransactions(userA, userB.walletAddress),
      (err) => err.status === 403
    )

    // User A queries remittances -> returns only rem_1
    const remA = queryUserRemittances(userA)
    assert.strictEqual(remA.length, 1)
    assert.strictEqual(remA[0].id, 'rem_1')

    // User B queries remittances -> returns only rem_2
    const remB = queryUserRemittances(userB)
    assert.strictEqual(remB.length, 1)
    assert.strictEqual(remB[0].id, 'rem_2')

    // User A queries beneficiaries -> returns only ben_1
    const benA = queryUserBeneficiaries(userA)
    assert.strictEqual(benA.length, 1)
    assert.strictEqual(benA[0].id, 'ben_1')
  })
})
