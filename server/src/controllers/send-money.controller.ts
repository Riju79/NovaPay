import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../config/db'
import { toDecimal, isPositiveAmount } from '../utils/money'
import { MidnightBlockchainService } from '../services/midnight-blockchain.service'

// Helper for validating Midnight Bech32m / hex wallet address format
const isValidWalletAddress = (address: string): boolean => {
  if (!address || typeof address !== 'string') return false
  const trimmed = address.trim().toLowerCase()
  if (trimmed.length < 10) return false
  if (trimmed.startsWith('mn_') || trimmed.startsWith('addr') || trimmed.startsWith('0x')) return true
  return /^[a-z0-9_-]{10,128}$/i.test(trimmed)
}

/**
 * Endpoint: POST /api/send-money/validate-recipient
 */
export const validateRecipient = async (req: AuthRequest, res: Response) => {
  const { recipientAddress, senderAddress } = req.body

  if (!recipientAddress || typeof recipientAddress !== 'string') {
    return res.status(400).json({ error: 'Recipient wallet address is required' })
  }

  try {
    const trimmedRecipient = recipientAddress.trim()

    if (!isValidWalletAddress(trimmedRecipient)) {
      return res.status(400).json({ error: 'Invalid Midnight wallet address format' })
    }

    let effectiveSenderWallet: string | null = senderAddress || null

    if (!effectiveSenderWallet && req.userId && typeof req.userId === 'string') {
      try {
        const senderUser = await prisma.user.findUnique({ where: { id: req.userId } })
        if (senderUser) effectiveSenderWallet = senderUser.wallet_address
      } catch {
        // ignore
      }
    }

    if (effectiveSenderWallet && effectiveSenderWallet.toLowerCase() === trimmedRecipient.toLowerCase()) {
      return res.status(400).json({ error: 'Cannot send money to your own wallet address' })
    }

    return res.json({ valid: true, recipientAddress: trimmedRecipient })
  } catch (err: any) {
    console.error('Validation error:', err)
    return res.status(500).json({ error: 'Server error during recipient address validation' })
  }
}

/**
 * Endpoint: POST /api/send-money/create-transaction
 * Builds real transaction payload for Midnight Preview with integer base units.
 */
export const createTransaction = async (req: AuthRequest, res: Response) => {
  const { recipientAddress, amount, purpose } = req.body

  if (!recipientAddress || !amount || !purpose) {
    return res.status(400).json({ error: 'Recipient address, amount, and purpose are required' })
  }

  if (!isPositiveAmount(amount)) {
    return res.status(400).json({ error: 'Amount must be a positive number' })
  }

  const decimalAmount = toDecimal(amount)

  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const senderUser = await prisma.user.findUnique({ where: { id: req.userId } })
    const effectiveSenderWallet = senderUser?.wallet_address || req.walletAddress

    if (!effectiveSenderWallet) {
      return res.status(401).json({ error: 'Sender wallet not authenticated or found', code: 'UNAUTHORIZED' })
    }

    if (effectiveSenderWallet.toLowerCase() === recipientAddress.trim().toLowerCase()) {
      return res.status(400).json({ error: 'Cannot create a transaction to send to your own wallet' })
    }

    if (!isValidWalletAddress(recipientAddress)) {
      return res.status(400).json({ error: 'Invalid recipient address' })
    }

    // Run Compliance Orchestration Pipeline
    const { ComplianceService } = await import('../services/compliance/compliance.service')
    const complianceResult = await ComplianceService.screenTransaction({
      userId: req.userId,
      senderWallet: effectiveSenderWallet,
      recipientWallet: recipientAddress.trim(),
      amount: decimalAmount,
      destinationCountry: req.body.destinationCountry,
      sourceOfFundsDeclared: req.body.sourceOfFundsDeclared,
    })

    if (complianceResult.decision === 'REJECTED') {
      return res.status(403).json({
        error: `Transaction rejected by compliance: ${complianceResult.decisionReason}`,
        code: 'COMPLIANCE_REJECTED',
        compliance: complianceResult,
      })
    }

    if (complianceResult.decision === 'MANUAL_REVIEW') {
      return res.status(202).json({
        status: 'MANUAL_REVIEW',
        message: `Transaction held for compliance review: ${complianceResult.decisionReason}`,
        compliance: complianceResult,
      })
    }

    // Build real Midnight transfer payload via MidnightBlockchainService
    const builtTx = MidnightBlockchainService.buildTransaction({
      sender: effectiveSenderWallet,
      recipient: recipientAddress.trim(),
      amount: decimalAmount,
      assetType: 'tDUST',
      purpose,
    })

    return res.json({
      success: true,
      transaction: builtTx,
      amount: decimalAmount.toFixed(6),
      recipientAddress: recipientAddress.trim(),
    })
  } catch (err: any) {
    console.error('Create transaction error:', err)
    return res.status(500).json({ error: err?.message || 'Server error occurred during transaction creation' })
  }
}

/**
 * Endpoint: POST /api/send-money/submit-transaction
 * Registers a real broadcast transaction on Midnight Preview in PENDING status.
 */
export const submitTransaction = async (req: AuthRequest, res: Response) => {
  const { txHash, recipient, amount, purpose, assetType } = req.body

  if (!txHash || typeof txHash !== 'string') {
    return res.status(400).json({ error: 'Valid transaction hash is required' })
  }

  const cleanHash = txHash.trim().replace(/^0x/i, '')

  if (!recipient || !amount) {
    return res.status(400).json({ error: 'Recipient and amount are required' })
  }

  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const senderUser = await prisma.user.findUnique({ where: { id: req.userId } })
    const senderWallet = senderUser?.wallet_address || req.walletAddress

    if (!senderWallet) {
      return res.status(401).json({ error: 'Authenticated wallet not found' })
    }

    const paymentAmount = toDecimal(amount)
    const asset = (assetType || 'tDUST').toUpperCase().trim()

    // Upsert transaction in PENDING status
    let dbTx = await prisma.transaction.findUnique({ where: { tx_hash: cleanHash } }).catch(() => null)

    if (!dbTx) {
      dbTx = await prisma.transaction.create({
        data: {
          sender_wallet: senderWallet,
          recipient_wallet: recipient.trim(),
          amount: paymentAmount,
          asset_type: asset,
          purpose: purpose || 'Transfer',
          tx_hash: cleanHash,
          status: 'PENDING',
        },
      })

      // Also create BlockchainTransfer record from Phase 2 model
      await prisma.blockchainTransfer.create({
        data: {
          tx_hash: cleanHash,
          sender_wallet: senderWallet,
          recipient_wallet: recipient.trim(),
          asset_id: asset,
          amount: paymentAmount,
          network: 'PREVIEW',
          status: 'SUBMITTED',
        },
      }).catch(() => null)

      await prisma.notification.create({
        data: {
          wallet_address: senderWallet,
          title: 'Transaction Pending',
          message: `Transfer of ${paymentAmount.toFixed(6)} ${asset} is pending confirmation on Midnight Preview.`,
          type: 'INFO',
        },
      }).catch(() => null)
    }

    return res.json({
      success: true,
      txHash: cleanHash,
      transaction: dbTx,
    })
  } catch (err: any) {
    console.error('Transaction submission failure:', err)
    return res.status(400).json({ error: err?.message || 'Transaction submission failed' })
  }
}

/**
 * Endpoint: POST /api/send-money/confirm-transaction
 * Independently verifies transaction on Midnight Preview before confirming success.
 * Never blindly trusts frontend status.
 */
export const confirmTransaction = async (req: AuthRequest, res: Response) => {
  const { txHash, status } = req.body

  if (!txHash || typeof txHash !== 'string') {
    return res.status(400).json({ error: 'txHash is required' })
  }

  const cleanHash = txHash.trim().replace(/^0x/i, '')

  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const dbTx = await prisma.transaction.findUnique({ where: { tx_hash: cleanHash } })
    if (!dbTx) {
      return res.status(404).json({ error: 'Transaction record not found' })
    }

    // Handle failure case
    if (status === 'FAILED') {
      const updatedTx = await prisma.transaction.update({
        where: { tx_hash: cleanHash },
        data: { status: 'FAILED' },
      })
      return res.json({ success: true, transaction: updatedTx })
    }

    // INDEPENDENT SERVER-SIDE VERIFICATION: Verify on Midnight Preview RPC
    const verification = await MidnightBlockchainService.verifyAssetTransfer({
      txHash: cleanHash,
      expectedSender: dbTx.sender_wallet,
      expectedRecipient: dbTx.recipient_wallet,
      expectedAmount: dbTx.amount,
      expectedAsset: dbTx.asset_type,
      expectedNetwork: 'preview',
    })

    if (!verification.verified) {
      return res.status(400).json({
        error: `Blockchain verification failed: ${verification.reason}`,
        code: 'VERIFICATION_FAILED',
      })
    }

    // Update database status to SUCCESS only after verified
    const updatedTx = await prisma.transaction.update({
      where: { tx_hash: cleanHash },
      data: { status: 'SUCCESS' },
    })

    // Update BlockchainTransfer status
    await prisma.blockchainTransfer.updateMany({
      where: { tx_hash: cleanHash },
      data: { status: 'CONFIRMED' },
    }).catch(() => null)

    await prisma.notification.create({
      data: {
        wallet_address: updatedTx.sender_wallet,
        title: 'Transaction Confirmed',
        message: `Transfer of ${updatedTx.amount.toFixed(6)} ${updatedTx.asset_type} confirmed on Midnight Preview.`,
        type: 'SUCCESS',
      },
    }).catch(() => null)

    return res.json({ success: true, transaction: updatedTx, verified: true })
  } catch (err: any) {
    console.error('Confirm transaction error:', err)
    return res.status(500).json({ error: err?.message || 'Failed to verify transaction' })
  }
}

/**
 * Endpoint: GET /api/send-money/transaction/:txHash
 * Retrieves transaction details from Midnight Preview node & database.
 */
export const getTransactionByHash = async (req: AuthRequest, res: Response) => {
  const { txHash } = req.params

  if (!txHash) {
    return res.status(400).json({ error: 'txHash is required' })
  }

  try {
    const details = await MidnightBlockchainService.getTransaction(txHash)
    return res.json(details)
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve transaction details' })
  }
}

/**
 * Endpoint: GET /api/send-money/history
 */
export const getTransactionHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required to access transaction history.', code: 'UNAUTHORIZED' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { wallets: true },
    })
    if (!user) {
      return res.json([])
    }

    const userAddresses = new Set<string>()
    if (user.wallet_address) userAddresses.add(user.wallet_address.trim().toLowerCase())
    if (user.wallets) {
      for (const w of user.wallets) {
        if (w.address) userAddresses.add(w.address.trim().toLowerCase())
        if (w.shielded_address) userAddresses.add(w.shielded_address.trim().toLowerCase())
        if (w.unshielded_address) userAddresses.add(w.unshielded_address.trim().toLowerCase())
      }
    }

    const queryAddress = (req.query.walletAddress as string) || (req.query.address as string)
    if (queryAddress) {
      const q = queryAddress.trim().toLowerCase()
      if (!userAddresses.has(q)) {
        const matchingWallet = await prisma.wallet.findFirst({
          where: {
            user_id: user.id,
            OR: [
              { address: queryAddress.trim() },
              { shielded_address: queryAddress.trim() },
              { unshielded_address: queryAddress.trim() },
            ],
          },
        })
        if (matchingWallet) {
          userAddresses.add(q)
        }
      }
    }

    const searchAddresses = Array.from(userAddresses)
    const history = await prisma.transaction.findMany({
      where: {
        OR: [
          { sender_wallet: { in: searchAddresses } },
          { recipient_wallet: { in: searchAddresses } },
          { sender_id: user.id },
          { recipient_id: user.id },
        ],
      },
      orderBy: { created_at: 'desc' },
    })

    return res.json(history)
  } catch (err: any) {
    console.error('History fetch error:', err)
    return res.status(500).json({ error: 'Server error retrieving transaction history' })
  }
}

/**
 * Endpoint: GET /api/send-money/balance
 * Returns exact balance in integer base units and Decimal format.
 */
export const getWalletBalance = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || !user.wallet_address) {
      return res.json({
        balance: '0.000000',
        baseUnits: '0',
        asset: 'tDUST',
        isNotFunded: true,
      })
    }

    const bal = await MidnightBlockchainService.getBalance(user.wallet_address, 'tDUST')

    return res.json({
      balance: bal.displayAmount,
      baseUnits: bal.baseUnits.toString(),
      asset: bal.asset,
      isNotFunded: bal.decimalAmount.lte(0),
      network: 'preview',
    })
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve wallet balance' })
  }
}
