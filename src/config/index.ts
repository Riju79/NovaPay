/**
 * NovaPay Frontend Centralized Configuration & Startup Validator
 * Target Network: MIDNIGHT PREPROD
 *
 * Enforces strict network separation, schema validation, and anti-Mainnet protection.
 */

// ─── Network Anti-Mainnet Validation ──────────────────────────────────────────

const rawNetwork = (process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK || 'preprod').toLowerCase().trim()

if (rawNetwork.includes('main') || rawNetwork === 'mainnet') {
  throw new Error(
    '[FATAL CONFIGURATION ERROR] Midnight Mainnet is strictly prohibited in NovaPay builds! ' +
    `Attempted network: '${rawNetwork}'. Please set NEXT_PUBLIC_MIDNIGHT_NETWORK='preprod'.`
  )
}

const rawRpcUrl = process.env.NEXT_PUBLIC_MIDNIGHT_RPC_URL || 'https://rpc.preprod.midnight.network'
const rawIndexerUrl = process.env.NEXT_PUBLIC_MIDNIGHT_INDEXER_URL || 'https://indexer.preprod.midnight.network/api/v4/graphql'

if (rawRpcUrl.toLowerCase().includes('mainnet') || rawIndexerUrl.toLowerCase().includes('mainnet')) {
  throw new Error(
    '[FATAL CONFIGURATION ERROR] Mainnet endpoints detected in configuration! Preprod endpoints required. ' +
    `RPC: ${rawRpcUrl}`
  )
}

// ─── Exported Configuration Constants ─────────────────────────────────────────

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 
  (process.env.NODE_ENV === 'development' 
    ? 'http://localhost:5000' 
    : 'https://novapay-w4zv.onrender.com')

export const MIDNIGHT_NETWORK = rawNetwork

export const MIDNIGHT_RPC_URL = rawRpcUrl

export const MIDNIGHT_INDEXER_URL = rawIndexerUrl

export const MIDNIGHT_PROOF_SERVER_URL =
  process.env.NEXT_PUBLIC_MIDNIGHT_PROOF_SERVER_URL ||
  process.env.MIDNIGHT_PROOF_SERVER_URL ||
  'http://localhost:6300'

export const MIDNIGHT_EXPLORER_URL =
  process.env.NEXT_PUBLIC_MIDNIGHT_EXPLORER_URL || 'https://explorer.1am.xyz'

export const MIDNIGHT_PACKAGE_ID =
  process.env.NEXT_PUBLIC_MIDNIGHT_PACKAGE_ID || ''

export const MIDNIGHT_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS || ''

export const MIDNIGHT_ASSET_ID =
  process.env.NEXT_PUBLIC_MIDNIGHT_ASSET_ID || 'tDUST'

export const MIDNIGHT_ESCROW_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_MIDNIGHT_ESCROW_CONTRACT_ADDRESS ||
  'a8239962710fb4bd1c9c1c5a88582bf51588b8fca678591db53f70600dc64ed2'

export const MIDNIGHT_RECURRING_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_MIDNIGHT_RECURRING_CONTRACT_ADDRESS ||
  '4eb12594c2ec128791af83d82aa54742009710aec55373de2106cf8781e34fa2'

// ─── Explorer Deep Link Helper ────────────────────────────────────────────────

export function getExplorerTxUrl(txHash: string | null | undefined): string {
  if (!txHash) return MIDNIGHT_EXPLORER_URL
  const cleanHash = txHash.trim()
  if (!cleanHash) return MIDNIGHT_EXPLORER_URL
  if (cleanHash.startsWith('http://') || cleanHash.startsWith('https://')) {
    return cleanHash
  }
  if (
    cleanHash.startsWith('mn_addr_') ||
    cleanHash.startsWith('mn_unshielded') ||
    cleanHash.startsWith('mn_shielded')
  ) {
    return `${MIDNIGHT_EXPLORER_URL}/address/${encodeURIComponent(cleanHash)}`
  }

  // 1AM Explorer requires raw hex without 0x prefix
  const rawHex = cleanHash.replace(/^0x/i, '')
  const baseUrl = MIDNIGHT_EXPLORER_URL.replace(/\/+$/, '')

  // Route Compact contract addresses to /contract/ instead of /tx/ so Explorer doesn't report "No transaction"
  if (
    rawHex.toLowerCase() === 'a8239962710fb4bd1c9c1c5a88582bf51588b8fca678591db53f70600dc64ed2' ||
    rawHex.toLowerCase() === '4eb12594c2ec128791af83d82aa54742009710aec55373de2106cf8781e34fa2' ||
    rawHex === MIDNIGHT_ESCROW_CONTRACT_ADDRESS ||
    rawHex === MIDNIGHT_RECURRING_CONTRACT_ADDRESS
  ) {
    return `${baseUrl}/contract/${encodeURIComponent(rawHex)}`
  }

  // If a mock or internal label like tx_escrow_... is passed, route to the Escrow contract on 1AM explorer
  if (rawHex.startsWith('tx_escrow_') || rawHex.startsWith('tx_recurring_')) {
    return `${baseUrl}/contract/${encodeURIComponent(MIDNIGHT_ESCROW_CONTRACT_ADDRESS)}`
  }

  return `${baseUrl}/tx/${encodeURIComponent(rawHex)}`
}
