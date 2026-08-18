/**
 * Midnight Wallet Types
 * Normalized interface and structures for Lace and 1AM Midnight wallet integration.
 */

export type MidnightWalletProviderId = 'lace' | '1am'

export type WalletConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface MidnightWalletSession {
  provider: MidnightWalletProviderId
  address: string
  shieldedAddress?: string
  unshieldedAddress?: string
  networkId: string
  connected: boolean
  connectedAt: number
}

export interface WalletDetectionResult {
  provider: MidnightWalletProviderId
  name: string
  isInstalled: boolean
  isLocked?: boolean
  icon?: string
  apiVersion?: string
}

export interface MidnightWalletAdapter {
  providerId: MidnightWalletProviderId
  name: string
  detect(): Promise<WalletDetectionResult>
  connect(targetNetworkId: string): Promise<MidnightWalletSession>
  disconnect(): Promise<void>
}

export type UnknownProvider = Record<string, unknown> & {
  enable?: () => Promise<unknown>
  connect?: () => Promise<unknown>
  requestAccounts?: () => Promise<unknown>
  request?: (args: { method: string; params?: unknown }) => Promise<unknown>
  state?: () => Promise<unknown>
  getAccounts?: () => Promise<string[]>
  getAddress?: () => Promise<string>
  getShieldedAddress?: () => Promise<string>
  getUnshieldedAddress?: () => Promise<string>
  getNetworkId?: () => Promise<string | number>
  apiVersion?: string
  icon?: string
  address?: string
  shieldedAddress?: string
  unshieldedAddress?: string
  networkId?: string | number
}

// Global browser window extension typings for Midnight & Cardano wallets
declare global {
  interface Window {
    midnight?: {
      lace?: UnknownProvider
      Lace?: UnknownProvider
      mnLace?: UnknownProvider
      '1am'?: UnknownProvider
      '1AM'?: UnknownProvider
      oneam?: UnknownProvider
      oneAM?: UnknownProvider
      [key: string]: unknown
    }
    cardano?: {
      lace?: UnknownProvider
      Lace?: UnknownProvider
      laceMidnight?: UnknownProvider
      [key: string]: unknown
    }
    lace?: UnknownProvider
    Lace?: UnknownProvider
    oneam?: UnknownProvider
    oneAM?: UnknownProvider
  }
}
