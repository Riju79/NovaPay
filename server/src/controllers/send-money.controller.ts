import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../config/db'
import {
  StrKey,
  Horizon,
  TransactionBuilder,
  Account,
  Asset,
  Operation,
  Networks,
  Transaction
} from '@stellar/stellar-sdk'

// Initialize Stellar Horizon Server for Testnet
const horizonServer = new Horizon.Server('https://horizon-testnet.stellar.org')

/**
 * Endpoint: POST /api/send-money/validate-recipient
 * Validates a recipient's Stellar address.
 */
export const validateRecipient = async (req: AuthRequest, res: Response) => {
  const { recipientAddress } = req.body

  if (!recipientAddress) {
    return res.status(400).json({ error: 'Recipient wallet address is required' })
  }

  try {
    // 1. Verify standard Stellar public key format
    const isValid = StrKey.isValidEd25519PublicKey(recipientAddress)
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid Stellar wallet address format' })
    }

    // 2. Prevent sending to own wallet
    const sender = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!sender) {
      return res.status(404).json({ error: 'Sender account not found' })
    }

    if (sender.wallet_address === recipientAddress) {
      return res.status(400).json({ error: 'Cannot send money to your own wallet address' })
    }

    return res.json({ valid: true, recipientAddress })
  } catch (err: any) {
    console.error('Validation error:', err)
    return res.status(500).json({ error: 'Server error during recipient address validation' })
  }
}

/**
 * Endpoint: POST /api/send-money/create-transaction
 * Builds an unsigned Stellar payment transaction envelope and returns its XDR.
 */
export const createTransaction = async (req: AuthRequest, res: Response) => {
  const { recipientAddress, amount, purpose } = req.body

  // 1. Validate payload
  if (!recipientAddress || !amount || !purpose) {
    return res.status(400).json({ error: 'Recipient address, amount, and purpose are required' })
  }

  const parsedAmount = parseFloat(amount)
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' })
  }

  try {
    // 2. Fetch sender user details
    const sender = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!sender || !sender.wallet_address) {
      return res.status(400).json({ error: 'Sender does not have a connected wallet' })
    }

    // 3. Prevent self-transfers
    if (sender.wallet_address === recipientAddress) {
      return res.status(400).json({ error: 'Cannot create a transaction to send to your own wallet' })
    }

    // 4. Validate recipient address format
    if (!StrKey.isValidEd25519PublicKey(recipientAddress)) {
      return res.status(400).json({ error: 'Invalid recipient address' })
    }

    // 5. Query Horizon to fetch sender's account sequence and balance
    let senderAccount: any
    try {
      senderAccount = await horizonServer.loadAccount(sender.wallet_address)
    } catch (err: any) {
      const is404 = err.status === 404 || (err.response && err.response.status === 404)
      if (is404) {
        return res.status(400).json({
          error: 'Your Stellar account is unfunded on Testnet. Fund your account with friendbot first.'
        })
      }
      throw err
    }

    // 6. Verify sufficient balance (base reserve + base fee + payment amount)
    const nativeBalance = senderAccount.balances.find((b: any) => b.asset_type === 'native')
    const currentBalance = nativeBalance ? parseFloat(nativeBalance.balance) : 0
    const neededAmount = parsedAmount + 0.00001 // Amount + standard transaction base fee (100 stroops)

    if (currentBalance < neededAmount) {
      return res.status(400).json({
        error: `Insufficient balance. Sender wallet has ${currentBalance} XLM, but transaction requires ${neededAmount} XLM.`
      })
    }

    // 7. Construct source account object
    const sourceAccount = new Account(sender.wallet_address, senderAccount.sequence)

    // 8. Build the transaction envelope using the SDK
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: '100', // 100 stroops = 0.00001 XLM
      networkPassphrase: Networks.TESTNET
    })
      .addOperation(
        Operation.payment({
          destination: recipientAddress,
          asset: Asset.native(), // XLM (supports USDC path swaps in future releases)
          amount: parsedAmount.toFixed(7) // Stellar requires exactly 7 decimals
        })
      )
      .setTimeout(300) // 5 minutes timeout limit
      .build()

    // 9. Generate XDR string
    const xdr = transaction.toEnvelope().toXDR('base64')
    return res.json({ xdr, amount: parsedAmount, recipientAddress })
  } catch (err: any) {
    console.error('Create transaction error:', err)
    return res.status(500).json({ error: 'Server error occurred during transaction creation' })
  }
}

/**
 * Endpoint: POST /api/send-money/submit-transaction
 * Submits the signed transaction XDR to Stellar Horizon network.
 */
export const submitTransaction = async (req: AuthRequest, res: Response) => {
  const { xdr, purpose } = req.body

  if (!xdr || !purpose) {
    return res.status(400).json({ error: 'Signed transaction XDR and purpose are required' })
  }

  let tx: Transaction
  try {
    // Decode transaction envelope from XDR
    tx = new Transaction(xdr, Networks.TESTNET)
  } catch (err) {
    return res.status(400).json({ error: 'Invalid transaction XDR format' })
  }

  const txHash = tx.hash().toString('hex')
  const senderWallet = tx.source
  const paymentOp = tx.operations[0]

  if (!paymentOp || paymentOp.type !== 'payment') {
    return res.status(400).json({ error: 'Transaction does not contain a valid payment operation' })
  }

  const recipientWallet = paymentOp.destination
  const paymentAmount = parseFloat(paymentOp.amount)

  try {
    // 1. Prevent duplicate submissions
    const existing = await prisma.transaction.findUnique({ where: { tx_hash: txHash } })
    if (existing) {
      return res.status(400).json({ error: 'Transaction already submitted and processed' })
    }

    // 2. Submit transaction to Stellar Testnet network
    console.log(`Submitting signed transaction ${txHash} to Horizon...`)
    const result = await horizonServer.submitTransaction(tx)
    console.log('Horizon submission success:', result.hash)

    // 3. Save SUCCESS state to SQLite database
    const dbTx = await prisma.transaction.create({
      data: {
        sender_wallet: senderWallet,
        recipient_wallet: recipientWallet,
        amount: paymentAmount,
        asset_type: 'XLM',
        purpose,
        tx_hash: txHash,
        status: 'SUCCESS'
      }
    })

    // 4. Generate SUCCESS Notification
    await prisma.notification.create({
      data: {
        wallet_address: senderWallet,
        title: 'Payment Sent',
        message: `Successfully sent ${paymentAmount} XLM to recipient address ${recipientWallet.slice(0, 10)}... for ${purpose}.`,
        type: 'SUCCESS'
      }
    })

    return res.json({
      success: true,
      txHash: txHash,
      ledger: result.ledger,
      transaction: dbTx
    })
  } catch (err: any) {
    console.error('Stellar Horizon submission failure:', err)

    // Handle failure states and register them in the database for tracking
    const errorMessage = err.response?.data?.extras?.result_codes?.transaction || err.message || 'Transaction submission failed'

    try {
      const dbTxFailed = await prisma.transaction.create({
        data: {
          sender_wallet: senderWallet,
          recipient_wallet: recipientWallet,
          amount: paymentAmount,
          asset_type: 'XLM',
          purpose,
          tx_hash: txHash,
          status: 'FAILED'
        }
      })

      // Generate FAILED Notification
      await prisma.notification.create({
        data: {
          wallet_address: senderWallet,
          title: 'Transaction Failed',
          message: `Attempt to send ${paymentAmount} XLM to ${recipientWallet.slice(0, 10)}... failed: ${errorMessage}.`,
          type: 'ERROR'
        }
      })

      return res.status(400).json({
        error: 'Stellar network rejected this transaction.',
        code: errorMessage,
        transaction: dbTxFailed
      })
    } catch (dbErr) {
      console.error('Error logging failed transaction to database:', dbErr)
      return res.status(400).json({
        error: 'Stellar transaction failed and could not be logged to database.',
        code: errorMessage
      })
    }
  }
}

/**
 * Endpoint: GET /api/send-money/history
 * Returns transaction history for the logged-in user's connected wallet.
 */
export const getTransactionHistory = async (req: AuthRequest, res: Response) => {
  try {
    const sender = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!sender || !sender.wallet_address) {
      return res.json([])
    }

    // Find all incoming and outgoing payments
    const history = await prisma.transaction.findMany({
      where: {
        OR: [
          { sender_wallet: sender.wallet_address },
          { recipient_wallet: sender.wallet_address }
        ]
      },
      orderBy: { created_at: 'desc' }
    })

    return res.json(history)
  } catch (err: any) {
    console.error('History fetch error:', err)
    return res.status(500).json({ error: 'Server error retrieving transaction history' })
  }
}

/**
 * Endpoint: GET /api/send-money/balance
 * Returns the live XLM balance from Horizon.
 */
export const getWalletBalance = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || !user.wallet_address) {
      return res.status(400).json({ error: 'Stellar wallet is not connected to user profile' })
    }

    try {
      const account = await horizonServer.loadAccount(user.wallet_address)
      const nativeBalance = account.balances.find((b) => b.asset_type === 'native')
      return res.json({
        balance: nativeBalance ? nativeBalance.balance : '0.0000000',
        isNotFunded: false
      })
    } catch (err: any) {
      const is404 = err.status === 404 || (err.response && err.response.status === 404)
      if (is404) {
        return res.json({ balance: '0.0000000', isNotFunded: true })
      }
      throw err
    }
  } catch (err: any) {
    console.error('Balance fetch error:', err)
    return res.status(500).json({ error: 'Stellar network error retrieving wallet balance' })
  }
}
