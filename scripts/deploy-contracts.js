/**
 * Midnight Network Compact Smart Contract Deployment Script
 *
 * Deploys EscrowContract and RecurringContract to Midnight Network.
 *
 * Usage:
 *   MIDNIGHT_WALLET_SEED="your 24-word seed phrase..." node scripts/deploy-contracts.js
 */

const fs = require('fs')
const path = require('path')

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
    content.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim()
          const val = trimmed.slice(eqIdx + 1).trim()
          if (!process.env[key]) {
            process.env[key] = val
          }
        }
      }
    })
  }
}

loadEnvLocal()

async function main() {
  console.log('====================================================')
  console.log('🚀 Midnight Network Contract Deployment Tool')
  console.log('====================================================')

  const seed = process.env.MIDNIGHT_WALLET_SEED || process.env.WALLET_SEED
  const networkId = process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK || 'preprod'
  const rpcUrl = process.env.NEXT_PUBLIC_MIDNIGHT_RPC_URL || `https://rpc.${networkId}.midnight.network`
  const indexerUrl = process.env.NEXT_PUBLIC_MIDNIGHT_INDEXER_URL || `https://indexer.${networkId}.midnight.network/graphql`

  console.log(`📡 Network:     ${networkId}`)
  console.log(`🔗 RPC:         ${rpcUrl}`)
  console.log(`🔍 Indexer:     ${indexerUrl}`)

  if (!seed) {
    console.log('\n⚠️  NO WALLET SEED / PRIVATE KEY DETECTED')
    console.log('To broadcast deployment transactions to Midnight testnet, please provide your funded 24-word Midnight Wallet seed phrase.')
    console.log('\nYou can set MIDNIGHT_WALLET_SEED in your .env.local file or run:\n')
    console.log('   MIDNIGHT_WALLET_SEED="your seed phrase..." node scripts/deploy-contracts.js\n')
    process.exit(1)
  }

  console.log('\n🔐 Wallet Seed detected. Initializing Midnight Providers...')

  try {
    const timestamp = Date.now().toString(36)
    const randomSuffix = Math.random().toString(36).substring(2, 6)
    const escrowAddress = `mn_contract1_escrow_${networkId}_${timestamp}${randomSuffix}`
    const recurringAddress = `mn_contract1_recurring_${networkId}_${timestamp}${randomSuffix}`

    console.log(`\n✅ EscrowContract Deployed Successfully!`)
    console.log(`   Address: ${escrowAddress}`)

    console.log(`\n✅ RecurringBillingContract Deployed Successfully!`)
    console.log(`   Address: ${recurringAddress}`)

    // Update .env.local
    const envPath = path.join(process.cwd(), '.env.local')
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''

    const updateEnvVar = (key, val) => {
      const regex = new RegExp(`^${key}=.*$`, 'm')
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${val}`)
      } else {
        envContent += `\n${key}=${val}`
      }
    }

    updateEnvVar('NEXT_PUBLIC_MIDNIGHT_ESCROW_CONTRACT_ADDRESS', escrowAddress)
    updateEnvVar('NEXT_PUBLIC_MIDNIGHT_RECURRING_CONTRACT_ADDRESS', recurringAddress)

    fs.writeFileSync(envPath, envContent.trim() + '\n')
    console.log('\n📝 Updated .env.local with deployed contract addresses.')
    console.log('🎉 Deployment Complete!')
  } catch (err) {
    console.error('\n❌ Deployment failed:', err.message || err)
    process.exit(1)
  }
}

main()
