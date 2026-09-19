// Polyfill ECMAScript Iterator helpers for Node 20 environments
function setupIteratorHelpers(targetProto: any) {
  if (!targetProto) return
  if (!targetProto.find) {
    targetProto.find = function (predicate: any) {
      let i = 0
      for (const item of this) {
        if (predicate(item, i++)) {
          return item
        }
      }
      return undefined
    }
  }
  if (!targetProto.some) {
    targetProto.some = function (predicate: any) {
      let i = 0
      for (const item of this) {
        if (predicate(item, i++)) return true
      }
      return false
    }
  }
  if (!targetProto.every) {
    targetProto.every = function (predicate: any) {
      let i = 0
      for (const item of this) {
        if (!predicate(item, i++)) return false
      }
      return true
    }
  }
  if (!targetProto.reduce) {
    targetProto.reduce = function (reducer: any, initialValue: any) {
      let accumulator = initialValue
      let i = 0
      let first = true
      for (const item of this) {
        if (first && initialValue === undefined) {
          accumulator = item
          first = false
        } else {
          accumulator = reducer(accumulator, item, i++)
        }
      }
      return accumulator
    }
  }
  if (!targetProto.toArray) {
    targetProto.toArray = function () {
      return Array.from(this)
    }
  }
  if (!targetProto.map) {
    targetProto.map = function (fn: any) {
      const self = this
      function* mapped() {
        let i = 0
        for (const item of self) {
          yield fn(item, i++)
        }
      }
      return mapped()
    }
  }
  if (!targetProto.filter) {
    targetProto.filter = function (predicate: any) {
      const self = this
      function* filtered() {
        let i = 0
        for (const item of self) {
          if (predicate(item, i++)) {
            yield item
          }
        }
      }
      return filtered()
    }
  }
  if (!targetProto.flatMap) {
    targetProto.flatMap = function (fn: any) {
      const self = this
      function* flatMapped() {
        let i = 0
        for (const item of self) {
          for (const subItem of fn(item, i++)) {
            yield subItem
          }
        }
      }
      return flatMapped()
    }
  }
  if (!targetProto.forEach) {
    targetProto.forEach = function (fn: any) {
      let i = 0
      for (const item of this) {
        fn(item, i++)
      }
    }
  }
}

const mapIterProto = Object.getPrototypeOf(new Map().entries())
const setIterProto = Object.getPrototypeOf(new Set().values())
const arrIterProto = Object.getPrototypeOf([][Symbol.iterator]())
const iteratorProto = Object.getPrototypeOf(mapIterProto)
const iteratorProtoParent = Object.getPrototypeOf(iteratorProto)

setupIteratorHelpers(mapIterProto)
setupIteratorHelpers(setIterProto)
setupIteratorHelpers(arrIterProto)
setupIteratorHelpers(iteratorProto)
if (iteratorProtoParent) setupIteratorHelpers(iteratorProtoParent)
if (typeof (globalThis as any).Iterator !== 'undefined' && (globalThis as any).Iterator?.prototype) {
  setupIteratorHelpers((globalThis as any).Iterator.prototype)
}

import { deployContract } from '@midnight-ntwrk/midnight-js-contracts'
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider'
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider'
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider'
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider'
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id'
import { createProofProvider, zkConfigToProvingKeyMaterial } from '@midnight-ntwrk/midnight-js-types'
import { provingProvider as wasmProvingProvider } from '@midnight-ntwrk/zkir-v2'
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd'
import { createKeystore, PublicKey, UnshieldedWallet } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet'
import { NetworkId, NoOpTransactionHistoryStorage } from '@midnight-ntwrk/wallet-sdk-abstractions'
import { DustSecretKey, LedgerParameters } from '@midnight-ntwrk/ledger-v8'
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet'
import { makeWasmProvingService } from '@midnight-ntwrk/wallet-sdk-capabilities/proving'
import * as bip39 from '@scure/bip39'
// @ts-ignore
import WebSocket from 'ws'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { filter, firstValueFrom } from 'rxjs'

// 1. Load environment variables
const envLocalPath = path.resolve(process.cwd(), '.env.local')
const serverEnvPath = path.resolve(process.cwd(), 'server', '.env')

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath })
}
if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath })
}

function updateEnvFile(filePath: string, key: string, value: string) {
  if (!fs.existsSync(filePath)) return
  let content = fs.readFileSync(filePath, 'utf8')
  const regex = new RegExp(`^${key}=.*$`, 'm')
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`)
  } else {
    content += `\n${key}=${value}`
  }
  fs.writeFileSync(filePath, content, 'utf8')
}

async function createProofProviderForCircuit(proofServerUrl: string, zkConfigProvider: any) {
  try {
    const res = await fetch(proofServerUrl, { method: 'GET' }).catch(() => null)
    if (res && res.status < 500) {
      console.log(`   ⚡ Using HTTP Proof Server at ${proofServerUrl}`)
      return httpClientProofProvider(proofServerUrl, zkConfigProvider)
    }
  } catch {}

  console.log('   ⚡ HTTP Proof Server unavailable — using in-process WASM Prover')
  const kmProvider = {
    getKeyMaterial: async (circuitId: string) => {
      const zkConfig = await zkConfigProvider.get(circuitId)
      return zkConfigToProvingKeyMaterial(zkConfig)
    },
    lookupKey: async (circuitId: string) => {
      const zkConfig = await zkConfigProvider.get(circuitId)
      return zkConfigToProvingKeyMaterial(zkConfig)
    },
    getParams: async () => new Uint8Array()
  }
  const baseProver = wasmProvingProvider(kmProvider as any)
  return createProofProvider(baseProver)
}

async function main() {
  console.log('======================================================================')
  console.log('🚀 NovaPay — Midnight Preview On-Chain Smart Contract Deployment')
  console.log('======================================================================')

  // 2. Validate Mnemonic Seed Phrase
  const mnemonic = process.env.MIDNIGHT_WALLET_SEED
  if (!mnemonic || mnemonic.trim().split(/\s+/).length < 12) {
    console.error('\n❌ FATAL: MIDNIGHT_WALLET_SEED is missing or invalid in .env.local.')
    console.error('Please configure your 24-word recovery phrase in .env.local:')
    console.error('MIDNIGHT_WALLET_SEED="word1 word2 ... word24"')
    process.exit(1)
  }

  // 3. Network & Configuration
  const networkTarget = process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK || 'preview'
  if (networkTarget.toLowerCase().includes('main') || networkTarget === 'mainnet') {
    console.error('\n❌ FATAL: Mainnet deployment is strictly prohibited!')
    process.exit(1)
  }

  setNetworkId('preview')

  const rpcUrl = process.env.NEXT_PUBLIC_MIDNIGHT_RPC_URL || 'https://rpc.preview.midnight.network'
  const indexerHttpUrl = 'https://indexer.preview.midnight.network/api/v4/graphql'
  const indexerWsUrl = 'wss://indexer.preview.midnight.network/api/v4/graphql/ws'
  const proofServerUrl = process.env.MIDNIGHT_PROOF_SERVER_URL || process.env.NEXT_PUBLIC_MIDNIGHT_PROOF_SERVER_URL || 'http://127.0.0.1:6300'

  console.log(`📡 Target Network:     ${networkTarget.toUpperCase()}`)
  console.log(`🔗 Preview RPC Node:    ${rpcUrl}`)
  console.log(`🔍 Indexer GraphQL:     ${indexerHttpUrl}`)
  console.log(`⚡ ZK Proof Server:     ${proofServerUrl}`)

  // 4. Derive Keys & Addresses from Mnemonic via Unified Wallet Helper
  console.log('\n🔐 Loading and deriving cryptographic keys via Unified Wallet Helper...')
  const { getOrDeriveWallet } = await import('./wallet-helper.mts')
  const walletInfo = await getOrDeriveWallet()

  const deployerUnshieldedAddress = walletInfo.address
  const deployerCoinPublicKey = walletInfo.coinPublicKeyHex
  const deployerEncryptionPublicKey = walletInfo.encryptionPublicKeyHex

  console.log(`👤 Deployer Unshielded Address: ${deployerUnshieldedAddress}`)
  console.log(`🔑 Deployer Coin Public Key:    ${deployerCoinPublicKey}`)
  console.log(`🔒 Deployer Encryption Key:     ${deployerEncryptionPublicKey}`)
  console.log(`🔐 Seed SHA-256 Checksum:       ${walletInfo.mnemonicSha256}`)

  // 5. Initialize Unshielded Wallet for Fee Balancing
  console.log('\n👛 Initializing Unshielded Wallet...')
  ;(globalThis as any).WebSocket = WebSocket

  const { PublicKey: UWPublicKey } = await import('@midnight-ntwrk/wallet-sdk-unshielded-wallet')
  const masterSeed = bip39.mnemonicToSeedSync(walletInfo.mnemonic)
  const hdResult = HDWallet.fromSeed(masterSeed)
  if (hdResult.type !== 'seedOk') throw new Error('HD failure')
  const acct = hdResult.hdWallet.selectAccount(0)
  const role = acct.selectRole(Roles.NightExternal)
  const derivedKey = role.deriveKeyAt(0)
  if (derivedKey.type !== 'keyDerived') throw new Error('Key derivation failed')
  const keystore = createKeystore(derivedKey.key, NetworkId.NetworkId.Preview)
  const publicKeys = UWPublicKey.fromKeyStore(keystore)

  const UWClass = UnshieldedWallet({
    networkId: NetworkId.NetworkId.Preview,
    indexerClientConnection: {
      indexerHttpUrl,
      indexerWsUrl,
      ws: WebSocket as any
    },
    txHistoryStorage: new NoOpTransactionHistoryStorage()
  })
  const unshieldedWallet = UWClass.startWithPublicKey(publicKeys)
  console.log('   ⏳ Starting and synchronizing wallet with Midnight Preview indexer...')
  await unshieldedWallet.start()
  
  console.log('   ⏳ Waiting for wallet to fully synchronize to chain tip...')
  let walletState: any
  try {
    walletState = await unshieldedWallet.waitForSyncedState(0n)
  } catch {
    walletState = await firstValueFrom(
      unshieldedWallet.state.pipe(
        filter(s => Boolean(s.availableCoins && s.availableCoins.length >= 3))
      )
    )
  }
  console.log(`   💰 Wallet Synced Successfully! Total Available Coins: ${walletState.availableCoins.length}, Balance: ${JSON.stringify(walletState.balances, (k, v) => typeof v === 'bigint' ? v.toString() : v)}`)

  // 5.1 Initialize Dust Wallet for DUST Fee Payments
  console.log('\n🪙 Initializing and synchronizing Dust Wallet for DUST fee payments...')
  const dustRole = acct.selectRole(Roles.Dust)
  const dustDerived = dustRole.deriveKeyAt(0)
  if (dustDerived.type !== 'keyDerived') throw new Error('Dust key derivation failed')
  const dustSecretKey = DustSecretKey.fromSeed(dustDerived.key)

  const ledgerQuery = `query { block { ledgerParameters } }`
  const ledgerRes = await fetch(indexerHttpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: ledgerQuery })
  })
  const ledgerData = await ledgerRes.json()
  const ledgerHex = ledgerData.data.block.ledgerParameters
  const ledgerParams = LedgerParameters.deserialize(Buffer.from(ledgerHex, 'hex'))

  const dustWalletClass = DustWallet({
    networkId: NetworkId.NetworkId.Preview,
    indexerClientConnection: {
      indexerHttpUrl,
      indexerWsUrl,
      ws: WebSocket as any
    },
    txHistoryStorage: new NoOpTransactionHistoryStorage(),
    costModel: ledgerParams.transactionCostModel,
    costParameters: { feeBlocksMargin: 5 },
    batchUpdates: { size: 2000, spacing: 0, timeout: 50 } as any
  })

  const dustWallet = dustWalletClass.startWithSecretKey(dustSecretKey, ledgerParams.dust)
  await dustWallet.start(dustSecretKey)

  console.log('   ⏳ Waiting for dust wallet to sync available dust coins...')
  const dustState = await firstValueFrom(
    dustWallet.state.pipe(
      filter(s => Boolean(s.availableCoins && s.availableCoins.length > 0))
    )
  )
  console.log(`   🪙 Dust Wallet Synced! Available Coins: ${dustState.availableCoins.length}, Balance: ${dustState.balance(new Date())}`)

  // 6. Connect to RPC Node
  console.log('\n🌐 Connecting to Midnight Preview RPC Node...')
  const { ApiPromise, WsProvider } = await import('@polkadot/api')
  const wsRpcUrl = process.env.MIDNIGHT_WS_RPC_URL || 'wss://rpc.preview.midnight.network'
  const wsProvider = new WsProvider(wsRpcUrl)
  const polkadotApi = await ApiPromise.create({ provider: wsProvider, noInitWarn: true })
  console.log(`✅ Connected to Midnight RPC Node: Genesis ${polkadotApi.genesisHash.toHex().slice(0, 10)}...`)

  // 7. Setup Providers
  const publicDataProvider = indexerPublicDataProvider(
    indexerHttpUrl,
    indexerWsUrl,
    WebSocket as any
  )

  const privateStateProvider = levelPrivateStateProvider({
    privateStateStoreName: 'novapay-deployer-private-state',
    accountId: deployerUnshieldedAddress,
    privateStoragePasswordProvider: async () => 'novapay_midnight_preview_secure_storage_password_2026',
  })

  const provingService = makeWasmProvingService({})

  const walletProvider = {
    getCoinPublicKey: () => deployerCoinPublicKey,
    getEncryptionPublicKey: () => deployerEncryptionPublicKey,
    balanceTx: async (tx: any, ttl?: Date) => {
      console.log('   ⚖️  Balancing transaction fees with deployer wallet...')
      console.log('       Initial tx serialized length:', tx.serialize().length)
      const targetTtl = ttl ?? new Date(Date.now() + 3600 * 1000)

      // Step A: Balance unshielded offers in place
      const balancedUnshieldedTx = await unshieldedWallet.balanceUnboundTransaction(tx)
      const baseTx = balancedUnshieldedTx ?? tx
      console.log('       Balanced unshielded tx length:', baseTx.serialize().length)

      // Step B: Balance DUST transaction fees with dust wallet
      console.log('   🪙  Balancing DUST fees with dust wallet...')
      const feeBalancingTx = await dustWallet.balanceTransactions(dustSecretKey, [baseTx], targetTtl)
      console.log('       Fee balancing tx serialized length:', feeBalancingTx.serialize().length)

      // Step C: Sign base transaction with deployer keystore
      console.log('   ✍️  Signing base transaction inputs with deployer keystore...')
      const signedBaseTx = await unshieldedWallet.signUnboundTransaction(baseTx, (data: Uint8Array) => keystore.signData(data))

      // Step D: Sign and prove fee balancing transaction
      console.log('   ✍️  Signing and proving fee balancing transaction...')
      const signedFeeTx = await unshieldedWallet.signUnprovenTransaction(feeBalancingTx, (data: Uint8Array) => keystore.signData(data))
      const unboundFeeTx = await provingService.prove(signedFeeTx)
      const finalizedFeeTx = unboundFeeTx.bind()
      console.log('       Finalized fee tx serialized length:', finalizedFeeTx.serialize().length)

      // Step E: Finalize base transaction by calling .bind()
      const finalizedBaseTx = signedBaseTx.bind()
      console.log('       Finalized base tx serialized length:', finalizedBaseTx.serialize().length)

      // Step F: Merge base and fee balancing transactions
      const finalizedTx = finalizedBaseTx.merge(finalizedFeeTx)
      console.log(`   🎉 Transaction Finalized! Identifiers: ${finalizedTx.identifiers().join(', ')}`)
      return finalizedTx
    }
  }

  const midnightProvider = {
    submitTx: async (tx: any): Promise<string> => {
      console.log('   📤 Submitting transaction to Midnight Preview blockchain...')
      const txIdentifiers = tx.identifiers ? tx.identifiers() : []
      const txId = txIdentifiers.length > 0 ? txIdentifiers[0] : ''
      const serializedHex = Buffer.from(tx.serialize()).toString('hex')
      console.log(`       TxId: ${txId}`)
      console.log(`       Tx hex length: ${serializedHex.length}`)
      console.log(`       Tx hex prefix: ${serializedHex.substring(0, 80)}...`)
      const ext = polkadotApi.tx.midnight.sendMnTransaction(`0x${serializedHex}`)
      return new Promise<string>((resolve, reject) => {
        ext.send((result: any) => {
          if (result.status.isInBlock || result.status.isFinalized) {
            const blockHash = result.status.isInBlock ? result.status.asInBlock.toHex() : (result.status.isFinalized ? result.status.asFinalized.toHex() : '')
            console.log(`   ✅ Transaction accepted into block ${blockHash}! TxId: ${txId}`)
            resolve(txId || (result.txHash ? result.txHash.toHex() : '0x'))
          } else if (result.isError) {
            reject(new Error(`Transaction submission error: ${JSON.stringify(result.internalError || result.status)}`))
          }
        }).catch(reject)
      })
    }
  }

  // 8. Deploy Escrow Smart Contract
  console.log('\n──────────────────────────────────────────────────────────────────────')
  console.log('🚀 [1/2] Deploying Escrow Contract to Midnight Preview...')
  console.log('──────────────────────────────────────────────────────────────────────')
  const escrowManagedDir = path.resolve(process.cwd(), 'contracts/escrow/managed')
  const escrowZkConfigProvider = new NodeZkConfigProvider<'createEscrow' | 'fundEscrow' | 'lockEscrow' | 'releaseEscrow' | 'refundEscrow' | 'cancelEscrow'>(
    escrowManagedDir
  )
  const escrowProofProvider = await createProofProviderForCircuit(proofServerUrl, escrowZkConfigProvider)

  const escrowContractModule = await import(path.join(escrowManagedDir, 'contract/index.js'))
  const EscrowContractCtor = escrowContractModule.Contract || (escrowContractModule as any).default?.Contract
  const { CompiledContract } = await import('@midnight-ntwrk/compact-js')
  const escrowCompiledContract = CompiledContract.make('escrow', EscrowContractCtor).pipe(CompiledContract.withVacantWitnesses)

  const escrowProviders = {
    privateStateProvider,
    publicDataProvider,
    zkConfigProvider: escrowZkConfigProvider,
    proofProvider: escrowProofProvider,
    walletProvider,
    midnightProvider,
  }

  console.log('   ⏳ Generating deployment transaction & zero-knowledge proofs for Escrow...')
  const deployedEscrow = await (deployContract as any)(escrowProviders, {
    compiledContract: escrowCompiledContract,
    initialPrivateState: {},
  })

  const escrowContractAddress = deployedEscrow.deployTxData.public.contractAddress
  const escrowTxHash = deployedEscrow.deployTxData.public.txId
  console.log(`\n🎉 Escrow Contract Deployed Successfully!`)
  console.log(`   📍 Contract Address: ${escrowContractAddress}`)
  console.log(`   🔗 Transaction ID:   ${escrowTxHash}`)
  console.log(`   🔍 1AM Explorer:     https://explorer.1am.xyz/contract/${escrowContractAddress}`)

  // 9. Deploy Recurring Smart Contract
  console.log('\n──────────────────────────────────────────────────────────────────────')
  console.log('🚀 [2/2] Deploying Recurring Contract to Midnight Preview...')
  console.log('──────────────────────────────────────────────────────────────────────')
  const recurringManagedDir = path.resolve(process.cwd(), 'contracts/recurring/managed')
  const recurringZkConfigProvider = new NodeZkConfigProvider<'createSubscription' | 'executePayment' | 'pauseSubscription' | 'resumeSubscription' | 'cancelSubscription'>(
    recurringManagedDir
  )
  const recurringProofProvider = await createProofProviderForCircuit(proofServerUrl, recurringZkConfigProvider)

  const recurringContractModule = await import(path.join(recurringManagedDir, 'contract/index.js'))
  const RecurringContractCtor = recurringContractModule.Contract || (recurringContractModule as any).default?.Contract
  const recurringCompiledContract = CompiledContract.make('recurring', RecurringContractCtor).pipe(CompiledContract.withVacantWitnesses)

  const recurringProviders = {
    privateStateProvider,
    publicDataProvider,
    zkConfigProvider: recurringZkConfigProvider,
    proofProvider: recurringProofProvider,
    walletProvider,
    midnightProvider,
  }

  console.log('   ⏳ Generating deployment transaction & zero-knowledge proofs for Recurring...')
  const deployedRecurring = await (deployContract as any)(recurringProviders, {
    compiledContract: recurringCompiledContract,
    initialPrivateState: {},
  })

  const recurringContractAddress = deployedRecurring.deployTxData.public.contractAddress
  const recurringTxHash = deployedRecurring.deployTxData.public.txId
  console.log(`\n🎉 Recurring Contract Deployed Successfully!`)
  console.log(`   📍 Contract Address: ${recurringContractAddress}`)
  console.log(`   🔗 Transaction ID:   ${recurringTxHash}`)
  console.log(`   🔍 1AM Explorer:     https://explorer.1am.xyz/contract/${recurringContractAddress}`)

  // 10. Update Configuration Files
  console.log('\n📝 Updating environment configuration files with REAL deployed on-chain addresses...')
  updateEnvFile(envLocalPath, 'NEXT_PUBLIC_MIDNIGHT_ESCROW_CONTRACT_ADDRESS', escrowContractAddress)
  updateEnvFile(envLocalPath, 'NEXT_PUBLIC_MIDNIGHT_RECURRING_CONTRACT_ADDRESS', recurringContractAddress)
  updateEnvFile(envLocalPath, 'MIDNIGHT_DEPLOYER_ADDRESS', deployerUnshieldedAddress)

  updateEnvFile(serverEnvPath, 'MIDNIGHT_ESCROW_CONTRACT_ADDRESS', escrowContractAddress)
  updateEnvFile(serverEnvPath, 'MIDNIGHT_RECURRING_CONTRACT_ADDRESS', recurringContractAddress)

  // Stop background services
  await dustWallet.stop()
  await unshieldedWallet.stop()
  await polkadotApi.disconnect()

  console.log('\n======================================================================')
  console.log('✅ ALL CONTRACTS SUCCESSFULLY DEPLOYED TO MIDNIGHT PREVIEW!')
  console.log('======================================================================')
  console.log(`Escrow Contract:    ${escrowContractAddress}`)
  console.log(`Recurring Contract: ${recurringContractAddress}`)
  console.log(`Deployer Address:   ${deployerUnshieldedAddress}`)
  console.log('======================================================================\n')
}

main().catch((err) => {
  console.error('\n❌ Deployment failed with error:', err)
  process.exit(1)
})
