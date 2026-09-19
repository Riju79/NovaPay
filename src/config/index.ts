/**
 * NovaPay Frontend Centralized Configuration & Startup Validator
 * Target Network: MIDNIGHT PREVIEW
 *
 * Enforces strict network separation, schema validation, and anti-Mainnet protection.
 */

// ─── Network Anti-Mainnet Validation ──────────────────────────────────────────

const rawNetwork = (process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK || 'preview').toLowerCase().trim()

if (rawNetwork.includes('main') || rawNetwork === 'mainnet') {
  throw new Error(
    '[FATAL CONFIGURATION ERROR] Midnight Mainnet is strictly prohibited in NovaPay Preview builds! ' +
    `Attempted network: '${rawNetwork}'. Please set NEXT_PUBLIC_MIDNIGHT_NETWORK='preview'.`
  )
}

const rawRpcUrl = process.env.NEXT_PUBLIC_MIDNIGHT_RPC_URL || 'https://rpc.preview.midnight.network'
const rawIndexerUrl = process.env.NEXT_PUBLIC_MIDNIGHT_INDEXER_URL || 'https://indexer.preview.midnight.network/graphql'

if (rawRpcUrl.toLowerCase().includes('mainnet') || rawIndexerUrl.toLowerCase().includes('mainnet')) {
  throw new Error(
    '[FATAL CONFIGURATION ERROR] Mainnet endpoints detected in configuration! Preview endpoints required. ' +
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
  process.env.NEXT_PUBLIC_MIDNIGHT_ESCROW_CONTRACT_ADDRESS || ''

export const MIDNIGHT_RECURRING_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_MIDNIGHT_RECURRING_CONTRACT_ADDRESS || ''

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
  return `${baseUrl}/tx/${encodeURIComponent(rawHex)}`
}
