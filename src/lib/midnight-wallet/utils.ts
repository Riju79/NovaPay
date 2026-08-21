import { UnknownProvider } from './types'

export interface ExtractedAddresses {
  address: string
  shieldedAddress?: string
  unshieldedAddress?: string
  networkId?: string
}

// ─── Official 1AM DApp Connector API Types ────────────────────────────────────
// Source: @midnight-ntwrk/dapp-connector-api v4.0.1
// https://registry.npmjs.org/@midnight-ntwrk/dapp-connector-api/latest
//
// ConnectedAPI (= WalletConnectedAPI & HintUsage):
//   .getShieldedBalances()   => Promise<Record<TokenType, bigint>>
//   .getUnshieldedBalances() => Promise<Record<TokenType, bigint>>
//   .getDustBalance()        => Promise<{ cap: bigint; balance: bigint }>
//   .getShieldedAddresses()  => Promise<{ shieldedAddress: string; ... }>
//   .getUnshieldedAddress()  => Promise<{ unshieldedAddress: string }>
//   .getDustAddress()        => Promise<{ dustAddress: string }>
// ─────────────────────────────────────────────────────────────────────────────

type TokenType = string

export interface ConnectedAPI {
  getShieldedBalances(): Promise<Record<TokenType, bigint>>
  getUnshieldedBalances(): Promise<Record<TokenType, bigint>>
  getDustBalance(): Promise<{ cap: bigint; balance: bigint }>
  getShieldedAddresses(): Promise<{
    shieldedAddress: string
    shieldedCoinPublicKey?: string
    shieldedEncryptionPublicKey?: string
  }>
  getUnshieldedAddress(): Promise<{ unshieldedAddress: string } | string>
  getDustAddress?(): Promise<{ dustAddress: string } | string>
  makeTransfer?(
    desiredOutputs: Array<{
      kind: 'shielded' | 'unshielded'
      type: string
      value: bigint
      recipient: string
    }>,
    options?: { payFees?: boolean }
  ): Promise<{ tx: string }>
}

interface InitialAPI {
  rdns?: string
  name?: string
  icon?: string
  apiVersion?: string
  connect: (networkId: string) => Promise<ConnectedAPI>
}

/**
 * The number of base units per NIGHT/DUST display token.
 * Official Midnight denomination: 1 token = 1_000_000 base units (6 decimal places)
 */
const MIDNIGHT_BASE_UNITS = 1_000_000n

/**
 * Convert a bigint base-unit balance to a human-readable display string.
 */
function baseUnitsToDisplayString(baseUnits: bigint): string {
  if (baseUnits < 0n) baseUnits = 0n
  const whole = baseUnits / MIDNIGHT_BASE_UNITS
  const fraction = baseUnits % MIDNIGHT_BASE_UNITS
  const fracStr = fraction.toString().padStart(6, '0')
  const trimmed = fracStr.replace(/0+$/, '') || '0'
  return `${whole}.${trimmed}`
}

// ─── Cached ConnectedAPI session ─────────────────────────────────────────────
let cachedConnectedApi: ConnectedAPI | null = null
let cachedNetworkId: string | null = null

export function clearCachedConnectedApi() {
  cachedConnectedApi = null
  cachedNetworkId = null
}

/**
 * Get or re-use the official 1AM ConnectedAPI.
 */
export async function getConnectedAPI(
  rawProvider: UnknownProvider,
  networkId: string
): Promise<ConnectedAPI | null> {
  if (cachedConnectedApi && cachedNetworkId === networkId) {
    return cachedConnectedApi
  }

  const initialAPI = rawProvider as unknown as InitialAPI

  if (typeof initialAPI?.connect !== 'function') {
    console.warn('[MidnightWallet] 1AM provider does not expose .connect() method; available keys:', Object.keys(rawProvider || {}))
    return null
  }

  try {
    console.log(`[MidnightWallet] Calling 1AM InitialAPI.connect("${networkId}")`)
    const connectedApi = await initialAPI.connect(networkId)
    cachedConnectedApi = connectedApi
    cachedNetworkId = networkId
    console.log('[MidnightWallet] ConnectedAPI obtained; available keys:', Object.keys(connectedApi as any || {}))
    return connectedApi
  } catch (err) {
    console.warn('[MidnightWallet] 1AM InitialAPI.connect() failed:', err)
    return null
  }
}

// ─── Address extraction ───────────────────────────────────────────────────────

/**
 * Extract wallet addresses using official ConnectedAPI + resilient candidate scanner.
 */
export async function extractMidnightAddresses(
  enabledApi: unknown,
  rawProvider: UnknownProvider
): Promise<ExtractedAddresses> {
  const networkId = process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK ?? 'preview'

  console.log('[MidnightWallet] Extracting addresses...')

  let shieldedAddress: string | undefined
  let unshieldedAddress: string | undefined
  let primaryAddress: string | undefined
  let extractedNetworkId: string | undefined

  // 1. Try official ConnectedAPI methods
  const connectedApi = await getConnectedAPI(rawProvider, networkId)

  if (connectedApi) {
    try {
      if (typeof connectedApi.getShieldedAddresses === 'function') {
        const shieldedResult: any = await connectedApi.getShieldedAddresses()
        if (typeof shieldedResult === 'string') {
          shieldedAddress = shieldedResult
        } else if (shieldedResult && typeof shieldedResult === 'object') {
          shieldedAddress = shieldedResult.shieldedAddress || shieldedResult.address
        }
        console.log('[MidnightWallet] getShieldedAddresses() resolved:', shieldedAddress)
      }
    } catch (err) {
      console.warn('[MidnightWallet] getShieldedAddresses() warning:', err)
    }

    try {
      if (typeof connectedApi.getUnshieldedAddress === 'function') {
        const unshieldedResult: any = await connectedApi.getUnshieldedAddress()
        if (typeof unshieldedResult === 'string') {
          unshieldedAddress = unshieldedResult
        } else if (unshieldedResult && typeof unshieldedResult === 'object') {
          unshieldedAddress = unshieldedResult.unshieldedAddress || unshieldedResult.address
        }
        console.log('[MidnightWallet] getUnshieldedAddress() resolved:', unshieldedAddress)
      }
    } catch (err) {
      console.warn('[MidnightWallet] getUnshieldedAddress() warning:', err)
    }
  }

  // 2. Resilient fallback across all candidates (enabledApi, connectedApi, rawProvider)
  if (!unshieldedAddress && !shieldedAddress) {
    console.log('[MidnightWallet] Running deep candidate address scan')
    const candidates = [enabledApi, connectedApi, rawProvider].filter(Boolean) as Record<string, any>[]

    const methodNames = [
      'getUnshieldedAddress',
      'getShieldedAddresses',
      'getShieldedAddress',
      'getDustAddress',
      'getAccounts',
      'getAddress',
      'getAddresses',
      'state',
      'getState',
      'status',
    ]

    const isMidnightAddr = (str: unknown): str is string =>
      typeof str === 'string' &&
      str.trim().length > 0 &&
      !str.includes('http://') &&
      !str.includes('https://') &&
      !str.includes('contract') &&
      !str.includes('escrow')

    for (const cand of candidates) {
      if (!cand || (typeof cand !== 'object' && typeof cand !== 'function')) continue

      // Direct property check
      if (!unshieldedAddress && isMidnightAddr(cand.unshieldedAddress)) unshieldedAddress = cand.unshieldedAddress
      if (!shieldedAddress && isMidnightAddr(cand.shieldedAddress)) shieldedAddress = cand.shieldedAddress
      if (!primaryAddress && isMidnightAddr(cand.address)) primaryAddress = cand.address

      // Method invocations
      for (const m of methodNames) {
        if (typeof cand[m] === 'function') {
          try {
            const rawRes = await cand[m]()
            if (isMidnightAddr(rawRes)) {
              if (!primaryAddress) primaryAddress = rawRes
            } else if (Array.isArray(rawRes) && rawRes.length > 0 && isMidnightAddr(rawRes[0])) {
              if (!primaryAddress) primaryAddress = rawRes[0]
            } else if (rawRes && typeof rawRes === 'object') {
              const resObj = rawRes as Record<string, any>
              if (!unshieldedAddress && isMidnightAddr(resObj.unshieldedAddress)) unshieldedAddress = resObj.unshieldedAddress
              if (!shieldedAddress && isMidnightAddr(resObj.shieldedAddress)) shieldedAddress = resObj.shieldedAddress
              if (!primaryAddress && isMidnightAddr(resObj.address)) primaryAddress = resObj.address
            }
          } catch {
            // ignore method error
          }
        }
      }
    }
  }

  const finalAddress = unshieldedAddress || shieldedAddress || primaryAddress || ''

  if (finalAddress) {
    const lower = finalAddress.toLowerCase()
    if (lower.includes('preprod')) extractedNetworkId = 'preprod'
    else if (lower.includes('preview')) extractedNetworkId = 'preview'
    else if (lower.includes('mainnet')) extractedNetworkId = 'mainnet'
    else extractedNetworkId = networkId
  }

  console.log('[MidnightWallet] Final address extraction result:', {
    address: finalAddress,
    shieldedAddress,
    unshieldedAddress,
    networkId: extractedNetworkId,
  })

  return {
    address: finalAddress,
    shieldedAddress,
    unshieldedAddress,
    networkId: extractedNetworkId,
  }
}

// ─── Balance extraction ───────────────────────────────────────────────────────

export interface MidnightBalances {
  unshieldedTDust: string
  shieldedTDust: string
  tDust: string
  usdc: string
}

/**
 * Fetch live balances from the connected 1AM wallet using the OFFICIAL API.
 */
export async function extractMidnightBalances(
  _enabledApi: unknown,
  rawProvider: UnknownProvider
): Promise<MidnightBalances | null> {
  const networkId = process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK ?? 'preview'
  const tsStart = Date.now()

  console.log(`[MidnightWallet] fetchBalance start @ ${new Date(tsStart).toISOString()} | network: ${networkId}`)

  const connectedApi = await getConnectedAPI(rawProvider, networkId)

  if (!connectedApi) {
    console.warn('[MidnightWallet] fetchBalance: no ConnectedAPI available')
    return null
  }

  let unshieldedBaseUnits = 0n
  let shieldedBaseUnits = 0n

  // ── Unshielded Balances ───────────────────────────────────────────────────
  try {
    if (typeof connectedApi.getUnshieldedBalances === 'function') {
      const unshieldedRecord = await connectedApi.getUnshieldedBalances()
      console.log('[MidnightWallet] getUnshieldedBalances() raw:', unshieldedRecord)

      if (unshieldedRecord && typeof unshieldedRecord === 'object') {
        for (const [tokenType, rawVal] of Object.entries(unshieldedRecord)) {
          let val: bigint
          if (typeof rawVal === 'bigint') {
            val = rawVal
          } else if (typeof rawVal === 'number') {
            val = BigInt(Math.round(rawVal))
          } else if (typeof rawVal === 'string') {
            val = BigInt(rawVal)
          } else {
            continue
          }
          console.log(`[MidnightWallet] Unshielded token "${tokenType}": ${val}n base units`)
          unshieldedBaseUnits += val
        }
      }
    }
  } catch (err) {
    console.warn('[MidnightWallet] getUnshieldedBalances() failed:', err)
  }

  // ── Shielded Balances ─────────────────────────────────────────────────────
  try {
    if (typeof connectedApi.getShieldedBalances === 'function') {
      const shieldedRecord = await connectedApi.getShieldedBalances()
      console.log('[MidnightWallet] getShieldedBalances() raw:', shieldedRecord)

      if (shieldedRecord && typeof shieldedRecord === 'object') {
        for (const [tokenType, rawVal] of Object.entries(shieldedRecord)) {
          let val: bigint
          if (typeof rawVal === 'bigint') {
            val = rawVal
          } else if (typeof rawVal === 'number') {
            val = BigInt(Math.round(rawVal))
          } else if (typeof rawVal === 'string') {
            val = BigInt(rawVal)
          } else {
            continue
          }
          console.log(`[MidnightWallet] Shielded token "${tokenType}": ${val}n base units`)
          shieldedBaseUnits += val
        }
      }
    }
  } catch (err) {
    console.warn('[MidnightWallet] getShieldedBalances() failed:', err)
  }

  const unshieldedDisplay = baseUnitsToDisplayString(unshieldedBaseUnits)
  const shieldedDisplay = baseUnitsToDisplayString(shieldedBaseUnits)
  const totalDisplay = baseUnitsToDisplayString(unshieldedBaseUnits + shieldedBaseUnits)

  console.log(`[MidnightWallet] fetchBalance result:`, {
    unshieldedBaseUnits: unshieldedBaseUnits.toString() + 'n',
    shieldedBaseUnits: shieldedBaseUnits.toString() + 'n',
    unshieldedDisplay,
    shieldedDisplay,
    totalDisplay,
    elapsedMs: Date.now() - tsStart,
  })

  return {
    unshieldedTDust: unshieldedDisplay,
    shieldedTDust: shieldedDisplay,
    tDust: totalDisplay,
    usdc: '0.0',
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

  if ((target === 'preview' || target === 'previewnet') && (wallet === 'preview' || wallet === 'previewnet')) return true
  if ((target === 'preprod' || target === 'preprodnet') && (wallet === 'preprod' || wallet === 'preprodnet')) return true

  return false
}
