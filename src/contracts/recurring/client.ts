/**
 * Low-Level Recurring Payment Contract Client for Midnight Network
 */

import { getRaw1AMProvider } from '@/lib/midnight-wallet/detect'
import { getConnectedAPI, clearCachedConnectedApi, execute1AMTransfer } from '@/lib/midnight-wallet/utils'
import { SubscriptionStatus, FrequencyType } from './types'
import { API_URL } from '@/config'

export function formatSubscriptionStatus(status: SubscriptionStatus): string {
  switch (status) {
    case SubscriptionStatus.CREATED:
      return 'Created'
    case SubscriptionStatus.ACTIVE:
      return 'Active'
    case SubscriptionStatus.PAUSED:
      return 'Paused'
    case SubscriptionStatus.CANCELLED:
      return 'Cancelled'
    case SubscriptionStatus.COMPLETED:
      return 'Completed'
    default:
      return 'Unknown'
  }
}

export function frequencyToSeconds(freq: FrequencyType): number {
  switch (freq) {
    case 'DAILY':
      return 86400
    case 'WEEKLY':
      return 604800
    case 'MONTHLY':
      return 2592000 // 30 days
    case 'YEARLY':
      return 31536000 // 365 days
    default:
      return 86400
  }
}

export function secondsToFrequencyLabel(secs: number): string {
  if (secs <= 86400) return 'Daily'
  if (secs <= 604800) return 'Weekly'
  if (secs <= 2592000) return 'Monthly'
  return 'Yearly'
}

export class RecurringContractClient {
  private networkId: string

  constructor(networkId = 'preview') {
    this.networkId = networkId
  }

  public async submitRecurringTransaction(opName: string, payload: any): Promise<{ txHash: string }> {
    if (!payload.recipientAddress) {
      throw new Error('Recipient address is required for recurring transaction.')
    }

    const raw1AM = getRaw1AMProvider()
    if (raw1AM) {
      const connectedApi = await getConnectedAPI(raw1AM, this.networkId)
      if (connectedApi && typeof connectedApi.makeTransfer === 'function') {
        try {
          console.log(`[RecurringClient] Attempting native wallet transfer for ${opName}...`)
          const transferRes = await execute1AMTransfer(
            connectedApi,
            payload.recipientAddress,
            BigInt(payload.amountBaseUnits || '1000000')
          )
          if (transferRes && transferRes.tx) {
            console.log(`[RecurringClient] 1AM makeTransfer submitted tx:`, transferRes.tx)
            return { txHash: transferRes.tx }
          }
        } catch (err: any) {
          console.warn(`[RecurringClient] 1AM transfer fallback to server endpoint:`, err)
          clearCachedConnectedApi()
          const errMsg = err?.message || String(err || '')
          if (errMsg.toLowerCase().includes('insufficient funds') || errMsg.toLowerCase().includes('insufficient')) {
            throw new Error('Insufficient wallet balance in your 1AM wallet to cover recurring transfer + fees.')
          }
          if (errMsg.toLowerCase().includes('disconnected') || errMsg.toLowerCase().includes('closed')) {
            throw new Error('1AM Wallet popup was closed or disconnected.')
          }
        }
      }
    }

    const res = await fetch(`${API_URL}/api/recurring/${opName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Transaction request failed' }))
      throw new Error(errData.error || `Recurring operation '${opName}' failed`)
    }

    const data = await res.json()
    if (!data.txHash) {
      throw new Error(`Recurring operation '${opName}' completed without valid transaction hash.`)
    }
    return { txHash: data.txHash }
  }
}

export const recurringClient = new RecurringContractClient()
