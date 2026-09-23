/**
 * Centralized Midnight Network Configuration
 */

export interface MidnightNetworkConfig {
  id: string
  name: string
  rpcUrl: string
  indexerUrl: string
}

const envNetwork = (process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK || 'preprod').toLowerCase().trim()

if (envNetwork.includes('main') || envNetwork === 'mainnet') {
  throw new Error('[FATAL] Mainnet is strictly prohibited. Set NEXT_PUBLIC_MIDNIGHT_NETWORK="preprod".')
}

export const MIDNIGHT_NETWORK: MidnightNetworkConfig = {
  id: envNetwork,
  name: envNetwork === 'preprod' ? 'Midnight Preprod' : `Midnight ${envNetwork.toUpperCase()}`,
  rpcUrl: process.env.NEXT_PUBLIC_MIDNIGHT_RPC_URL || 'https://rpc.preprod.midnight.network',
  indexerUrl: process.env.NEXT_PUBLIC_MIDNIGHT_INDEXER_URL || 'https://indexer.preprod.midnight.network/api/v4/graphql',
}

export const CONNECTION_TIMEOUT_MS = 60000 // 60 seconds connection timeout to allow user extension approval
