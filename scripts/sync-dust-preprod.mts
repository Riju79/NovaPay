import WebSocket from 'ws'
;(globalThis as any).WebSocket = WebSocket

import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd'
import { NetworkId, NoOpTransactionHistoryStorage } from '@midnight-ntwrk/wallet-sdk-abstractions'
import { DustSecretKey, LedgerParameters } from '@midnight-ntwrk/ledger-v8'
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet'
import * as bip39 from '@scure/bip39'
import fs from 'fs'
import path from 'path'

const CACHE_FILE = path.resolve(process.cwd(), 'cache/dust-wallet-state-preprod.json')
const CACHE_TMP = path.resolve(process.cwd(), 'cache/dust-wallet-state-preprod.json.tmp')

async function main() {
  console.log('======================================================================')
  console.log('🪙 Midnight Preprod — Fast Dust Wallet Synchronizer')
  console.log('======================================================================')

  const mnemonic = "float coffee wash auction nasty domain logic arctic giraffe royal this often clog radar season design flight model menu throw cancel kitten iron reduce"
  const masterSeed = bip39.mnemonicToSeedSync(mnemonic.trim())
  const hdResult = HDWallet.fromSeed(masterSeed)
  const acct = (hdResult as any).hdWallet.selectAccount(0)
  const dustRole = acct.selectRole(Roles.Dust)
  const dustDerived = dustRole.deriveKeyAt(0)
  const dustSecretKey = DustSecretKey.fromSeed(dustDerived.key)

  const indexerHttpUrl = 'https://indexer.preprod.midnight.network/api/v4/graphql'
  const indexerWsUrl = 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws'

  console.log('📡 Fetching Preprod ledger parameters...')
  const ledgerRes = await fetch(indexerHttpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ block { ledgerParameters height } }' })
  })
  const ledgerData = await ledgerRes.json()
  const currentHeight = ledgerData.data.block.height
  console.log(`⛓️  Current Preprod Block Height: ${currentHeight}`)
  const ledgerParams = LedgerParameters.deserialize(Buffer.from(ledgerData.data.block.ledgerParameters, 'hex'))

  const dustWalletClass = DustWallet({
    networkId: NetworkId.NetworkId.PreProd,
    indexerClientConnection: {
      indexerHttpUrl,
      indexerWsUrl,
      ws: WebSocket as any
    },
    txHistoryStorage: new NoOpTransactionHistoryStorage(),
    costModel: ledgerParams.transactionCostModel,
    costParameters: { feeBlocksMargin: 5 },
    batchUpdates: { size: 10000, spacing: 0, timeout: 5 } as any
  })

  let dustWallet: any
  if (fs.existsSync(CACHE_FILE)) {
    console.log(`💾 Resuming Dust Wallet from local cache: ${CACHE_FILE}`)
    const cachedState = fs.readFileSync(CACHE_FILE, 'utf8')
    dustWallet = dustWalletClass.restore(cachedState)
  } else {
    console.log('🌱 Starting fresh Dust Wallet sync from index 0...')
    dustWallet = dustWalletClass.startWithSecretKey(dustSecretKey, ledgerParams.dust)
  }

  await dustWallet.start(dustSecretKey)

  console.log('⏳ Streaming ledger events and building Merkle commitment tree...')
  const startTime = Date.now()
  let lastSaveTime = Date.now()
  let lastLogTime = Date.now()
  let lastIndex = 0n

  await new Promise<void>((resolve, reject) => {
    dustWallet.state.subscribe({
      next: (s: any) => {
        const now = Date.now()
        const applied = s.progress?.appliedIndex ?? 0n
        const maxId = s.progress?.highestRelevantWalletIndex ?? 0n
        const coinCount = s.availableCoins?.length || 0

        // Periodic snapshot save every 8 seconds
        if (now - lastSaveTime > 8000 && applied > 0n) {
          lastSaveTime = now
          try {
            const serialized = s.serialize()
            fs.writeFileSync(CACHE_TMP, serialized, 'utf8')
            fs.renameSync(CACHE_TMP, CACHE_FILE)
          } catch (err) {
            console.error('Snapshot save warning:', err)
          }
        }

        // Periodic logging every 3 seconds
        if (now - lastLogTime > 3000 || (coinCount > 0 && lastIndex === 0n)) {
          const deltaEvents = Number(applied - lastIndex)
          const deltaTime = (now - lastLogTime) / 1000
          const rate = deltaTime > 0 ? (deltaEvents / deltaTime).toFixed(0) : '0'
          lastLogTime = now
          lastIndex = applied

          const pct = maxId > 0n ? ((Number(applied) / Number(maxId)) * 100).toFixed(1) : '0.0'
          const totalSec = ((now - startTime) / 1000).toFixed(0)

          console.log(`   [${totalSec}s] Index: ${applied}/${maxId} (${pct}%) | Rate: ${rate} ev/s | Coins: ${coinCount}`)
        }

        // Check completion condition
        if (maxId > 0n && applied >= maxId) {
          console.log(`\n🎉 Dust Wallet fully synchronized to index ${applied}!`)
          console.log(`🪙 Available Coins: ${coinCount}, Balance: ${s.balance(new Date())}`)
          try {
            const serialized = s.serialize()
            fs.writeFileSync(CACHE_TMP, serialized, 'utf8')
            fs.renameSync(CACHE_TMP, CACHE_FILE)
            console.log(`💾 Saved synced state snapshot to ${CACHE_FILE}`)
          } catch (err) {
            console.error('Final snapshot save warning:', err)
          }
          resolve()
        }
      },
      error: (err: any) => {
        console.error('❌ Sync stream error:', err)
        reject(err)
      }
    })
  })

  await dustWallet.stop()
  console.log('✅ Dust Wallet sync completed successfully!')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Sync script failed:', err)
  process.exit(1)
})
