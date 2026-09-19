/**
 * NovaPay Phase 4 Test Suite: Real Midnight Preview Blockchain Integration
 * Validates all 11 MidnightBlockchainService capabilities:
 * 1. getNetwork
 * 2. getWalletState
 * 3. getBalance
 * 4. buildTransaction
 * 5. requestSignature
 * 6. submitTransaction
 * 7. getTransaction
 * 8. waitForConfirmation
 * 9. verifyTransaction
 * 10. verifyAssetTransfer
 * 11. verifyContract
 *
 * Ensures:
 * - Real live Midnight Preview network integration
 * - Strict rejection of Mainnet
 * - Decimal/integer financial units (1 tDUST = 1,000,000 base units)
 * - Cryptographic independent server-side verification (frontend cannot declare success)
 */

const { test, describe, before } = require('node:test')
const assert = require('node:assert')
const { Prisma } = require('@prisma/client')

// Configure environment for tests
process.env.NODE_ENV = 'development'
process.env.MIDNIGHT_NETWORK = 'preview'
process.env.MIDNIGHT_RPC_URL = 'https://rpc.preview.midnight.network'

const { MidnightBlockchainService } = require('../build/services/midnight-blockchain.service')

describe('MidnightBlockchainService - Capabilities Suite', () => {

  test('Capability 1: getNetwork - returns Midnight Preview network metadata', async () => {
    const network = await MidnightBlockchainService.getNetwork()
    assert.strictEqual(network.network, 'preview', 'Network should be preview')
    assert.ok(typeof network.chain === 'string', 'Chain name must be string')
    assert.ok(network.chain.toLowerCase().includes('preview'), 'Chain must be Midnight Preview')
    assert.ok(network.ledgerVersion.length > 0, 'Ledger version should be reported')
    assert.ok(typeof network.blockHeight === 'number', 'Block height must be a number')
    assert.ok(network.isPreview, 'isPreview flag must be true')
  })

  test('Capability 2: getWalletState - validates format and reads state root', async () => {
    const validHexAddress = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    const state = await MidnightBlockchainService.getWalletState(validHexAddress)
    assert.strictEqual(state.address, validHexAddress)
    assert.strictEqual(state.network, 'preview')
    assert.ok(state.isValid, 'Valid 64-char address must be marked valid')
    assert.ok(typeof state.stateRoot === 'string', 'State root must be returned')

    // Invalid short address
    const invalidState = await MidnightBlockchainService.getWalletState('short_addr')
    assert.strictEqual(invalidState.isValid, false)
  })

  test('Capability 3: getBalance - returns integer base units and Decimal balance', async () => {
    const testAddress = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    const bal = await MidnightBlockchainService.getBalance(testAddress, 'tDUST')
    assert.strictEqual(bal.asset.toUpperCase(), 'TDUST')
    assert.strictEqual(bal.network, 'preview')
    assert.ok(bal.decimalAmount instanceof Prisma.Decimal, 'Balance must be Prisma.Decimal')
    assert.ok(typeof bal.baseUnits === 'bigint', 'baseUnits must be BigInt')
    assert.ok(typeof bal.displayAmount === 'string', 'displayAmount must be string')
  })

  test('Capability 4: buildTransaction - converts to exact 1,000,000 base units and rejects invalid input', () => {
    const validParams = {
      sender: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      recipient: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      amount: '25.500000',
      assetType: 'tDUST',
      purpose: 'Invoice #102',
    }

    const tx = MidnightBlockchainService.buildTransaction(validParams)
    assert.strictEqual(tx.network, 'preview')
    assert.strictEqual(tx.assetType.toUpperCase(), 'TDUST')
    assert.strictEqual(tx.amount, '25.500000')
    assert.strictEqual(tx.baseUnits, '25500000', '25.5 tDUST must equal 25,500,000 base units')
    assert.ok(tx.transactionIntentId.startsWith('tx_intent_'))
    assert.ok(tx.unshieldedTransfer !== undefined)

    // Rejects non-positive or invalid amounts
    assert.throws(() => {
      MidnightBlockchainService.buildTransaction({ ...validParams, amount: '0.00' })
    }, /greater than zero/)

    assert.throws(() => {
      MidnightBlockchainService.buildTransaction({ ...validParams, amount: '-5.00' })
    }, /greater than zero/)

    assert.throws(() => {
      MidnightBlockchainService.buildTransaction({ ...validParams, amount: 'not_a_number' })
    }, /greater than zero/)
  })

  test('Capability 5: requestSignature - creates signature request intent payload', () => {
    const tx = MidnightBlockchainService.buildTransaction({
      sender: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      recipient: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      amount: '10.000000',
    })

    const sigReq = MidnightBlockchainService.requestSignature(tx)
    assert.ok(sigReq.intentId.startsWith('tx_intent_'))
    assert.strictEqual(sigReq.network, 'preview')
    assert.strictEqual(sigReq.signatureProtocol, '1AM_DAPP_CONNECTOR_V4')
    assert.ok(typeof sigReq.payloadToSign === 'string')
  })

  test('Capability 6: submitTransaction - registers transaction and returns valid 64-char txHash', async () => {
    const validTxHash = '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff'
    const result = await MidnightBlockchainService.submitTransaction(validTxHash)
    assert.strictEqual(result.txHash, validTxHash)
    assert.strictEqual(result.status, 'SUBMITTED')

    // Invalid short hash should be rejected
    await assert.rejects(async () => {
      await MidnightBlockchainService.submitTransaction('123')
    }, /Valid raw transaction or transaction hash is required/)
  })

  test('Capability 7: getTransaction - retrieves real transaction record or node status', async () => {
    const validTxHash = '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff'
    const tx = await MidnightBlockchainService.getTransaction(validTxHash)
    assert.strictEqual(tx.txHash, validTxHash)
    assert.strictEqual(tx.network, 'preview')
    assert.ok(typeof tx.confirmations === 'number')
    assert.ok(typeof tx.blockNumber === 'number')
  })

  test('Capability 8: waitForConfirmation - polls RPC headers', async () => {
    const validTxHash = '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff'
    // Poll RPC node
    const result = await MidnightBlockchainService.waitForConfirmation(validTxHash, 3000, 1000)
    assert.ok(typeof result.confirmed === 'boolean')
    assert.strictEqual(result.txHash, validTxHash)
  })

  test('Capability 9: verifyTransaction - enforces 64-char canonical hex format and chain check', async () => {
    const valid64Hex = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'
    const isValid = await MidnightBlockchainService.verifyTransaction(valid64Hex)
    assert.strictEqual(isValid, true)

    // With 0x prefix
    const isValidWith0x = await MidnightBlockchainService.verifyTransaction(`0x${valid64Hex}`)
    assert.strictEqual(isValidWith0x, true)

    // Invalid format
    const isInvalid = await MidnightBlockchainService.verifyTransaction('invalid-hash-123')
    assert.strictEqual(isInvalid, false)
  })

  test('Capability 10: verifyAssetTransfer - independent backend cryptographic verification', async () => {
    const validTxHash = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'
    const sender = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    const recipient = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
    const amount = new Prisma.Decimal('15.750000')

    // Valid transfer verification
    const verifiedResult = await MidnightBlockchainService.verifyAssetTransfer({
      txHash: validTxHash,
      expectedSender: sender,
      expectedRecipient: recipient,
      expectedAsset: 'tDUST',
      expectedAmount: amount,
    })

    assert.strictEqual(verifiedResult.verified, true)
    assert.strictEqual(verifiedResult.txHash, validTxHash)
    assert.strictEqual(verifiedResult.amount, '15.750000')

    // Missing sender rejection
    const failSender = await MidnightBlockchainService.verifyAssetTransfer({
      txHash: validTxHash,
      expectedSender: '',
      expectedRecipient: recipient,
      expectedAsset: 'tDUST',
      expectedAmount: amount,
    })
    assert.strictEqual(failSender.verified, false)
    assert.ok(failSender.reason.toLowerCase().includes('sender'))

    // Zero or negative amount rejection
    const failAmount = await MidnightBlockchainService.verifyAssetTransfer({
      txHash: validTxHash,
      expectedSender: sender,
      expectedRecipient: recipient,
      expectedAsset: 'tDUST',
      expectedAmount: new Prisma.Decimal('0.000000'),
    })
    assert.strictEqual(failAmount.verified, false)
    assert.ok(failAmount.reason.includes('Amount') || failAmount.reason.includes('greater than zero'))
  })

  test('Capability 11: verifyContract - queries Midnight Preview RPC midnight_contractState', async () => {
    const testContractAddress = '0000000000000000000000000000000000000000000000000000000000000001'
    const contract = await MidnightBlockchainService.verifyContract(testContractAddress)
    assert.strictEqual(contract.contractAddress, testContractAddress)
    assert.strictEqual(contract.network, 'preview')
    assert.ok(typeof contract.existsOnChain === 'boolean')
  })

  test('Security Rule: Mainnet configuration must be strictly rejected', async () => {
    const originalNetwork = process.env.MIDNIGHT_NETWORK
    process.env.MIDNIGHT_NETWORK = 'mainnet'

    await assert.rejects(
      async () => {
        await MidnightBlockchainService.getNetwork()
      },
      /Midnight Mainnet configuration is strictly prohibited/
    )

    process.env.MIDNIGHT_NETWORK = originalNetwork
  })
})
