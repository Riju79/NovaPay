/**
 * High-Level Recurring Payment Service Layer for NovaPay
 */

import { recurringClient, formatSubscriptionStatus, frequencyToSeconds, secondsToFrequencyLabel } from './client'
import { CreateSubscriptionParams, SubscriptionDetails, SubscriptionStatus } from './types'
import { TransactionManager } from '@/transactions/transactionManager'
import { API_URL } from '@/config'

export class RecurringService {
  /**
   * Create a recurring payment subscription
   */
  public static async createSubscription(
    params: CreateSubscriptionParams,
    payerAddress: string,
    txManager?: TransactionManager
  ): Promise<{ subscriptionId: string; txHash: string }> {
    txManager?.setPreparing()

    const amountNum = parseFloat(params.amountTDust)
    if (isNaN(amountNum) || amountNum <= 0) {
      const err = 'Invalid amount. Must be greater than 0.'
      txManager?.setFailed(err)
      throw new Error(err)
    }

    const amountBaseUnits = BigInt(Math.round(amountNum * 1_000_000))
    const frequencySeconds = frequencyToSeconds(params.frequency)
    const currentTime = Math.floor(Date.now() / 1000)
    const nextPaymentTime = currentTime + frequencySeconds
    const durationDays = params.durationDays || 30
    const endTime = currentTime + durationDays * 86400

    txManager?.setAwaitingWallet()

    try {
      const payload = {
        payerAddress,
        recipientAddress: params.recipientAddress,
        amountTDust: params.amountTDust,
        amountBaseUnits: amountBaseUnits.toString(),
        frequencySeconds,
        nextPaymentTime,
        endTime,
        maxPayments: params.maxPayments || 0,
      }

      const { txHash } = await recurringClient.submitRecurringTransaction('create', payload)
      txManager?.setSubmitted(txHash)

      const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

      // Store in backend
      await fetch(`${API_URL}/api/recurring/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: subscriptionId,
          payer: payerAddress,
          recipient: params.recipientAddress,
          amount: amountNum,
          frequencySeconds,
          nextPaymentTime,
          endTime,
          maxPayments: params.maxPayments || 0,
          paymentCount: 0,
          status: SubscriptionStatus.ACTIVE,
          txHash,
        }),
      }).catch((err) => console.warn('[RecurringService] Backend sync warning:', err))

      txManager?.setConfirmed(txHash)
      return { subscriptionId, txHash }
    } catch (err: any) {
      txManager?.setFailed(err.message || 'Failed to create subscription')
      throw err
    }
  }

  /**
   * Execute a scheduled recurring payment
   */
  public static async executePayment(
    subscriptionId: string,
    callerAddress: string,
    txManager?: TransactionManager
  ): Promise<{ txHash: string }> {
    txManager?.setPreparing()
    txManager?.setAwaitingWallet()

    try {
      const currentTime = Math.floor(Date.now() / 1000)
      const { txHash } = await recurringClient.submitRecurringTransaction('execute', {
        subscriptionId,
        callerAddress,
        currentTime,
      })
      txManager?.setSubmitted(txHash)

      await fetch(`${API_URL}/api/recurring/records/${subscriptionId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash, currentTime }),
      }).catch(() => null)

      txManager?.setConfirmed(txHash)
      return { txHash }
    } catch (err: any) {
      txManager?.setFailed(err.message || 'Failed to execute payment')
      throw err
    }
  }

  /**
   * Pause an active subscription
   */
  public static async pauseSubscription(
    subscriptionId: string,
    callerAddress: string,
    txManager?: TransactionManager
  ): Promise<{ txHash: string }> {
    txManager?.setPreparing()
    txManager?.setAwaitingWallet()

    try {
      const { txHash } = await recurringClient.submitRecurringTransaction('pause', {
        subscriptionId,
        callerAddress,
      })
      txManager?.setSubmitted(txHash)

      await fetch(`${API_URL}/api/recurring/records/${subscriptionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: SubscriptionStatus.PAUSED, txHash }),
      }).catch(() => null)

      txManager?.setConfirmed(txHash)
      return { txHash }
    } catch (err: any) {
      txManager?.setFailed(err.message || 'Failed to pause subscription')
      throw err
    }
  }

  /**
   * Resume a paused subscription
   */
  public static async resumeSubscription(
    subscriptionId: string,
    callerAddress: string,
    txManager?: TransactionManager
  ): Promise<{ txHash: string }> {
    txManager?.setPreparing()
    txManager?.setAwaitingWallet()

    try {
      const { txHash } = await recurringClient.submitRecurringTransaction('resume', {
        subscriptionId,
        callerAddress,
      })
      txManager?.setSubmitted(txHash)

      await fetch(`${API_URL}/api/recurring/records/${subscriptionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: SubscriptionStatus.ACTIVE, txHash }),
      }).catch(() => null)

      txManager?.setConfirmed(txHash)
      return { txHash }
    } catch (err: any) {
      txManager?.setFailed(err.message || 'Failed to resume subscription')
      throw err
    }
  }

  /**
   * Cancel a subscription
   */
  public static async cancelSubscription(
    subscriptionId: string,
    callerAddress: string,
    txManager?: TransactionManager
  ): Promise<{ txHash: string }> {
    txManager?.setPreparing()
    txManager?.setAwaitingWallet()

    try {
      const { txHash } = await recurringClient.submitRecurringTransaction('cancel', {
        subscriptionId,
        callerAddress,
      })
      txManager?.setSubmitted(txHash)

      await fetch(`${API_URL}/api/recurring/records/${subscriptionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: SubscriptionStatus.CANCELLED, txHash }),
      }).catch(() => null)

      txManager?.setConfirmed(txHash)
      return { txHash }
    } catch (err: any) {
      txManager?.setFailed(err.message || 'Failed to cancel subscription')
      throw err
    }
  }

  /**
   * Fetch all subscriptions for a given wallet address
   */
  public static async fetchSubscriptions(walletAddress: string): Promise<SubscriptionDetails[]> {
    try {
      const res = await fetch(`${API_URL}/api/recurring/records?walletAddress=${encodeURIComponent(walletAddress)}`)
      if (res.ok) {
        const records = await res.json()
        if (Array.isArray(records)) {
          return records.map((r) => ({
            id: r.id,
            payer: r.payer,
            recipient: r.recipient,
            amount: typeof r.amount === 'number' ? r.amount.toFixed(2) : String(r.amount),
            amountBaseUnits: BigInt(Math.round((parseFloat(r.amount) || 0) * 1_000_000)),
            frequencySeconds: r.frequencySeconds || 86400,
            frequencyLabel: secondsToFrequencyLabel(r.frequencySeconds || 86400),
            nextPaymentTime: r.nextPaymentTime || Date.now() / 1000 + 86400,
            endTime: r.endTime || Date.now() / 1000 + 86400 * 30,
            maxPayments: r.maxPayments || 0,
            paymentCount: r.paymentCount || 0,
            status: r.status,
            statusLabel: formatSubscriptionStatus(r.status),
            nextPaymentFormatted: new Date((r.nextPaymentTime || Date.now() / 1000 + 86400) * 1000).toLocaleString(),
            endTimeFormatted: new Date((r.endTime || Date.now() / 1000 + 86400 * 30) * 1000).toLocaleDateString(),
          }))
        }
      }
    } catch (err) {
      console.warn('[RecurringService] Failed to fetch subscriptions:', err)
    }

    return []
  }
}
