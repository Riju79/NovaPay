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

export function setCachedConnectedApi(connectedApi: ConnectedAPI | null, networkId: string | null = null) {
  cachedConnectedApi = connectedApi
  cachedNetworkId = networkId
}

export function clearCachedConnectedApi() {
  setCachedConnectedApi(null, null)
}

/**
 * Get or re-use the official 1AM ConnectedAPI.
 */
export async function getConnectedAPI(
  rawProvider: UnknownProvider,
  networkId: string
): Promise<ConnectedAPI | null> {
  if (cachedConnectedApi && (cachedNetworkId === networkId || !cachedNetworkId)) {
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
    setCachedConnectedApi(connectedApi, networkId)
    console.log('[MidnightWallet] ConnectedAPI obtained; available keys:', Object.keys(connectedApi as any || {}))
    return connectedApi
  } catch (err) {
    console.warn('[MidnightWallet] 1AM InitialAPI.connect() failed:', err)
    return null
  }
}

/**
 * Executes a transfer with the 1AM ConnectedAPI, automatically resolving
 * the exact native token type key and holding type (unshielded vs shielded).
 */
export async function execute1AMTransfer(
  connectedApi: ConnectedAPI,
  recipient: string,
  amountBaseUnits: bigint
): Promise<{ tx: string }> {
  let tokenType = '0000000000000000000000000000000000000000000000000000000000000000'
  let kind: 'unshielded' | 'shielded' = 'unshielded'

  try {
    const unshieldedMap = (await connectedApi.getUnshieldedBalances().catch(() => ({}))) || {}
    const unshieldedEntries = Object.entries(unshieldedMap)

    let totalUnshielded = 0n
    for (const [key, val] of unshieldedEntries) {
      const v = typeof val === 'bigint' ? val : BigInt(String(val || 0))
      if (v > 0n) {
        tokenType = key
        totalUnshielded += v
      }
    }

    if (totalUnshielded < amountBaseUnits) {
      const shieldedMap = (await connectedApi.getShieldedBalances().catch(() => ({}))) || {}
      const shieldedEntries = Object.entries(shieldedMap)
      let totalShielded = 0n
      for (const [key, val] of shieldedEntries) {
        const v = typeof val === 'bigint' ? val : BigInt(String(val || 0))
        if (v > 0n) {
          tokenType = key
          totalShielded += v
        }
      }
      if (totalShielded >= amountBaseUnits) {
        kind = 'shielded'
      }
    }
  } catch (err) {
    console.warn('[MidnightWallet] Token type resolution warning:', err)
  }

  const rawRes = await connectedApi.makeTransfer!(
    [
      {
        kind,
        type: tokenType,
        value: amountBaseUnits,
        recipient,
      },
    ],
    { payFees: true }
  )

  const unwrappedRes = await unwrapValueOrObservable(rawRes)
  console.log('[TRANSFER] 1AM makeTransfer raw response:', unwrappedRes)

  const is64HexHash = (val: any): string | undefined => {
    if (typeof val !== 'string') return undefined
    const clean = val.trim().replace(/^0x/i, '')
    if (/^[0-9a-fA-F]{64}$/.test(clean) && !clean.startsWith('0006') && !clean.startsWith('0000')) {
      return clean
    }
    return undefined
  }

  const normalizeResponse = (res: any): { tx: string } => {
    if (!res) return { tx: '' }

    if (typeof res === 'string') {
      const canonicalStr = is64HexHash(res)
      if (canonicalStr) {
        console.log('[MIDNIGHT TRANSFER] CANONICAL 64-CHAR TX HASH FROM STRING:', canonicalStr)
        return { tx: canonicalStr }
      }
    }

    if (typeof res === 'object') {
      console.log('[MIDNIGHT TRANSFER] RAW 1AM RESPONSE OBJECT:', res)

      // Support Midnight Ledger v8 TransactionId extraction via tx.identifiers()
      let identifierFromFunc: string | undefined = undefined
      if (typeof res.identifiers === 'function') {
        try {
          const ids = res.identifiers()
          if (Array.isArray(ids) && ids.length > 0) {
            identifierFromFunc = is64HexHash(ids[0])
          }
        } catch {}
      } else if (Array.isArray(res.identifiers) && res.identifiers.length > 0) {
        identifierFromFunc = is64HexHash(res.identifiers[0])
      }

      if (!identifierFromFunc && res.tx && typeof res.tx === 'object') {
        if (typeof res.tx.identifiers === 'function') {
          try {
            const ids = res.tx.identifiers()
            if (Array.isArray(ids) && ids.length > 0) {
              identifierFromFunc = is64HexHash(ids[0])
            }
          } catch {}
        } else if (Array.isArray(res.tx.identifiers) && res.tx.identifiers.length > 0) {
          identifierFromFunc = is64HexHash(res.tx.identifiers[0])
        }
      }

      const txHash =
        identifierFromFunc ||
        is64HexHash(res.txId) ||
        is64HexHash(res.txHash) ||
        is64HexHash(res.transactionHash) ||
        is64HexHash(res.hash) ||
        is64HexHash(res.id) ||
        is64HexHash(res.identifier) ||
        is64HexHash(res.transactionId) ||
        is64HexHash(res.transaction?.txHash) ||
        is64HexHash(res.transaction?.hash) ||
        is64HexHash(res.transaction?.id) ||
        is64HexHash(res.transaction?.txId) ||
        is64HexHash(res.data?.txHash) ||
        is64HexHash(res.data?.hash) ||
        is64HexHash(res.data?.txId) ||
        is64HexHash(res.tx) ||
        ''

      if (txHash) {
        console.log('[MIDNIGHT TRANSFER] EXTRACTED CANONICAL 64-CHAR TX HASH:', txHash)
        return { tx: txHash }
      }
    }

    if (typeof res === 'string' && res.trim().length > 5) {
      console.log('[MIDNIGHT TRANSFER] FALLBACK STR TX HASH:', res.trim())
      return { tx: res.trim() }
    }

    return { tx: '' }
  }

  return normalizeResponse(unwrappedRes)
}

// ─── Address parsing helper ──────────────────────────────────────────

export async function unwrapValueOrObservable(val: any): Promise<any> {
  if (!val) return val
  if (typeof val.then === 'function') {
    try {
      val = await val
    } catch {
      return undefined
    }
  }
  if (!val) return val
  if (typeof val.getValue === 'function') {
    try {
      val = val.getValue()
    } catch {}
  } else if (typeof val.subscribe === 'function') {
    try {
      val = await new Promise((resolve) => {
        let lastVal: any = undefined
        let resolved = false

        const isCanonical = (item: any): boolean => {
          if (typeof item === 'string') {
            const clean = item.trim().replace(/^0x/i, '')
            return /^[0-9a-fA-F]{64}$/.test(clean) && !clean.startsWith('0006') && !clean.startsWith('0000')
          }
          if (item && typeof item === 'object') {
            return !!(
              (item.txId && /^[0-9a-fA-F]{64}$/.test(item.txId.replace(/^0x/i, ''))) ||
              (item.txHash && /^[0-9a-fA-F]{64}$/.test(item.txHash.replace(/^0x/i, ''))) ||
              (item.hash && /^[0-9a-fA-F]{64}$/.test(item.hash.replace(/^0x/i, ''))) ||
              (item.id && /^[0-9a-fA-F]{64}$/.test(item.id.replace(/^0x/i, '')))
            )
          }
          return false
        }

        const sub = val.subscribe({
          next: (v: any) => {
            if (v !== undefined && v !== null) {
              lastVal = v
              if (isCanonical(v) && !resolved) {
                resolved = true
                resolve(v)
                if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe()
              }
            }
          },
          error: () => {
            if (!resolved) {
              resolved = true
              resolve(lastVal)
            }
          },
          complete: () => {
            if (!resolved) {
              resolved = true
              resolve(lastVal)
            }
          }
        })

        setTimeout(() => {
          if (!resolved) {
            resolved = true
            resolve(lastVal)
          }
        }, 5000)
      })
    } catch {}
  }
  return val
}

const isMidnightAddrStr = (str: unknown): str is string =>
  typeof str === 'string' &&
  str.trim().length > 0 &&
  !str.includes('http://') &&
  !str.includes('https://') &&
  !str.includes('contract') &&
  !str.includes('escrow')

function parseAddressFromAnyResult(res: any): { shielded?: string; unshielded?: string; primary?: string } {
  if (!res) return {}

  const extractAddrStr = (val: any): string | undefined => {
    if (typeof val === 'string' && isMidnightAddrStr(val)) return val.trim()
    if (val && typeof val === 'object') {
      if (typeof val.unshieldedAddress === 'string' && isMidnightAddrStr(val.unshieldedAddress)) return val.unshieldedAddress.trim()
      if (typeof val.shieldedAddress === 'string' && isMidnightAddrStr(val.shieldedAddress)) return val.shieldedAddress.trim()
      if (typeof val.address === 'string' && isMidnightAddrStr(val.address)) return val.address.trim()
      if (typeof val.value === 'string' && isMidnightAddrStr(val.value)) return val.value.trim()
      if (typeof val.key === 'string' && isMidnightAddrStr(val.key)) return val.key.trim()
      if (typeof val.toHex === 'function') {
        try {
          const hex = val.toHex()
          if (typeof hex === 'string' && isMidnightAddrStr(hex)) return hex.trim()
        } catch {}
      }
      if (typeof val.toString === 'function') {
        try {
          const str = val.toString()
          if (typeof str === 'string' && isMidnightAddrStr(str) && str !== '[object Object]') return str.trim()
        } catch {}
      }
    }
    return undefined
  }

  // 1. Direct string result
  if (typeof res === 'string' && isMidnightAddrStr(res)) {
    const trimmed = res.trim()
    const lower = trimmed.toLowerCase()
    if (lower.startsWith('mn_shielded') || lower.includes('shielded')) {
      return { shielded: trimmed, primary: trimmed }
    } else if (lower.startsWith('mn_unshielded') || lower.includes('unshielded')) {
      return { unshielded: trimmed, primary: trimmed }
    }
    return { primary: trimmed }
  }

  // 2. Array result
  if (Array.isArray(res) && res.length > 0) {
    let shielded: string | undefined
    let unshielded: string | undefined
    let primary: string | undefined

    for (const item of res) {
      const parsed = parseAddressFromAnyResult(item)
      if (parsed.shielded && !shielded) shielded = parsed.shielded
      if (parsed.unshielded && !unshielded) unshielded = parsed.unshielded
      if (parsed.primary && !primary) primary = parsed.primary
    }
    return { shielded, unshielded, primary: primary || unshielded || shielded }
  }

  // 3. Object result
  if (typeof res === 'object') {
    const unshielded =
      extractAddrStr(res.unshieldedAddress) ||
      extractAddrStr(res.unshieldedAddresses?.[0]) ||
      extractAddrStr(res.unshielded) ||
      extractAddrStr(res.unshieldedPk)

    const shielded =
      extractAddrStr(res.shieldedAddress) ||
      extractAddrStr(res.shieldedAddresses?.[0]) ||
      extractAddrStr(res.shielded) ||
      extractAddrStr(res.shieldedCoinPublicKey) ||
      extractAddrStr(res.shieldedPk)

    const dust =
      extractAddrStr(res.dustAddress) ||
      extractAddrStr(res.dustAddresses?.[0]) ||
      extractAddrStr(res.dust)

    const primary =
      unshielded ||
      extractAddrStr(res.address) ||
      extractAddrStr(res.addresses?.[0]) ||
      extractAddrStr(res.account) ||
      extractAddrStr(res.accounts?.[0]) ||
      shielded ||
      dust

    return { shielded, unshielded, primary }
  }

  return {}
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

  // Cache enabledApi if it provides ConnectedAPI methods
  if (
    enabledApi &&
    typeof enabledApi === 'object' &&
    (typeof (enabledApi as any).getUnshieldedAddress === 'function' ||
      typeof (enabledApi as any).getShieldedAddresses === 'function' ||
      typeof (enabledApi as any).getShieldedAddress === 'function' ||
      typeof (enabledApi as any).getUnshieldedBalances === 'function')
  ) {
    setCachedConnectedApi(enabledApi as ConnectedAPI, networkId)
  }

  // 1. Prefer existing enabledApi, cached API, or call getConnectedAPI as fallback
  const connectedApi =
    (enabledApi as ConnectedAPI) ||
    cachedConnectedApi ||
    (await getConnectedAPI(rawProvider, networkId))

  if (connectedApi) {
    // 1a. Try getUnshieldedAddress / getUnshieldedAddresses FIRST
    try {
      const getUnshieldedFn = connectedApi.getUnshieldedAddress || (connectedApi as any).getUnshieldedAddresses
      if (typeof getUnshieldedFn === 'function') {
        const rawRes = await getUnshieldedFn.call(connectedApi)
        const unshieldedResult: any = await unwrapValueOrObservable(rawRes)
        console.log('[1AM] getUnshieldedAddress raw result:', unshieldedResult)
        const parsed = parseAddressFromAnyResult(unshieldedResult)
        if (parsed.unshielded) unshieldedAddress = parsed.unshielded
        if (parsed.primary) {
          if (!unshieldedAddress) unshieldedAddress = parsed.primary
          if (!primaryAddress) primaryAddress = parsed.primary
        }
      }
    } catch (err) {
      console.warn('[MidnightWallet] getUnshieldedAddress() error:', err)
    }

    // 1b. Try getShieldedAddresses / getShieldedAddress
    try {
      const getShieldedFn = connectedApi.getShieldedAddresses || (connectedApi as any).getShieldedAddress
      if (typeof getShieldedFn === 'function') {
        const rawRes = await getShieldedFn.call(connectedApi)
        const shieldedResult: any = await unwrapValueOrObservable(rawRes)
        console.log('[1AM] getShieldedAddresses raw result:', shieldedResult)
        const parsed = parseAddressFromAnyResult(shieldedResult)
        if (parsed.shielded) shieldedAddress = parsed.shielded
        if (parsed.primary && !primaryAddress) primaryAddress = parsed.primary
      }
    } catch (err) {
      console.warn('[MidnightWallet] getShieldedAddresses() error:', err)
    }

    // 1c. Try getDustAddress / getDustAddresses
    try {
      const getDustFn = (connectedApi as any).getDustAddress || (connectedApi as any).getDustAddresses
      if (typeof getDustFn === 'function') {
        const rawRes = await getDustFn.call(connectedApi)
        const dustResult: any = await unwrapValueOrObservable(rawRes)
        console.log('[MidnightWallet] getDustAddress() raw result:', dustResult)
        const parsed = parseAddressFromAnyResult(dustResult)
        if (parsed.primary && !primaryAddress) primaryAddress = parsed.primary
      }
    } catch (err) {
      console.warn('[MidnightWallet] getDustAddress() error:', err)
    }

    // 1d. Try state() / status()
    try {
      const stateFn = (connectedApi as any).state || (connectedApi as any).getState || (connectedApi as any).status
      if (typeof stateFn === 'function') {
        const rawRes = await stateFn.call(connectedApi)
        const stateRes: any = await unwrapValueOrObservable(rawRes)
        console.log('[MidnightWallet] connectedApi.state() raw result:', stateRes)
        const parsed = parseAddressFromAnyResult(stateRes)
        if (parsed.unshielded && !unshieldedAddress) unshieldedAddress = parsed.unshielded
        if (parsed.shielded && !shieldedAddress) shieldedAddress = parsed.shielded
        if (parsed.primary && !primaryAddress) primaryAddress = parsed.primary
      }
    } catch (err) {
      console.warn('[MidnightWallet] connectedApi.state() error:', err)
    }
  }

  // 2. Resilient fallback across all candidates (enabledApi, connectedApi, rawProvider)
  if (!unshieldedAddress && !shieldedAddress && !primaryAddress) {
    console.log('[MidnightWallet] Running deep candidate address scan')
    const candidates = [enabledApi, connectedApi, rawProvider].filter(Boolean) as Record<string, any>[]

    const methodNames = [
      'getUnshieldedAddress',
      'getUnshieldedAddresses',
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

    for (const cand of candidates) {
      if (!cand || (typeof cand !== 'object' && typeof cand !== 'function')) continue

      // Direct property check
      const directParsed = parseAddressFromAnyResult(cand)
      if (directParsed.unshielded && !unshieldedAddress) unshieldedAddress = directParsed.unshielded
      if (directParsed.shielded && !shieldedAddress) shieldedAddress = directParsed.shielded
      if (directParsed.primary && !primaryAddress) primaryAddress = directParsed.primary

      // Check common property objects like state, account, selectedAccount, activeAccount
      const subObjs = [cand.state, cand.account, cand.selectedAccount, cand.activeAccount, cand.accounts?.[0]]
      for (const sub of subObjs) {
        if (sub && typeof sub === 'object') {
          const unwrappedSub = await unwrapValueOrObservable(sub)
          const subParsed = parseAddressFromAnyResult(unwrappedSub)
          if (subParsed.unshielded && !unshieldedAddress) unshieldedAddress = subParsed.unshielded
          if (subParsed.shielded && !shieldedAddress) shieldedAddress = subParsed.shielded
          if (subParsed.primary && !primaryAddress) primaryAddress = subParsed.primary
        }
      }

      // Method invocations preserving function binding
      for (const m of methodNames) {
        if (typeof cand[m] === 'function') {
          try {
            const rawRes = await cand[m].call(cand)
            const unwrappedRes = await unwrapValueOrObservable(rawRes)
            const parsed = parseAddressFromAnyResult(unwrappedRes)
            if (parsed.unshielded && !unshieldedAddress) unshieldedAddress = parsed.unshielded
            if (parsed.shielded && !shieldedAddress) shieldedAddress = parsed.shielded
            if (parsed.primary && !primaryAddress) primaryAddress = parsed.primary
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
  enabledApi: unknown,
  rawProvider: UnknownProvider
): Promise<MidnightBalances | null> {
  const networkId = process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK ?? 'preview'
  const tsStart = Date.now()

  console.log(`[MidnightWallet] fetchBalance start @ ${new Date(tsStart).toISOString()} | network: ${networkId}`)

  const connectedApi =
    (enabledApi && typeof (enabledApi as any).getUnshieldedBalances === 'function'
      ? (enabledApi as ConnectedAPI)
      : null) ||
    cachedConnectedApi ||
    (await getConnectedAPI(rawProvider, networkId))

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
