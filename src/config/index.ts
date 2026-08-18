export const API_URL = process.env.NEXT_PUBLIC_API_URL || 
  (process.env.NODE_ENV === 'development' 
    ? 'http://localhost:5000' 
    : 'https://novapay-w4zv.onrender.com')

// ─── Midnight Preprod Network Configurations (Staging Environment) ───────────

export const MIDNIGHT_RPC_URL =
  process.env.NEXT_PUBLIC_MIDNIGHT_RPC_URL || 'https://rpc.preprod.midnight.network'

export const MIDNIGHT_INDEXER_URL =
  process.env.NEXT_PUBLIC_MIDNIGHT_INDEXER_URL || 'https://indexer.preprod.midnight.network/graphql'

export const MIDNIGHT_PROOF_SERVER_URL =
  process.env.MIDNIGHT_PROOF_SERVER_URL || 'http://localhost:6300'
