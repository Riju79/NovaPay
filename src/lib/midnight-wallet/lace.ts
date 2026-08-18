/**
 * Lace Wallet Adapter
 * Connects to Lace extension via window.midnight or window.cardano namespace.
 */

import { MidnightWalletAdapter, MidnightWalletSession, WalletDetectionResult, UnknownProvider } from './types'
import { MidnightWalletError } from './errors'
import { detectLace, getRawLaceProvider, isBrowser } from './detect'
import { CONNECTION_TIMEOUT_MS } from './config'
import { extractMidnightAddresses, isNetworkCompatible } from './utils'

export class LaceMidnightAdapter implements MidnightWalletAdapter {
  public readonly providerId = 'lace' as const
  public readonly name = 'Lace Midnight'

  public async detect(): Promise<WalletDetectionResult> {
    return detectLace()
  }

  public async connect(targetNetworkId: string): Promise<MidnightWalletSession> {
    if (!isBrowser()) {
      throw new MidnightWalletError(
        'WALLET_NOT_SUPPORTED',
        'Wallet connection can only be initiated in a browser environment.'
      )
    }

    console.log('[MidnightWallet] Detecting Lace Extension')
    const rawLace = getRawLaceProvider()
    if (!rawLace) {
      console.warn('[MidnightWallet] Lace provider not found in window')
      throw new MidnightWalletError(
        'WALLET_NOT_INSTALLED',
        'Lace extension was not detected in your browser window. Please ensure the Lace extension is enabled in your browser.'
      )
    }

    console.log('[MidnightWallet] Lace provider detected')
    console.log('[MidnightWallet] Requesting authorization from Lace')

    const authorizeLace = async (): Promise<unknown> => {
      const targetLace = rawLace as UnknownProvider

      if (typeof targetLace.enable === 'function') {
        return targetLace.enable()
      }
      if (typeof targetLace.connect === 'function') {
        return targetLace.connect()
      }
      if (typeof targetLace.requestAccounts === 'function') {
        return targetLace.requestAccounts()
      }
      if (typeof targetLace.request === 'function') {
        try {
          return await targetLace.request({ method: 'midnight_requestAccounts' })
        } catch {
          return await targetLace.request({ method: 'connect' })
        }
      }

      if (
        typeof targetLace.state === 'function' ||
        typeof targetLace.getAccounts === 'function' ||
        typeof targetLace.getAddress === 'function' ||
        typeof targetLace.getShieldedAddress === 'function' ||
        targetLace.address ||
        targetLace.shieldedAddress
      ) {
        return targetLace
      }

      throw new MidnightWalletError(
        'PROVIDER_ERROR',
        'Lace extension object does not expose a supported connection method (enable, connect, requestAccounts, request).'
      )
    }

    let enabledApi: unknown
    try {
      const authPromise = authorizeLace()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new MidnightWalletError('CONNECTION_TIMEOUT')),
          CONNECTION_TIMEOUT_MS
        )
      )

      enabledApi = await Promise.race([authPromise, timeoutPromise])
    } catch (err: unknown) {
      if (err instanceof MidnightWalletError) {
        throw err
      }

      const errObj = err as { message?: string; code?: number }
      const errMsg = errObj?.message || String(err)
      const lowerMsg = errMsg.toLowerCase()

      if (
        lowerMsg.includes('reject') ||
        lowerMsg.includes('user denied') ||
        errObj?.code === 4001
      ) {
        console.warn('[MidnightWallet] User rejected connection')
        throw new MidnightWalletError(
          'CONNECTION_REJECTED',
          'User rejected the Lace connection request in the extension popup.',
          err
        )
      }

      if (
        lowerMsg.includes('no cardano wallet available') ||
        lowerMsg.includes('create or restore') ||
        lowerMsg.includes('locked') ||
        lowerMsg.includes('uninitialized') ||
        lowerMsg.includes('no active account') ||
        lowerMsg.includes('no account')
      ) {
        console.warn('[MidnightWallet] Lace wallet is locked or uninitialized:', errMsg)
        throw new MidnightWalletError(
          'WALLET_LOCKED',
          'Lace extension is installed, but it is currently locked or has no active wallet account. Please click the Lace extension icon in your browser toolbar to unlock or initialize your wallet, then click Connect again.',
          err
        )
      }

      console.error('[MidnightWallet] Lace connection error:', err)
      throw new MidnightWalletError('PROVIDER_ERROR', `Lace connection failed: ${errMsg}`, err)
    }

    console.log('[MidnightWallet] Authorization successful')
    console.log('[MidnightWallet] Raw wallet response received')

    // Deep extract address details
    const extracted = await extractMidnightAddresses(enabledApi, rawLace)

    if (!extracted.address) {
      console.error('[MidnightWallet] Failed to extract address')
      throw new MidnightWalletError(
        'ADDRESS_UNAVAILABLE',
        'Lace extension authorized successfully but did not return a valid address. Please ensure your Lace wallet is unlocked and an account is selected.'
      )
    }

    console.log('[MidnightWallet] Address extracted:', extracted.address)

    // Network verification
    const walletNetwork = extracted.networkId || targetNetworkId
    if (!isNetworkCompatible(targetNetworkId, walletNetwork)) {
      console.warn(`[MidnightWallet] Network mismatch: expected ${targetNetworkId}, got ${walletNetwork}`)
      throw new MidnightWalletError(
        'WRONG_NETWORK',
        `Lace is connected to network '${walletNetwork}', but application target is '${targetNetworkId}'. Please switch your Lace wallet network.`
      )
    }

    console.log('[MidnightWallet] Network verified')
    console.log('[MidnightWallet] Session established')

    return {
      provider: 'lace',
      address: extracted.address,
      shieldedAddress: extracted.shieldedAddress,
      unshieldedAddress: extracted.unshieldedAddress,
      networkId: targetNetworkId,
      connected: true,
      connectedAt: Date.now(),
    }
  }

  public async disconnect(): Promise<void> {
    console.log('[MidnightWallet] Disconnecting Lace session')
  }
}

export const laceAdapter = new LaceMidnightAdapter()
