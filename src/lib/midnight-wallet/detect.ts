/**
 * Browser Extension Detection for Lace and 1AM Midnight Wallets
 * Dynamic, resilient detection supporting all browser extension injection variants.
 */

import { WalletDetectionResult, MidnightWalletProviderId, UnknownProvider } from './types'

export function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

/**
 * Dynamic resolution for Lace provider across window.midnight, window.cardano, and window
 */
export function getRawLaceProvider(): UnknownProvider | undefined {
  if (!isBrowser()) return undefined

  // 1. Direct window.midnight properties (Midnight Lace Edition)
  if (window.midnight?.lace) return window.midnight.lace as UnknownProvider
  if (window.midnight?.Lace) return window.midnight.Lace as UnknownProvider
  if (window.midnight?.mnLace) return window.midnight.mnLace as UnknownProvider
  if (window.midnight?.['lace-midnight']) return window.midnight['lace-midnight'] as UnknownProvider

  // 2. Direct window.cardano properties (Standard Lace Extension)
  if (window.cardano?.lace) return window.cardano.lace as UnknownProvider
  if (window.cardano?.Lace) return window.cardano.Lace as UnknownProvider
  if (window.cardano?.laceMidnight) return window.cardano.laceMidnight as UnknownProvider

  // 3. Top-level window properties
  if (window.lace) return window.lace as UnknownProvider
  if (window.Lace) return window.Lace as UnknownProvider

  // 4. Dynamic scan of window.midnight keys for "lace"
  if (window.midnight && typeof window.midnight === 'object') {
    for (const key of Object.keys(window.midnight)) {
      if (key.toLowerCase().includes('lace')) {
        return window.midnight[key] as UnknownProvider
      }
    }
  }

  // 5. Dynamic scan of window.cardano keys for "lace"
  if (window.cardano && typeof window.cardano === 'object') {
    for (const key of Object.keys(window.cardano)) {
      if (key.toLowerCase().includes('lace')) {
        return window.cardano[key] as UnknownProvider
      }
    }
  }

  return undefined
}

/**
 * Dynamic resolution for 1AM Midnight provider
 */
export function getRaw1AMProvider(): UnknownProvider | undefined {
  if (!isBrowser()) return undefined

  // 1. Direct window.midnight properties
  if (window.midnight) {
    if (window.midnight['1am']) return window.midnight['1am'] as UnknownProvider
    if (window.midnight['1AM']) return window.midnight['1AM'] as UnknownProvider
    if (window.midnight.oneam) return window.midnight.oneam as UnknownProvider
    if (window.midnight.oneAM) return window.midnight.oneAM as UnknownProvider
    if (window.midnight['1am-wallet']) return window.midnight['1am-wallet'] as UnknownProvider

    if (typeof window.midnight === 'object') {
      for (const key of Object.keys(window.midnight)) {
        const lowerKey = key.toLowerCase()
        if (lowerKey.includes('1am') || lowerKey.includes('oneam')) {
          return window.midnight[key] as UnknownProvider
        }
      }
    }
  }

  // 2. Top-level window properties fallback for 1AM
  if (window.oneam) return window.oneam as UnknownProvider
  if (window.oneAM) return window.oneAM as UnknownProvider

  return undefined
}

/**
 * Detect Lace Wallet (Midnight Edition)
 */
export async function detectLace(): Promise<WalletDetectionResult> {
  if (!isBrowser()) {
    return {
      provider: 'lace',
      name: 'Lace Midnight',
      isInstalled: false,
    }
  }

  const laceObj = getRawLaceProvider()
  const isInstalled = Boolean(laceObj)

  return {
    provider: 'lace',
    name: 'Lace Midnight',
    isInstalled,
    apiVersion: laceObj?.apiVersion || '1.0.0',
    icon: laceObj?.icon,
  }
}

/**
 * Detect 1AM Wallet (Midnight Edition)
 */
export async function detect1AM(): Promise<WalletDetectionResult> {
  if (!isBrowser()) {
    return {
      provider: '1am',
      name: '1AM Wallet',
      isInstalled: false,
    }
  }

  const oneamObj = getRaw1AMProvider()
  const isInstalled = Boolean(oneamObj)

  return {
    provider: '1am',
    name: '1AM Wallet',
    isInstalled,
    apiVersion: oneamObj?.apiVersion || '1.0.0',
    icon: oneamObj?.icon,
  }
}

/**
 * Detect all supported Midnight wallets
 */
export async function detectAllWallets(): Promise<
  Record<MidnightWalletProviderId, WalletDetectionResult>
> {
  const [lace, oneam] = await Promise.all([detectLace(), detect1AM()])
  return {
    lace,
    '1am': oneam,
  }
}
