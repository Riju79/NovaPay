/**
 * Centralized Midnight Network Configuration
 */

export interface MidnightNetworkConfig {
  id: string
  name: string
  rpcUrl: string
  indexerUrl: string
}

const envNetwork = (process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK || 'preview').toLowerCase().trim()

export const MIDNIGHT_NETWORK: MidnightNetworkConfig = {
  id: envNetwork,
  name: envNetwork === 'preprod' ? 'Midnight Preprod' : 'Midnight Preview Net',
  rpcUrl: process.env.NEXT_PUBLIC_MIDNIGHT_RPC_URL || 'https://rpc.preview.midnight.network',
  indexerUrl: process.env.NEXT_PUBLIC_MIDNIGHT_INDEXER_URL || 'https://indexer.preview.midnight.network/graphql',
}

export const CONNECTION_TIMEOUT_MS = 15000 // 15 seconds connection timeout
