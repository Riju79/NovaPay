/**
 * Shared Utilities for Midnight Wallet Address Extraction & Network Validation
 */

import { UnknownProvider } from './types'

export interface ExtractedAddresses {
  address: string
  shieldedAddress?: string
  unshieldedAddress?: string
  networkId?: string
}

/**
 * Deep, resilient extractor for Midnight wallet addresses
 */
export async function extractMidnightAddresses(
  enabledApi: unknown,
  rawProvider: UnknownProvider
): Promise<ExtractedAddresses> {
  const candidates: UnknownProvider[] = []

  // Collect potential target objects
  if (enabledApi && typeof enabledApi === 'object') {
    candidates.push(enabledApi as UnknownProvider)
  }
  if (rawProvider && typeof rawProvider === 'object') {
    candidates.push(rawProvider)
  }

  let stateObj: UnknownProvider | null = null

  // 1. Try calling state() or fetchState() or getAccounts()
  for (const obj of candidates) {
    if (typeof obj.state === 'function') {
      try {
        const res = await obj.state()
        if (res && typeof res === 'object') {
          stateObj = res as UnknownProvider
          break
        }
      } catch (err) {
        console.warn('[MidnightWallet] Error invoking obj.state():', err)
      }
    }

    if (typeof obj.fetchState === 'function') {
      try {
        const res = await obj.fetchState()
        if (res && typeof res === 'object') {
          stateObj = res as UnknownProvider
          break
        }
      } catch (err) {
        console.warn('[MidnightWallet] Error invoking obj.fetchState():', err)
      }
    }
  }

  const searchPool = stateObj
    ? [stateObj, ...candidates]
    : candidates

  let shieldedAddress: string | undefined
  let unshieldedAddress: string | undefined
  let primaryAddress: string | undefined
  let extractedNetworkId: string | undefined

  const isValidStr = (v: unknown): v is string =>
    typeof v === 'string' && v.trim().length > 0

  for (const item of searchPool) {
    if (!shieldedAddress && isValidStr(item.shieldedAddress)) {
      shieldedAddress = item.shieldedAddress.trim()
    }
    if (!unshieldedAddress && isValidStr(item.unshieldedAddress)) {
      unshieldedAddress = item.unshieldedAddress.trim()
    }
    if (!primaryAddress && isValidStr(item.address)) {
      primaryAddress = item.address.trim()
    }
    if (!primaryAddress && isValidStr(item.coinPublicKey)) {
      primaryAddress = item.coinPublicKey.trim()
    }
    if (!primaryAddress && isValidStr(item.publicKey)) {
      primaryAddress = item.publicKey.trim()
    }

    if (!extractedNetworkId) {
      if (isValidStr(item.networkId) || typeof item.networkId === 'number') {
        extractedNetworkId = String(item.networkId)
      } else if (item.network && typeof item.network === 'object') {
        const netObj = item.network as UnknownProvider
        if (isValidStr(netObj.id) || isValidStr(netObj.name)) {
          extractedNetworkId = String(netObj.id || netObj.name)
        }
      }
    }

    // Try Midnight specific method calls
    if (!shieldedAddress && typeof item.getShieldedAddress === 'function') {
      try {
        const res = await item.getShieldedAddress()
        if (isValidStr(res)) shieldedAddress = res.trim()
      } catch {
        // ignore
      }
    }

    if (!unshieldedAddress && typeof item.getUnshieldedAddress === 'function') {
      try {
        const res = await item.getUnshieldedAddress()
        if (isValidStr(res)) unshieldedAddress = res.trim()
      } catch {
        // ignore
      }
    }

    if (!primaryAddress && typeof item.getAddress === 'function') {
      try {
        const res = await item.getAddress()
        if (isValidStr(res)) primaryAddress = res.trim()
      } catch {
        // ignore
      }
    }

    if (!primaryAddress && typeof item.getAccounts === 'function') {
      try {
        const accounts = await item.getAccounts()
        if (Array.isArray(accounts) && accounts.length > 0 && isValidStr(accounts[0])) {
          primaryAddress = accounts[0].trim()
        }
      } catch {
        // ignore
      }
    }

    // Try CIP-30 / Cardano method calls (getUsedAddresses, getUnusedAddresses, getChangeAddress)
    if (!primaryAddress && typeof (item as any).getUsedAddresses === 'function') {
      try {
        const addrs = await (item as any).getUsedAddresses()
        if (Array.isArray(addrs) && addrs.length > 0 && isValidStr(addrs[0])) {
          primaryAddress = addrs[0].trim()
        }
      } catch {
        // ignore
      }
    }

    if (!primaryAddress && typeof (item as any).getUnusedAddresses === 'function') {
      try {
        const addrs = await (item as any).getUnusedAddresses()
        if (Array.isArray(addrs) && addrs.length > 0 && isValidStr(addrs[0])) {
          primaryAddress = addrs[0].trim()
        }
      } catch {
        // ignore
      }
    }

    if (!primaryAddress && typeof (item as any).getChangeAddress === 'function') {
      try {
        const addr = await (item as any).getChangeAddress()
        if (isValidStr(addr)) primaryAddress = addr.trim()
      } catch {
        // ignore
      }
    }
  }

  // Direct array check if enabledApi is an array of accounts
  if (!primaryAddress && Array.isArray(enabledApi) && enabledApi.length > 0 && isValidStr(enabledApi[0])) {
    primaryAddress = enabledApi[0].trim()
  }

  // Resolve final primary address preference: shielded > unshielded > primary
  const finalAddress = shieldedAddress || unshieldedAddress || primaryAddress

  return {
    address: finalAddress || '',
    shieldedAddress,
    unshieldedAddress,
    networkId: extractedNetworkId,
  }
}

/**
 * Compare target network against wallet network flexibly
 */
export function isNetworkCompatible(targetNetworkId: string, walletNetworkId?: string): boolean {
  if (!targetNetworkId || !walletNetworkId) return true

  const target = targetNetworkId.toLowerCase().trim()
  const wallet = walletNetworkId.toLowerCase().trim()

  if (target === wallet) return true
  if (wallet.includes(target) || target.includes(wallet)) return true

  // Standard aliases (e.g. preview vs previewnet)
  if ((target === 'preview' || target === 'previewnet') && (wallet === 'preview' || wallet === 'previewnet')) {
    return true
  }
  if ((target === 'preprod' || target === 'preprodnet') && (wallet === 'preprod' || wallet === 'preprodnet')) {
    return true
  }

  return false
}
