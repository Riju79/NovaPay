/**
 * High-Level Escrow Service Layer for NovaPay
 */

import { escrowClient, formatEscrowStatus } from './client'
import { CreateEscrowParams, EscrowDetails, EscrowStatus } from './types'
import { TransactionManager } from '@/transactions/transactionManager'
import { API_URL } from '@/config'

export class EscrowService {
  /**
   * Create a new escrow agreement
   */
  public static async createEscrow(
    params: CreateEscrowParams,
    payerAddress: string,
    txManager?: TransactionManager
  ): Promise<{ escrowId: string; txHash: string }> {
    txManager?.setPreparing()

    const amountNum = parseFloat(params.amountTDust)
    if (isNaN(amountNum) || amountNum <= 0) {
      const err = 'Invalid amount. Must be greater than 0.'
      txManager?.setFailed(err)
      throw new Error(err)
    }

    const amountBaseUnits = BigInt(Math.round(amountNum * 1_000_000))
    const deadlineDays = params.deadlineDays || 7
    const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadlineDays * 86400

    txManager?.setAwaitingWallet()

    try {
      const payload = {
        payerAddress,
        payeeAddress: params.payeeAddress,
        arbiterAddress: params.arbiterAddress || payerAddress,
        amountTDust: params.amountTDust,
        amountBaseUnits: amountBaseUnits.toString(),
        deadlineTimestamp,
      }

      const { txHash } = await escrowClient.submitEscrowTransaction('create', payload)
      txManager?.setSubmitted(txHash)

      const escrowId = `escrow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

      // Store in backend
      await fetch(`${API_URL}/api/escrow/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: escrowId,
          payer: payerAddress,
          payee: params.payeeAddress,
          arbiter: params.arbiterAddress || payerAddress,
          amount: amountNum,
          status: EscrowStatus.CREATED,
          txHash,
          deadline: deadlineTimestamp,
        }),
      }).catch((err) => console.warn('[EscrowService] Backend sync warning:', err))

      txManager?.setConfirmed(txHash)
      return { escrowId, txHash }
    } catch (err: any) {
      txManager?.setFailed(err.message || 'Failed to create escrow')
      throw err
    }
  }

  /**
   * Fund an existing escrow
   */
  public static async fundEscrow(
    escrowId: string,
    payerAddress: string,
    txManager?: TransactionManager
  ): Promise<{ txHash: string }> {
    txManager?.setPreparing()
    txManager?.setAwaitingWallet()

    try {
      const { txHash } = await escrowClient.submitEscrowTransaction('fund', {
        escrowId,
        payerAddress,
      })
      txManager?.setSubmitted(txHash)

      await fetch(`${API_URL}/api/escrow/records/${escrowId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: EscrowStatus.FUNDED, txHash }),
      }).catch(() => null)

      txManager?.setConfirmed(txHash)
      return { txHash }
    } catch (err: any) {
      txManager?.setFailed(err.message || 'Failed to fund escrow')
      throw err
    }
  }

  /**
   * Release escrow funds to payee
   */
  public static async releaseEscrow(
    escrowId: string,
    callerAddress: string,
    txManager?: TransactionManager
  ): Promise<{ txHash: string }> {
    txManager?.setPreparing()
    txManager?.setAwaitingWallet()

    try {
      const { txHash } = await escrowClient.submitEscrowTransaction('release', {
        escrowId,
        callerAddress,
      })
      txManager?.setSubmitted(txHash)

      await fetch(`${API_URL}/api/escrow/records/${escrowId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: EscrowStatus.RELEASED, txHash }),
      }).catch(() => null)

      txManager?.setConfirmed(txHash)
      return { txHash }
    } catch (err: any) {
      txManager?.setFailed(err.message || 'Failed to release escrow')
      throw err
    }
  }

  /**
   * Refund escrow funds to payer
   */
  public static async refundEscrow(
    escrowId: string,
    callerAddress: string,
    txManager?: TransactionManager
  ): Promise<{ txHash: string }> {
    txManager?.setPreparing()
    txManager?.setAwaitingWallet()

    try {
      const { txHash } = await escrowClient.submitEscrowTransaction('refund', {
        escrowId,
        callerAddress,
      })
      txManager?.setSubmitted(txHash)

      await fetch(`${API_URL}/api/escrow/records/${escrowId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: EscrowStatus.REFUNDED, txHash }),
      }).catch(() => null)

      txManager?.setConfirmed(txHash)
      return { txHash }
    } catch (err: any) {
      txManager?.setFailed(err.message || 'Failed to refund escrow')
      throw err
    }
  }

  /**
   * Cancel an unfunded escrow
   */
  public static async cancelEscrow(
    escrowId: string,
    callerAddress: string,
    txManager?: TransactionManager
  ): Promise<{ txHash: string }> {
    txManager?.setPreparing()
    txManager?.setAwaitingWallet()

    try {
      const { txHash } = await escrowClient.submitEscrowTransaction('cancel', {
        escrowId,
        callerAddress,
      })
      txManager?.setSubmitted(txHash)

      await fetch(`${API_URL}/api/escrow/records/${escrowId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: EscrowStatus.CANCELLED, txHash }),
      }).catch(() => null)

      txManager?.setConfirmed(txHash)
      return { txHash }
    } catch (err: any) {
      txManager?.setFailed(err.message || 'Failed to cancel escrow')
      throw err
    }
  }

  /**
   * Fetch all escrows for a given wallet address
   */
  public static async fetchEscrows(walletAddress: string): Promise<EscrowDetails[]> {
    try {
      const res = await fetch(`${API_URL}/api/escrow/records?walletAddress=${encodeURIComponent(walletAddress)}`)
      if (res.ok) {
        const records = await res.json()
        if (Array.isArray(records)) {
          return records.map((r) => ({
            id: r.id,
            payer: r.payer,
            payee: r.payee,
            arbiter: r.arbiter,
            amount: typeof r.amount === 'number' ? r.amount.toFixed(2) : String(r.amount),
            amountBaseUnits: BigInt(Math.round((parseFloat(r.amount) || 0) * 1_000_000)),
            status: r.status,
            statusLabel: formatEscrowStatus(r.status),
            createdAt: r.createdAt || Date.now(),
            deadline: r.deadline || Date.now() + 86400 * 7,
            createdAtFormatted: new Date((r.createdAt || Date.now()) * 1000).toLocaleDateString(),
            deadlineFormatted: new Date((r.deadline || Date.now() / 1000 + 86400 * 7) * 1000).toLocaleDateString(),
          }))
        }
      }
    } catch (err) {
      console.warn('[EscrowService] Failed to fetch escrows:', err)
    }

    return []
  }
}
