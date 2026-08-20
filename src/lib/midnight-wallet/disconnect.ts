/**
 * Disconnect Engine & Session Cleanup for 1AM Midnight Wallet
 */

import { MidnightWalletSession } from './types'
import { oneamAdapter } from './oneam'

export const STORAGE_SESSION_KEY = 'midnight_wallet_provider'

export async function disconnectWallet(
  session: MidnightWalletSession | null
): Promise<void> {
  if (!session) return

  try {
    await oneamAdapter.disconnect()
  } catch (err) {
    console.warn('[MidnightWallet] Disconnect notice:', err)
  }

  // Clear session persistence
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_SESSION_KEY)
    } catch {
      // ignore storage errors
    }
  }
}

