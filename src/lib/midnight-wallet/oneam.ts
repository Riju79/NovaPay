/**
 * 1AM Wallet (Midnight Edition) Adapter
 *
 * Uses the official @midnight-ntwrk/dapp-connector-api v4.0.1 API:
 *   window.midnight['1am'] : InitialAPI
 *     .connect(networkId: string) => Promise<ConnectedAPI>
 *
 * The ConnectedAPI is cached in utils.ts and reused by extractMidnightBalances().
 */

import { MidnightWalletAdapter, MidnightWalletSession, WalletDetectionResult } from './types'
import { MidnightWalletError } from './errors'
import { detect1AM, getRaw1AMProvider, isBrowser } from './detect'
import { CONNECTION_TIMEOUT_MS } from './config'
import { extractMidnightAddresses, isNetworkCompatible, clearCachedConnectedApi } from './utils'

export class OneAMMidnightAdapter implements MidnightWalletAdapter {
  public readonly providerId = '1am' as const
  public readonly name = '1AM Wallet'

  public async detect(): Promise<WalletDetectionResult> {
    return detect1AM()
  }

  public async connect(targetNetworkId: string): Promise<MidnightWalletSession> {
    if (!isBrowser()) {
      throw new MidnightWalletError(
        'WALLET_NOT_SUPPORTED',
        'Wallet connection can only be initiated in a browser environment.'
      )
    }

    console.log('[MidnightWallet] Detecting 1AM')
    const raw1AM = getRaw1AMProvider()
    if (!raw1AM) {
      console.warn('[MidnightWallet] 1AM not detected in window.midnight or window.oneam')
      throw new MidnightWalletError(
        'WALLET_NOT_INSTALLED',
        '1AM Wallet extension was not detected in your browser. Please ensure the 1AM extension is installed and active.'
      )
    }

    console.log('[MidnightWallet] 1AM detected. apiVersion:', raw1AM.apiVersion)
    console.log('[MidnightWallet] Calling InitialAPI.connect("' + targetNetworkId + '") — triggers 1AM authorization popup')

    // Clear any previously cached ConnectedAPI to force fresh connection
    clearCachedConnectedApi()

    let enabledApi: unknown

    try {
      // Official 1AM API: InitialAPI.connect(networkId) triggers the authorization popup
      // and returns a ConnectedAPI on approval, or throws on rejection.
      if (typeof (raw1AM as any).connect === 'function') {
        const connectPromise = (raw1AM as any).connect(targetNetworkId)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new MidnightWalletError('CONNECTION_TIMEOUT')),
            CONNECTION_TIMEOUT_MS
          )
        )
        enabledApi = await Promise.race([connectPromise, timeoutPromise])
        console.log('[MidnightWallet] connect() returned ConnectedAPI')
      } else {
        // Legacy fallback for older versions that exposed enable() or requestAccounts()
        console.warn('[MidnightWallet] .connect() not found on 1AM provider. Trying legacy methods.')
        if (typeof (raw1AM as any).enable === 'function') {
          enabledApi = await (raw1AM as any).enable()
        } else if (typeof (raw1AM as any).requestAccounts === 'function') {
          enabledApi = await (raw1AM as any).requestAccounts()
        } else {
          throw new MidnightWalletError(
            'PROVIDER_ERROR',
            '1AM Wallet extension does not expose .connect(), .enable(), or .requestAccounts().'
          )
        }
      }
    } catch (err: unknown) {
      if (err instanceof MidnightWalletError) throw err

      const errObj = err as { message?: string; code?: number }
      const errMsg = errObj?.message || String(err)
      const lowerMsg = errMsg.toLowerCase()

      if (
        lowerMsg.includes('reject') ||
        lowerMsg.includes('user denied') ||
        lowerMsg.includes('permissionrejected') ||
        errObj?.code === 4001
      ) {
        console.warn('[MidnightWallet] User rejected connection')
        throw new MidnightWalletError(
          'CONNECTION_REJECTED',
          'User rejected the 1AM connection request.',
          err
        )
      }

      if (
        lowerMsg.includes('no wallet available') ||
        lowerMsg.includes('create or restore') ||
        lowerMsg.includes('locked') ||
        lowerMsg.includes('uninitialized') ||
        lowerMsg.includes('no active account') ||
        lowerMsg.includes('no account')
      ) {
        console.warn('[MidnightWallet] 1AM wallet is locked or uninitialized:', errMsg)
        throw new MidnightWalletError(
          'WALLET_LOCKED',
          'Your 1AM wallet extension is not initialized or is currently locked. Please open the 1AM extension in your browser, create/unlock your wallet, and try again.',
          err
        )
      }

      console.error('[MidnightWallet] 1AM connection error:', err)
      throw new MidnightWalletError('PROVIDER_ERROR', `1AM connection failed: ${errMsg}`, err)
    }

    console.log('[MidnightWallet] Authorization successful. Extracting addresses.')

    // Extract addresses using official ConnectedAPI methods (getShieldedAddresses, getUnshieldedAddress)
    const extracted = await extractMidnightAddresses(enabledApi, raw1AM)

    if (!extracted.address) {
      console.error('[MidnightWallet] Failed to extract address from 1AM ConnectedAPI')
      throw new MidnightWalletError(
        'ADDRESS_UNAVAILABLE',
        '1AM extension authorized successfully, but no active Midnight address was returned. Please ensure your 1AM wallet is unlocked and has an active account initialized.'
      )
    }

    console.log('[MidnightWallet] Address extracted:', extracted.address)

    // Network verification
    const walletNetwork = extracted.networkId || targetNetworkId
    if (!isNetworkCompatible(targetNetworkId, walletNetwork)) {
      console.warn(`[MidnightWallet] Network mismatch: expected ${targetNetworkId}, got ${walletNetwork}`)
      throw new MidnightWalletError(
        'WRONG_NETWORK',
        `1AM Wallet is connected to network '${walletNetwork}', but application target is '${targetNetworkId}'. Please switch your 1AM wallet network.`
      )
    }

    console.log('[MidnightWallet] Network verified:', walletNetwork)
    console.log('[MidnightWallet] Session established')

    return {
      provider: '1am',
      address: extracted.address,
      shieldedAddress: extracted.shieldedAddress,
      unshieldedAddress: extracted.unshieldedAddress,
      networkId: targetNetworkId,
      connected: true,
      connectedAt: Date.now(),
    }
  }

  public async disconnect(): Promise<void> {
    console.log('[MidnightWallet] Disconnecting 1AM session')
    clearCachedConnectedApi()
  }
}

export const oneamAdapter = new OneAMMidnightAdapter()
