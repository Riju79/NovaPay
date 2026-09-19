/**
 * NovaPay Server Environment Configuration & Startup Validator
 * Target Network: MIDNIGHT PREVIEW
 *
 * Enforces strict network separation, schema validation, and anti-Mainnet protection.
 */

import dotenv from 'dotenv'
import path from 'path'
import crypto from 'crypto'

// Load .env from server root if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

export type AppEnvironment = 'development' | 'preview' | 'preprod' | 'production' | 'test'

export interface DatabaseConfig {
  url: string
  provider: 'sqlite' | 'postgresql'
  maxConnections: number
  connectionTimeoutMs: number
}

export interface MidnightConfig {
  network: string
  rpcUrl: string
  indexerUrl: string
  explorerUrl: string
  proofServerUrl: string
  packageId?: string
  contractAddress?: string
  assetId: string
  escrowContractAddress?: string
  recurringContractAddress?: string
}

export interface OneAmConfig {
  providerId: string
  connectionTimeoutMs: number
}

export interface FairwayConfig {
  apiUrl: string
  apiKey?: string
  clientId?: string
  webhookSecret?: string
  environment: string
  enabled: boolean
}

export interface IdentusConfig {
  cloudAgentUrl: string
  apiKey?: string
  issuerDid?: string
  webhookSecret?: string
  environment: string
  enabled: boolean
}

export interface TriplePlayConfig {
  apiUrl: string
  apiKey?: string
  complianceEngineId?: string
  environment: string
  enabled: boolean
}

export interface MoneyGramConfig {
  partnerId?: string
  apiKey?: string
  clientSecret?: string
  webhookHmacKey?: string
  environment: string
  sandboxUrl: string
  enabled: boolean
}

export interface WorldpayConfig {
  merchantId?: string
  serviceKey?: string
  clientKey?: string
  webhookSecret?: string
  environment: string
  sandboxUrl: string
  enabled: boolean
}

export interface AuthConfig {
  jwtSecret: string
  jwtRefreshSecret: string
  jwtAccessExpiresIn: string
  jwtRefreshExpiresIn: string
  challengeTtlMs: number
}

export interface WebhookConfig {
  signingSecret: string
  allowedHosts: string[]
  toleranceSeconds: number
}

export interface ServerConfig {
  env: AppEnvironment
  port: number
  corsAllowedOrigins: string[]
  database: DatabaseConfig
  midnight: MidnightConfig
  oneAm: OneAmConfig
  fairway: FairwayConfig
  identus: IdentusConfig
  triplePlay: TriplePlayConfig
  moneygram: MoneyGramConfig
  worldpay: WorldpayConfig
  auth: AuthConfig
  webhooks: WebhookConfig
}

/**
 * Validates that the active configuration is compliant with Midnight Preview
 * and explicitly rejects any accidental Mainnet configuration.
 */
export function validateEnvironment(): ServerConfig {
  const env = (process.env.NODE_ENV || 'development').toLowerCase() as AppEnvironment
  const port = parseInt(process.env.PORT || '5000', 10)

  // 1. Explicit Network & Anti-Mainnet Safeguards
  const midnightNetwork = (process.env.MIDNIGHT_NETWORK || 'preview').toLowerCase().trim()
  const rpcUrl = process.env.MIDNIGHT_RPC_URL || 'https://rpc.preview.midnight.network'
  const indexerUrl = process.env.MIDNIGHT_INDEXER_URL || 'https://indexer.preview.midnight.network/graphql'
  const explorerUrl = process.env.MIDNIGHT_EXPLORER_URL || 'https://explorer.1am.xyz'
  const proofServerUrl = process.env.MIDNIGHT_PROOF_SERVER_URL || 'http://localhost:6300'

  if (midnightNetwork.includes('main') || midnightNetwork === 'mainnet') {
    throw new Error(
      `[CRITICAL CONFIGURATION ERROR] Midnight Mainnet is strictly prohibited! Target network must be 'preview'. Got: ${midnightNetwork}`
    )
  }

  if (rpcUrl.toLowerCase().includes('mainnet') || indexerUrl.toLowerCase().includes('mainnet')) {
    throw new Error(
      `[CRITICAL CONFIGURATION ERROR] Mainnet RPC or Indexer URL detected! Preview endpoints required. Got RPC: ${rpcUrl}`
    )
  }

  if (env === 'preview' && midnightNetwork !== 'preview') {
    throw new Error(
      `[CONFIGURATION ERROR] Preview environment requires MIDNIGHT_NETWORK='preview'. Current: ${midnightNetwork}`
    )
  }

  // 2. Database Configuration
  const dbUrl = process.env.DATABASE_URL || 'file:./dev.db'
  const dbProvider = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://') ? 'postgresql' : 'sqlite'

  if (env === 'production' && dbProvider === 'sqlite') {
    console.warn(
      '[SECURITY WARNING] SQLite is in use for production/preprod. Production migration to PostgreSQL is recommended.'
    )
  }

  // 3. Authentication & Secrets Validation
  const insecureDemoSecrets = [
    'novapay_jwt_access_secret_token_1827',
    'novapay_jwt_refresh_secret_token_9821',
    'secret',
    'password123',
    'dev_jwt_secret_change_in_preprod_min32chars!',
  ]

  let jwtSecret = process.env.JWT_SECRET || ''
  if (!jwtSecret && env === 'development') {
    // Generate secure ephemeral key if not provided in dev
    jwtSecret = crypto.randomBytes(32).toString('hex')
  }

  let jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || ''
  if (!jwtRefreshSecret && env === 'development') {
    jwtRefreshSecret = crypto.randomBytes(32).toString('hex')
  }

  if (insecureDemoSecrets.includes(jwtSecret)) {
    throw new Error(
      `[SECURITY ERROR] Hardcoded/insecure demo JWT_SECRET detected! You must specify a unique, uncommitted secret for ${env}.`
    )
  }

  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error(
      `[SECURITY ERROR] JWT_SECRET must be at least 32 characters in ${env} environment. Please set a cryptographically secure secret.`
    )
  }

  if (!jwtRefreshSecret || jwtRefreshSecret.length < 32) {
    throw new Error(
      `[SECURITY ERROR] JWT_REFRESH_SECRET must be at least 32 characters in ${env} environment.`
    )
  }

  // 4. CORS Origins Validation
  const rawOrigins = process.env.CORS_ALLOWED_ORIGINS || (env === 'development' ? 'http://localhost:3000,http://localhost:3001' : '')
  const corsAllowedOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  if ((env === 'preprod' || env === 'production') && corsAllowedOrigins.length === 0) {
    throw new Error(
      `[SECURITY ERROR] CORS_ALLOWED_ORIGINS must be set in ${env} environment (comma-separated domains). Wildcard reflection is prohibited.`
    )
  }

  // 5. Providers Structured Configuration
  const config: ServerConfig = {
    env,
    port,
    corsAllowedOrigins: corsAllowedOrigins.length > 0 ? corsAllowedOrigins : ['http://localhost:3000'],
    database: {
      url: dbUrl,
      provider: dbProvider,
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
      connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '10000', 10),
    },
    midnight: {
      network: midnightNetwork,
      rpcUrl,
      indexerUrl,
      explorerUrl,
      proofServerUrl,
      packageId: process.env.MIDNIGHT_PACKAGE_ID,
      contractAddress: process.env.MIDNIGHT_CONTRACT_ADDRESS,
      assetId: process.env.MIDNIGHT_ASSET_ID || 'tDUST',
      escrowContractAddress: process.env.MIDNIGHT_ESCROW_CONTRACT_ADDRESS,
      recurringContractAddress: process.env.MIDNIGHT_RECURRING_CONTRACT_ADDRESS,
    },
    oneAm: {
      providerId: '1am',
      connectionTimeoutMs: parseInt(process.env.ONEAM_TIMEOUT_MS || '15000', 10),
    },
    fairway: {
      apiUrl: process.env.FAIRWAY_API_URL || 'https://api.sandbox.fairway.compliance/v1',
      apiKey: process.env.FAIRWAY_API_KEY,
      clientId: process.env.FAIRWAY_CLIENT_ID,
      webhookSecret: process.env.FAIRWAY_WEBHOOK_SECRET,
      environment: process.env.FAIRWAY_ENVIRONMENT || 'sandbox',
      enabled: Boolean(process.env.FAIRWAY_API_KEY),
    },
    identus: {
      cloudAgentUrl: process.env.IDENTUS_AGENT_URL || 'https://identus.preview.midnight.network/cloud-agent',
      apiKey: process.env.IDENTUS_API_KEY,
      issuerDid: process.env.IDENTUS_ISSUER_DID,
      webhookSecret: process.env.IDENTUS_WEBHOOK_SECRET,
      environment: process.env.IDENTUS_ENVIRONMENT || 'sandbox',
      enabled: Boolean(process.env.IDENTUS_AGENT_URL && process.env.IDENTUS_API_KEY),
    },
    triplePlay: {
      apiUrl: process.env.TRIPLE_PLAY_API_URL || 'https://api.sandbox.tripleplay.compliance/v1',
      apiKey: process.env.TRIPLE_PLAY_API_KEY,
      complianceEngineId: process.env.TRIPLE_PLAY_ENGINE_ID,
      environment: process.env.TRIPLE_PLAY_ENVIRONMENT || 'sandbox',
      enabled: Boolean(process.env.TRIPLE_PLAY_API_KEY),
    },
    moneygram: {
      partnerId: process.env.MONEYGRAM_PARTNER_ID,
      apiKey: process.env.MONEYGRAM_API_KEY,
      clientSecret: process.env.MONEYGRAM_CLIENT_SECRET,
      webhookHmacKey: process.env.MONEYGRAM_WEBHOOK_HMAC_KEY,
      environment: process.env.MONEYGRAM_ENVIRONMENT || 'sandbox',
      sandboxUrl: process.env.MONEYGRAM_SANDBOX_URL || 'https://api.sandbox.moneygram.com/v1',
      enabled: Boolean(process.env.MONEYGRAM_API_KEY && process.env.MONEYGRAM_PARTNER_ID),
    },
    worldpay: {
      merchantId: process.env.WORLDPAY_MERCHANT_ID,
      serviceKey: process.env.WORLDPAY_SERVICE_KEY,
      clientKey: process.env.WORLDPAY_CLIENT_KEY,
      webhookSecret: process.env.WORLDPAY_WEBHOOK_SECRET,
      environment: process.env.WORLDPAY_ENVIRONMENT || 'sandbox',
      sandboxUrl: process.env.WORLDPAY_SANDBOX_URL || 'https://api.sandbox.worldpay.com/v1',
      enabled: Boolean(process.env.WORLDPAY_SERVICE_KEY && process.env.WORLDPAY_MERCHANT_ID),
    },
    auth: {
      jwtSecret,
      jwtRefreshSecret,
      jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      challengeTtlMs: parseInt(process.env.WALLET_CHALLENGE_TTL_MS || '300000', 10), // 5 minutes
    },
    webhooks: {
      signingSecret: process.env.WEBHOOK_SIGNING_SECRET || (env === 'development' ? 'dev_webhook_signing_secret_min32chars!!' : ''),
      allowedHosts: (process.env.WEBHOOK_ALLOWED_HOSTS || '')
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean),
      toleranceSeconds: parseInt(process.env.WEBHOOK_TIMESTAMP_TOLERANCE_SECS || '300', 10),
    },
  }

  return Object.freeze(config)
}

// Global cached validated configuration instance
export const serverConfig = validateEnvironment()
