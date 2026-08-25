export const API_URL = process.env.NEXT_PUBLIC_API_URL || 
  (process.env.NODE_ENV === 'development' 
    ? 'http://localhost:5000' 
    : 'https://novapay-w4zv.onrender.com')

export const MIDNIGHT_NETWORK = process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK || 'preview'

export const MIDNIGHT_RPC_URL =
  process.env.NEXT_PUBLIC_MIDNIGHT_RPC_URL || `https://rpc.${MIDNIGHT_NETWORK}.midnight.network`

export const MIDNIGHT_INDEXER_URL =
  process.env.NEXT_PUBLIC_MIDNIGHT_INDEXER_URL || `https://indexer.${MIDNIGHT_NETWORK}.midnight.network/graphql`

export const MIDNIGHT_PROOF_SERVER_URL =
  process.env.MIDNIGHT_PROOF_SERVER_URL || 'http://localhost:6300'

export const MIDNIGHT_EXPLORER_URL =
  process.env.NEXT_PUBLIC_MIDNIGHT_EXPLORER_URL || 'https://explorer.1am.xyz'

export function getExplorerTxUrl(txHash: string | null | undefined): string {
  if (!txHash) return 'https://explorer.1am.xyz'
  let cleanHash = txHash.trim()
  if (!cleanHash) return 'https://explorer.1am.xyz'
  if (cleanHash.startsWith('http://') || cleanHash.startsWith('https://')) {
    return cleanHash
  }
  if (cleanHash.startsWith('mn_addr_') || cleanHash.startsWith('mn_unshielded') || cleanHash.startsWith('mn_shielded')) {
    return `https://explorer.1am.xyz/address/${encodeURIComponent(cleanHash)}`
  }
  // 1AM Explorer requires raw hex without 0x prefix or extra query params
  const rawHex = cleanHash.replace(/^0x/i, '')
  const baseUrl = MIDNIGHT_EXPLORER_URL.replace(/\/+$/, '')
  return `${baseUrl}/tx/${encodeURIComponent(rawHex)}`
}

