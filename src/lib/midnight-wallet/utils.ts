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
// The official API shape is:
//   window.midnight['1am']: InitialAPI
//     .connect(networkId: string) => Promise<ConnectedAPI>
//
//   ConnectedAPI (= WalletConnectedAPI & HintUsage):
//     .getShieldedBalances()   => Promise<Record<TokenType, bigint>>
//     .getUnshieldedBalances() => Promise<Record<TokenType, bigint>>
//     .getDustBalance()        => Promise<{ cap: bigint; balance: bigint }>
//     .getShieldedAddresses()  => Promise<{ shieldedAddress: string; ... }>
//     .getUnshieldedAddress()  => Promise<{ unshieldedAddress: string }>
//     .getDustAddress()        => Promise<{ dustAddress: string }>
//
// DENOMINATION:
//   - getShieldedBalances / getUnshieldedBalances return bigint values where
//     1 NIGHT token = 1_000_000 base units (6 decimal places)
//   - The 1AM UI shows "UNSHIELDED BALANCE: 5000.0" and the underlying
//     bigint from getUnshieldedBalances() is 5_000_000_000n (for 5000 NIGHT)
//   - getDustBalance returns bigint where 1 DUST = 1_000_000 base units
// ─────────────────────────────────────────────────────────────────────────────

type TokenType = string

interface ConnectedAPI {
  getShieldedBalances(): Promise<Record<TokenType, bigint>>
  getUnshieldedBalances(): Promise<Record<TokenType, bigint>>
  getDustBalance(): Promise<{ cap: bigint; balance: bigint }>
  getShieldedAddresses(): Promise<{
    shieldedAddress: string
    shieldedCoinPublicKey: string
    shieldedEncryptionPublicKey: string
  }>
  getUnshieldedAddress(): Promise<{ unshieldedAddress: string }>
  getDustAddress(): Promise<{ dustAddress: string }>
}

interface InitialAPI {
  rdns: string
  name: string
  icon: string
  apiVersion: string
  connect: (networkId: string) => Promise<ConnectedAPI>
}

/**
 * The number of base units per NIGHT/DUST display token.
 * Official Midnight denomination: 1 token = 1_000_000 base units (6 decimal places)
 */
const MIDNIGHT_BASE_UNITS = 1_000_000n

/**
 * Convert a bigint base-unit balance to a human-readable display string.
 * Preserves full precision using bigint arithmetic before formatting.
 */
function baseUnitsToDisplayString(baseUnits: bigint): string {
  if (baseUnits < 0n) baseUnits = 0n
  const whole = baseUnits / MIDNIGHT_BASE_UNITS
  const fraction = baseUnits % MIDNIGHT_BASE_UNITS
  // Pad fraction to 6 digits, then trim trailing zeros (but keep at least 1 decimal)
  const fracStr = fraction.toString().padStart(6, '0')
  const trimmed = fracStr.replace(/0+$/, '') || '0'
  return `${whole}.${trimmed}`
}

/**
 * Sum all bigint values in a Record<TokenType, bigint>.
 */
function sumTokenRecord(record: Record<TokenType, bigint>): bigint {
  let total = 0n
  for (const val of Object.values(record)) {
    if (typeof val === 'bigint') {
      total += val
    }
  }
  return total
}

// ─── Cached ConnectedAPI session ─────────────────────────────────────────────
// We cache the ConnectedAPI so we do not trigger a new authorization popup
// on every heartbeat refresh.
let cachedConnectedApi: ConnectedAPI | null = null
let cachedNetworkId: string | null = null

export function clearCachedConnectedApi() {
  cachedConnectedApi = null
  cachedNetworkId = null
}

/**
 * Get or re-use the official 1AM ConnectedAPI.
 * Calls InitialAPI.connect(networkId) exactly once per session.
 */
async function getConnectedAPI(
  rawProvider: UnknownProvider,
  networkId: string
): Promise<ConnectedAPI | null> {
  if (cachedConnectedApi && cachedNetworkId === networkId) {
    return cachedConnectedApi
  }

  const initialAPI = rawProvider as unknown as InitialAPI

  if (typeof initialAPI?.connect !== 'function') {
    console.warn('[MidnightWallet] 1AM provider does not expose .connect() method; available keys:', Object.keys(rawProvider))
    return null
  }

  try {
    console.log(`[MidnightWallet] Calling 1AM InitialAPI.connect("${networkId}")`)
    const connectedApi = await initialAPI.connect(networkId)
    cachedConnectedApi = connectedApi
    cachedNetworkId = networkId
    console.log('[MidnightWallet] ConnectedAPI obtained; available methods:', Object.keys(connectedApi as any))
    return connectedApi
  } catch (err) {
    console.warn('[MidnightWallet] 1AM InitialAPI.connect() failed:', err)
    return null
  }
}

// ─── Address extraction ───────────────────────────────────────────────────────

/**
 * Extract wallet addresses using the official ConnectedAPI methods.
 */
export async function extractMidnightAddresses(
  enabledApi: unknown,
  rawProvider: UnknownProvider
): Promise<ExtractedAddresses> {
  const networkId = process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK ?? 'preview'

  console.log('[MidnightWallet] Extracting addresses via official ConnectedAPI')

  // Try official API first
  const connectedApi = await getConnectedAPI(rawProvider, networkId)

  if (connectedApi) {
    let shieldedAddress: string | undefined
    let unshieldedAddress: string | undefined
    let extractedNetworkId: string | undefined

    try {
      const shieldedResult = await connectedApi.getShieldedAddresses()
      shieldedAddress = shieldedResult.shieldedAddress
      console.log('[MidnightWallet] getShieldedAddresses():', shieldedResult)
    } catch (err) {
      console.warn('[MidnightWallet] getShieldedAddresses() failed:', err)
    }

    try {
      const unshieldedResult = await connectedApi.getUnshieldedAddress()
      unshieldedAddress = unshieldedResult.unshieldedAddress
      console.log('[MidnightWallet] getUnshieldedAddress():', unshieldedResult)
    } catch (err) {
      console.warn('[MidnightWallet] getUnshieldedAddress() failed:', err)
    }

    // Infer networkId from address prefix
    const anyAddress = shieldedAddress || unshieldedAddress || ''
    if (anyAddress.toLowerCase().includes('preprod')) extractedNetworkId = 'preprod'
    else if (anyAddress.toLowerCase().includes('preview')) extractedNetworkId = 'preview'
    else if (anyAddress.toLowerCase().includes('mainnet')) extractedNetworkId = 'mainnet'
    else extractedNetworkId = networkId

    const finalAddress = unshieldedAddress || shieldedAddress || ''

    console.log('[MidnightWallet] Address extraction result:', {
      address: finalAddress,
      shieldedAddress,
      unshieldedAddress,
      networkId: extractedNetworkId,
    })

    if (finalAddress) {
      return { address: finalAddress, shieldedAddress, unshieldedAddress, networkId: extractedNetworkId }
    }
  }

  // Fallback: try legacy/undocumented approaches if official API did not produce an address
  console.warn('[MidnightWallet] Official ConnectedAPI address extraction failed; falling back to heuristic scan')
  return legacyExtractAddresses(enabledApi, rawProvider)
}

async function legacyExtractAddresses(
  enabledApi: unknown,
  rawProvider: UnknownProvider
): Promise<ExtractedAddresses> {
  const isValidStr = (v: unknown): v is string =>
    typeof v === 'string' && v.trim().length > 0 && !v.includes('http://') && !v.includes('https://')

  if (isValidStr(enabledApi)) return { address: (enabledApi as string).trim() }
  if (Array.isArray(enabledApi) && enabledApi.length > 0 && isValidStr(enabledApi[0]))
    return { address: enabledApi[0].trim() }

  const candidates: UnknownProvider[] = []
  if (enabledApi && (typeof enabledApi === 'object' || typeof enabledApi === 'function'))
    candidates.push(enabledApi as UnknownProvider)
  if (rawProvider) candidates.push(rawProvider)

  let shieldedAddress: string | undefined
  let unshieldedAddress: string | undefined
  let primaryAddress: string | undefined
  let extractedNetworkId: string | undefined

  for (const candidate of candidates) {
    if (!candidate) continue
    if (!shieldedAddress && isValidStr(candidate.shieldedAddress)) shieldedAddress = candidate.shieldedAddress.trim()
    if (!unshieldedAddress && isValidStr(candidate.unshieldedAddress)) unshieldedAddress = candidate.unshieldedAddress.trim()
    if (!primaryAddress && isValidStr(candidate.address)) primaryAddress = candidate.address.trim()
  }

  const finalAddress = unshieldedAddress || shieldedAddress || primaryAddress || ''
  if (!extractedNetworkId && finalAddress) {
    const lower = finalAddress.toLowerCase()
    if (lower.includes('preprod')) extractedNetworkId = 'preprod'
    else if (lower.includes('preview')) extractedNetworkId = 'preview'
    else if (lower.includes('mainnet')) extractedNetworkId = 'mainnet'
  }

  console.log('[MidnightWallet] Legacy address extraction result:', { finalAddress, shieldedAddress, unshieldedAddress, extractedNetworkId })
  return { address: finalAddress, shieldedAddress, unshieldedAddress, networkId: extractedNetworkId }
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
 *
 * Official methods used:
 *   - connectedApi.getUnshieldedBalances() => Record<TokenType, bigint>
 *   - connectedApi.getShieldedBalances()   => Record<TokenType, bigint>
 *
 * Denomination: 1 display token = 1_000_000 base units (bigint)
 *
 * The 1AM extension UI shows:
 *   "UNSHIELDED BALANCE: 5000.0" = getUnshieldedBalances() total = 5_000_000_000n base units
 *   "SHIELDED HOLDINGS: 0"       = getShieldedBalances() total = 0n base units
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
    const unshieldedRecord = await connectedApi.getUnshieldedBalances()
    console.log('[MidnightWallet] getUnshieldedBalances() raw:', unshieldedRecord)

    // Sum all tokens in the unshielded balance map (bigint values)
    for (const [tokenType, rawVal] of Object.entries(unshieldedRecord)) {
      // The API guarantees bigint. Guard against extensions returning number/string.
      let val: bigint
      if (typeof rawVal === 'bigint') {
        val = rawVal
      } else if (typeof rawVal === 'number') {
        console.warn(`[MidnightWallet] getUnshieldedBalances() token ${tokenType} returned JS number instead of bigint:`, rawVal)
        val = BigInt(Math.round(rawVal))
      } else if (typeof rawVal === 'string') {
        console.warn(`[MidnightWallet] getUnshieldedBalances() token ${tokenType} returned string instead of bigint:`, rawVal)
        val = BigInt(rawVal)
      } else {
        console.warn(`[MidnightWallet] getUnshieldedBalances() token ${tokenType} unexpected type:`, typeof rawVal, rawVal)
        continue
      }
      console.log(`[MidnightWallet] Unshielded token "${tokenType}": ${val}n base units`)
      unshieldedBaseUnits += val
    }
  } catch (err) {
    console.warn('[MidnightWallet] getUnshieldedBalances() failed:', err)
  }

  // ── Shielded Balances ─────────────────────────────────────────────────────
  try {
    const shieldedRecord = await connectedApi.getShieldedBalances()
    console.log('[MidnightWallet] getShieldedBalances() raw:', shieldedRecord)

    for (const [tokenType, rawVal] of Object.entries(shieldedRecord)) {
      let val: bigint
      if (typeof rawVal === 'bigint') {
        val = rawVal
      } else if (typeof rawVal === 'number') {
        console.warn(`[MidnightWallet] getShieldedBalances() token ${tokenType} returned JS number instead of bigint:`, rawVal)
        val = BigInt(Math.round(rawVal))
      } else if (typeof rawVal === 'string') {
        val = BigInt(rawVal)
      } else {
        console.warn(`[MidnightWallet] getShieldedBalances() token ${tokenType} unexpected type:`, typeof rawVal, rawVal)
        continue
      }
      console.log(`[MidnightWallet] Shielded token "${tokenType}": ${val}n base units`)
      shieldedBaseUnits += val
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
