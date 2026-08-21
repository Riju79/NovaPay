/**
 * Low-Level Escrow Contract Client for Midnight Network
 */

import { getRaw1AMProvider } from '@/lib/midnight-wallet/detect'
import { getConnectedAPI, clearCachedConnectedApi } from '@/lib/midnight-wallet/utils'
import { EscrowStatus, EscrowDetails } from './types'
import { API_URL } from '@/config'

function hexToBytes32(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(32)
  for (let i = 0; i < Math.min(clean.length / 2, 32); i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16) || 0
  }
  return bytes
}

function stringToBytes32(str: string): Uint8Array {
  const encoder = new TextEncoder()
  const encoded = encoder.encode(str)
  const bytes = new Uint8Array(32)
  bytes.set(encoded.subarray(0, 32))
  return bytes
}

export function formatEscrowStatus(status: EscrowStatus): string {
  switch (status) {
    case EscrowStatus.CREATED:
      return 'Created (Unfunded)'
    case EscrowStatus.FUNDED:
      return 'Funded'
    case EscrowStatus.LOCKED:
      return 'Locked in Escrow'
    case EscrowStatus.RELEASED:
      return 'Funds Released'
    case EscrowStatus.REFUNDED:
      return 'Refunded to Payer'
    case EscrowStatus.CANCELLED:
      return 'Cancelled'
    case EscrowStatus.DISPUTED:
      return 'In Dispute'
    default:
      return 'Unknown'
  }
}

export class EscrowContractClient {
  private networkId: string

  constructor(networkId = 'preview') {
    this.networkId = networkId
  }

  /**
   * Submits a transaction via 1AM ConnectedAPI if connected, or via backend API.
   */
  public async submitEscrowTransaction(opName: string, payload: any): Promise<{ txHash: string }> {
    const raw1AM = getRaw1AMProvider()
    if (raw1AM) {
      const connectedApi = await getConnectedAPI(raw1AM, this.networkId)
      if (connectedApi && typeof connectedApi.makeTransfer === 'function') {
        try {
          console.log(`[EscrowClient] Attempting native wallet transfer for ${opName}...`)
          const transferRes = await connectedApi.makeTransfer(
            [
              {
                kind: 'unshielded',
                type: '0x00',
                value: BigInt(payload.amountBaseUnits || '1000000'),
                recipient: payload.payeeAddress || payload.payerAddress || 'mn_addr_preview1_escrow',
              },
            ],
            { payFees: true }
          )
          if (transferRes && transferRes.tx) {
            console.log(`[EscrowClient] 1AM makeTransfer submitted tx:`, transferRes.tx)
            return { txHash: transferRes.tx }
          }
        } catch (err: any) {
          console.warn(`[EscrowClient] 1AM transfer fallback to server endpoint:`, err)
          clearCachedConnectedApi()
          const errMsg = err?.message || String(err || '')
          if (errMsg.toLowerCase().includes('disconnected') || errMsg.toLowerCase().includes('closed')) {
            throw new Error('1AM Wallet popup was closed or disconnected.')
          }
        }
      }
    }

    // Server-side database recording + contract state update endpoint fallback
    const res = await fetch(`${API_URL}/api/escrow/${opName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Transaction request failed' }))
      throw new Error(errData.error || `Escrow operation '${opName}' failed`)
    }

    const data = await res.json()
    return { txHash: data.txHash || `mn_tx_escrow_${Date.now()}` }
  }
}

export const escrowClient = new EscrowContractClient()
