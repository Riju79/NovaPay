/**
 * NovaPay Client-Side Midnight Blockchain Service
 * Target Network: MIDNIGHT PREVIEW
 *
 * Connects client UI and 1AM Wallet to real Midnight Preview blockchain.
 */

import { MIDNIGHT_NETWORK } from './midnight-wallet/config'
import { getRaw1AMProvider } from './midnight-wallet/detect'
import { getConnectedAPI, execute1AMTransfer, extractMidnightBalances } from './midnight-wallet/utils'
import { API_URL } from '../config'
import { getAuthHeaders } from './auth'

export interface ClientNetworkInfo {
  network: string
  chain: string
  rpcUrl: string
  isPreview: boolean
  isPreprod?: boolean
}

export interface ClientTransactionResult {
  txHash: string
  status: 'SUBMITTED' | 'CONFIRMED' | 'FAILED'
  error?: string
}

export class MidnightBlockchainService {
  private static rpcUrl = process.env.NEXT_PUBLIC_MIDNIGHT_RPC_URL || 'https://rpc.preview.midnight.network'
  private static targetNetwork = 'preview'

  /**
   * Capability 1: getNetwork
   */
  public static async getNetwork(): Promise<ClientNetworkInfo> {
    try {
      const res = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'system_chain',
          params: [],
          id: Date.now(),
        }),
      })
      const data = await res.json()
      const chain = data?.result || 'Midnight Preview'
      const isPreview = chain.toLowerCase().includes('preview')
      return {
        network: 'preview',
        chain,
        rpcUrl: this.rpcUrl,
        isPreview,
        isPreprod: false,
      }
    } catch {
      return {
        network: 'preview',
        chain: 'Midnight Preview',
        rpcUrl: this.rpcUrl,
        isPreview: true,
        isPreprod: false,
      }
    }
  }

  /**
   * Capability 2: getWalletState
   */
  public static async getWalletState(address: string): Promise<{ address: string; network: string; isValid: boolean }> {
    const clean = (address || '').trim()
    const isValid = clean.length >= 10 && (clean.startsWith('mn_') || /^[0-9a-fA-F]{64}$/.test(clean))
    return {
      address: clean,
      network: 'preview',
      isValid,
    }
  }

  /**
   * Capability 3: getBalance
   */
  public static async getBalance(address: string): Promise<{ tDust: string; usdc: string }> {
    const raw1AM = getRaw1AMProvider()
    if (raw1AM) {
      const live = await extractMidnightBalances(raw1AM, raw1AM)
      if (live) {
        return {
          tDust: live.tDust || live.unshieldedTDust || '0.00',
          usdc: live.usdc || '0.00',
        }
      }
    }
    return { tDust: '0.00', usdc: '0.00' }
  }

  /**
   * Capability 4: buildTransaction
   */
  public static buildTransaction(params: {
    sender: string
    recipient: string
    amountTDust: string
    purpose?: string
  }) {
    const amountNum = parseFloat(params.amountTDust)
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('Transfer amount must be greater than zero.')
    }
    const baseUnits = BigInt(Math.round(amountNum * 1_000_000))

    return {
      sender: params.sender.trim(),
      recipient: params.recipient.trim(),
      amount: amountNum.toFixed(6),
      baseUnits,
      asset: 'tDUST',
      purpose: params.purpose || 'Transfer',
      network: 'preview',
    }
  }

  /**
   * Capability 5 & 6: requestSignature & submitTransaction
   * Invokes the official 1AM ConnectedAPI makeTransfer method to broadcast
   * on-chain transfer to Midnight Preview.
   */
  public static async executeTransfer(params: {
    recipient: string
    amountTDust: string
  }): Promise<ClientTransactionResult> {
    const raw1AM = getRaw1AMProvider()
    if (!raw1AM) {
      throw new Error('1AM Wallet extension not detected.')
    }

    const connectedApi = await getConnectedAPI(raw1AM, 'preview')
    if (!connectedApi || typeof connectedApi.makeTransfer !== 'function') {
      throw new Error('1AM Wallet did not expose makeTransfer capability on Midnight.')
    }

    const amountNum = parseFloat(params.amountTDust)
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('Transfer amount must be greater than zero.')
    }

    const baseUnits = BigInt(Math.round(amountNum * 1_000_000))
    console.log(`[MidnightBlockchainService] Executing 1AM makeTransfer: ${baseUnits} base units to ${params.recipient}`)

    const result = await execute1AMTransfer(connectedApi, params.recipient, baseUnits)

    if (!result.tx || result.tx.length < 10) {
      throw new Error('1AM makeTransfer did not return a valid transaction hash.')
    }

    return {
      txHash: result.tx,
      status: 'SUBMITTED',
    }
  }

  /**
   * Capability 7: getTransaction
   */
  public static async getTransaction(txHash: string): Promise<any> {
    const res = await fetch(`${API_URL}/api/send-money/transaction/${encodeURIComponent(txHash)}`, {
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error('Failed to fetch transaction details.')
    return res.json()
  }

  /**
   * Capability 8: waitForConfirmation
   */
  public static async waitForConfirmation(txHash: string, timeoutMs: number = 25000): Promise<boolean> {
    const startTime = Date.now()
    while (Date.now() - startTime < timeoutMs) {
      try {
        const tx = await this.getTransaction(txHash)
        if (tx && tx.status === 'CONFIRMED' || tx.status === 'SUCCESS') {
          return true
        }
      } catch {
        // Poll
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
    return false
  }

  /**
   * Capability 9: verifyTransaction
   */
  public static verifyTransaction(txHash: string): boolean {
    if (!txHash) return false
    const clean = txHash.trim().replace(/^0x/i, '')
    return /^[0-9a-fA-F]{64}$/.test(clean)
  }

  /**
   * Capability 10: verifyAssetTransfer
   * Submits transfer details to backend for independent cryptographic verification.
   */
  public static async verifyAssetTransfer(params: {
    txHash: string
    expectedSender: string
    expectedRecipient: string
    expectedAmount: string
  }): Promise<{ verified: boolean; error?: string }> {
    const res = await fetch(`${API_URL}/api/send-money/confirm-transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        txHash: params.txHash,
        sender: params.expectedSender,
        recipient: params.expectedRecipient,
        amount: params.expectedAmount,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) {
      return {
        verified: false,
        error: data.error || 'Server rejected transaction verification.',
      }
    }

    return { verified: true }
  }

  /**
   * Capability 11: verifyContract
   */
  public static async verifyContract(contractAddress: string): Promise<boolean> {
    if (!contractAddress) return false
    try {
      const res = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'midnight_contractState',
          params: [contractAddress.replace(/^0x/i, '')],
          id: Date.now(),
        }),
      })
      const data = await res.json()
      return data && data.result !== undefined
    } catch {
      return false
    }
  }
}
