/**
 * Browser Extension Detection for 1AM Midnight Wallet
 */

import { WalletDetectionResult, MidnightWalletProviderId, UnknownProvider } from './types'

export function isBrowser(): boolean {
  return typeof window !== 'undefined'
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
 * Detect 1AM wallet
 */
export async function detectAllWallets(): Promise<
  Record<MidnightWalletProviderId, WalletDetectionResult>
> {
  const oneam = await detect1AM()
  return {
    '1am': oneam,
  }
}

