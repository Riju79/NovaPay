import WebSocket from 'ws'
;(globalThis as any).WebSocket = WebSocket

// Polyfill ECMAScript Iterator helpers for Node 20 environments
function setupIteratorHelpers(targetProto: any) {
  if (!targetProto) return
  if (!targetProto.find) {
    targetProto.find = function (predicate: any) {
      let i = 0
      for (const item of this) {
        if (predicate(item, i++)) return item
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
          if (predicate(item, i++)) yield item
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

import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd'
import { UnshieldedWallet, createKeystore, PublicKey as UWPublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet'
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet'
import { NoOpTransactionHistoryStorage, NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions'
import {
  DustSecretKey,
  LedgerParameters,
  ContractState,
  ContractDeploy,
  Intent,
  Transaction
} from '@midnight-ntwrk/ledger-v8'
import { makeWasmProvingService } from '@midnight-ntwrk/wallet-sdk-capabilities/proving'
import { provingProvider as wasmProvingProvider } from '@midnight-ntwrk/zkir-v2'
import { createProofProvider, zkConfigToProvingKeyMaterial } from '@midnight-ntwrk/midnight-js-types'
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id'
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider'
import { CompiledContract } from '@midnight-ntwrk/compact-js'
import { createUnprovenDeployTxFromVerifierKeys } from '@midnight-ntwrk/midnight-js-contracts'
import { getOrDeriveWallet } from './wallet-helper.mts'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { u8aToHex } from '@polkadot/util'
import * as bip39 from '@scure/bip39'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') })

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

async function main() {
  console.log('======================================================================')
  console.log('🚀 NovaPay — Midnight PREPROD Full Contract Deployment')
  console.log('======================================================================')

  setNetworkId('preprod')

  // The Escrow contract was already deployed in the previous verified transaction
  const escrowContractAddress = 'a8239962710fb4bd1c9c1c5a88582bf51588b8fca678591db53f70600dc64ed2'
  const escrowTxHash = '0x8cdf7ed8cd6e9926950f972a71fa49667d0680174a9aeb2122d3a6428e602f38'
  console.log('✅ [1/2] Escrow Contract Already Deployed on Preprod!')
  console.log(`   📍 Escrow Contract Address: ${escrowContractAddress}`)
  console.log(`   🔗 Block / Tx Hash:         ${escrowTxHash}`)
  console.log(`   🔍 1AM Explorer:            https://explorer.1am.xyz/contract/${escrowContractAddress}`)

  // Derive deployer wallet
  console.log('\n🔐 Deriving cryptographic keys via Unified Wallet Helper...')
  const walletInfo = await getOrDeriveWallet()
  const masterSeed = bip39.mnemonicToSeedSync(walletInfo.mnemonic)
  const hdResult = HDWallet.fromSeed(masterSeed)
  const acct = (hdResult as any).hdWallet.selectAccount(0)
  const role = acct.selectRole(Roles.NightExternal)
  const derivedKey = role.deriveKeyAt(0)
  if (derivedKey.type !== 'keyDerived') throw new Error('Key derivation failed')
  const keystore = createKeystore(derivedKey.key, NetworkId.NetworkId.PreProd)
  const publicKeys = UWPublicKey.fromKeyStore(keystore)

  const dustRole = acct.selectRole(Roles.Dust)
  const dustDerived = dustRole.deriveKeyAt(0)
  if (dustDerived.type !== 'keyDerived') throw new Error('Dust key derivation failed')
  const dustSecretKey = DustSecretKey.fromSeed(dustDerived.key)

  console.log(`👤 Deployer Address: ${walletInfo.address}`)

  const indexerHttpUrl = 'https://indexer.preprod.midnight.network/api/v4/graphql'
  const indexerWsUrl = 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws'

  console.log('📡 Fetching Preprod ledger parameters...')
  const ledgerRes = await fetch(indexerHttpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ block { ledgerParameters height } }' })
  })
  const ledgerData = await ledgerRes.json()
  console.log(`⛓️  Current Preprod Block Height: ${ledgerData.data.block.height}`)
  const ledgerParams = LedgerParameters.deserialize(Buffer.from(ledgerData.data.block.ledgerParameters, 'hex'))

  // Initialize Unshielded Wallet
  const UWClass = UnshieldedWallet({
    networkId: NetworkId.NetworkId.PreProd,
    indexerClientConnection: {
      indexerHttpUrl,
      indexerWsUrl,
      ws: WebSocket as any
    },
    txHistoryStorage: new NoOpTransactionHistoryStorage()
  })
  const unshieldedWallet = UWClass.startWithPublicKey(publicKeys)
  await unshieldedWallet.start()

  // Initialize Dust Wallet
  const dustWalletClass = DustWallet({
    networkId: NetworkId.NetworkId.PreProd,
    indexerClientConnection: {
      indexerHttpUrl,
      indexerWsUrl,
      ws: WebSocket as any
    },
    txHistoryStorage: new NoOpTransactionHistoryStorage(),
    costModel: ledgerParams.transactionCostModel,
    costParameters: { feeBlocksMargin: 5, additionalFeeOverhead: 2_000_000_000_000_000n },
    batchUpdates: { size: 10000, spacing: 0, timeout: 5 } as any
  })

  const dustCacheFile = path.resolve(process.cwd(), 'cache/dust-wallet-state-preprod.json')
  console.log('💾 Restoring Dust Wallet from local cache...')
  const dustWallet = dustWalletClass.restore(fs.readFileSync(dustCacheFile, 'utf8'))
  await dustWallet.start(dustSecretKey)

  console.log('⏳ Ensuring Dust Wallet is synchronized with chain tip...')
  await new Promise<any>((resolve, reject) => {
    let latest: any = null
    const sub = dustWallet.state.subscribe({
      next: (s: any) => {
        latest = s
        const applied = s.progress?.appliedIndex ?? 0n
        const maxId = s.progress?.highestRelevantWalletIndex ?? 0n
        if (maxId > 0n && applied >= maxId) {
          console.log(`🪙 Dust Wallet strictly synced at index ${applied}/${maxId}! Balance: ${s.balance(new Date())}`)
          sub.unsubscribe()
          resolve(s)
        }
      },
      error: reject
    })
    setTimeout(() => {
      if (latest) {
        console.log(`⏳ Sync ready at index ${latest.progress?.appliedIndex}/${latest.progress?.highestRelevantWalletIndex}`)
        sub.unsubscribe()
        resolve(latest)
      }
    }, 15000)
  })

  // -------------------------------------------------------------------------
  // DEPLOY RECURRING CONTRACT
  // -------------------------------------------------------------------------
  console.log('\n──────────────────────────────────────────────────────────────────────')
  console.log('🚀 [2/2] Deploying Recurring Smart Contract to Midnight PREPROD...')
  console.log('──────────────────────────────────────────────────────────────────────')

  const recurringManagedDir = path.resolve(process.cwd(), 'contracts/recurring/managed')
  const recurringZkConfigProvider = new NodeZkConfigProvider<'createSubscription' | 'executePayment' | 'pauseSubscription' | 'resumeSubscription' | 'cancelSubscription'>(
    recurringManagedDir
  )
  const recurringContractModule = await import(path.join(recurringManagedDir, 'contract/index.js'))
  const RecurringContractCtor = recurringContractModule.Contract || (recurringContractModule as any).default?.Contract
  const recurringCompiledContract = CompiledContract.make('recurring', RecurringContractCtor).pipe(CompiledContract.withVacantWitnesses)

  console.log('   ⏳ Initializing unproven contract deploy data...')
  const unprovenDeployData = await createUnprovenDeployTxFromVerifierKeys(
    recurringZkConfigProvider,
    walletInfo.coinPublicKeyHex,
    {
      compiledContract: recurringCompiledContract,
      initialPrivateState: {},
    },
    walletInfo.encryptionPublicKeyHex
  )

  const rawIntent = (unprovenDeployData.private.unprovenTx as any).intents.get(1)
  const rawDeploy = rawIntent.actions[0]
  const freshState = ContractState.deserialize(rawDeploy.initialState.serialize())
  const blankCS = new ContractState()
  freshState.maintenanceAuthority = blankCS.maintenanceAuthority
  const fixedDeploy = new ContractDeploy(freshState)
  const recurringContractAddress = fixedDeploy.address
  console.log(`   🎯 Recurring Contract Target Address: ${recurringContractAddress}`)

  const txTtl = new Date(Date.now() + 3600 * 1000)
  const fixedIntent = Intent.new(txTtl).addDeploy(fixedDeploy)
  const tx = Transaction.fromParts('preprod', undefined, undefined, fixedIntent)

  const kmProvider = {
    getKeyMaterial: async (circuitId: string) => {
      const zkConfig = await recurringZkConfigProvider.get(circuitId)
      return zkConfigToProvingKeyMaterial(zkConfig)
    },
    lookupKey: async (circuitId: string) => {
      const zkConfig = await recurringZkConfigProvider.get(circuitId)
      return zkConfigToProvingKeyMaterial(zkConfig)
    },
    getParams: async () => new Uint8Array()
  }
  const baseProver = wasmProvingProvider(kmProvider as any)
  const proofProvider = createProofProvider(baseProver)

  console.log('   ⚡ Generating zero-knowledge deployment proof for Recurring...')
  const provenBaseTx = await proofProvider.proveTx(tx)
  console.log(`       Proven base tx length: ${provenBaseTx.serialize().length} bytes`)

  console.log('   🪙  Balancing DUST fees with synchronized dust wallet...')
  const feeBalancingTx = await dustWallet.balanceTransactions(dustSecretKey, [provenBaseTx], txTtl)
  console.log(`       Fee balancing tx length: ${feeBalancingTx.serialize().length} bytes`)

  console.log('   ✍️  Signing base transaction inputs with deployer keystore...')
  const signedBaseTx = await unshieldedWallet.signUnboundTransaction(provenBaseTx, (data: Uint8Array) => keystore.signData(data))

  console.log('   ✍️  Signing and proving fee balancing transaction...')
  const signedFeeTx = await unshieldedWallet.signUnprovenTransaction(feeBalancingTx, (data: Uint8Array) => keystore.signData(data))
  const { WasmProver } = await import('@midnight-ntwrk/wallet-sdk-prover-client/effect')
  const defaultProvider = WasmProver.makeDefaultKeyMaterialProvider()
  const localKeyMaterialProvider = {
    lookupKey: async (keyLocation: string) => {
      const pth = ({
        'midnight/zswap/spend': 'zswap/9/spend',
        'midnight/zswap/output': 'zswap/9/output',
        'midnight/zswap/sign': 'zswap/9/sign',
        'midnight/dust/spend': 'dust/9/spend',
      } as Record<string, string>)[keyLocation]
      if (pth) {
        const base = path.resolve(process.cwd(), 'cache/proving-keys', pth)
        if (fs.existsSync(`${base}.prover`)) {
          return {
            proverKey: new Uint8Array(fs.readFileSync(`${base}.prover`)),
            verifierKey: new Uint8Array(fs.readFileSync(`${base}.verifier`)),
            ir: new Uint8Array(fs.readFileSync(`${base}.bzkir`)),
          }
        }
      }
      return defaultProvider.lookupKey(keyLocation)
    },
    getParams: async (k: number) => {
      const pth = path.resolve(process.cwd(), `cache/proving-keys/bls_midnight_2p${k}`)
      if (fs.existsSync(pth)) {
        return new Uint8Array(fs.readFileSync(pth))
      }
      return defaultProvider.getParams(k)
    }
  }
  const provingService = makeWasmProvingService({ keyMaterialProvider: localKeyMaterialProvider as any })
  const unboundFeeTx = await provingService.prove(signedFeeTx)

  console.log('   🔄  Merging unbound base and fee balancing transactions...')
  const mergedUnboundTx = signedBaseTx.merge(unboundFeeTx)
  console.log('   🔒  Binding unified merged transaction...')
  const finalTx = mergedUnboundTx.bind()
  console.log(`       Finalized transaction length: ${finalTx.serialize().length} bytes`)
  console.log(`       Transaction Identifiers: ${finalTx.identifiers().join(', ')}`)

  console.log('\n🌐 Connecting to Midnight Preprod RPC Node...')
  const wsProvider = new WsProvider('wss://rpc.preprod.midnight.network')
  const polkadotApi = await ApiPromise.create({ provider: wsProvider, noInitWarn: true })

  const txHex = u8aToHex(finalTx.serialize())
  console.log(`   📤 Submitting Recurring deployment extrinsic to Midnight Preprod...`)
  const ext = polkadotApi.tx.midnight.sendMnTransaction(txHex)

  const recurringTxHash = await new Promise<string>((resolve, reject) => {
    ext.send((result: any) => {
      console.log(`       Extrinsic status: ${result.status.type}`)
      if (result.status.isInBlock) {
        const bh = result.status.asInBlock.toString()
        console.log(`   ✅ Transaction accepted InBlock: ${bh}`)
        resolve(bh)
      } else if (result.status.isFinalized) {
        const bh = result.status.asFinalized.toString()
        console.log(`   🎉 Transaction Finalized in block: ${bh}`)
        resolve(bh)
      } else if (result.isError) {
        reject(new Error(`Extrinsic failed: ${JSON.stringify(result.internalError || result.status)}`))
      }
    }).catch(reject)
  })

  console.log(`\n🎉 Recurring Contract Deployed Successfully!`)
  console.log(`   📍 Contract Address: ${recurringContractAddress}`)
  console.log(`   🔗 Block Hash:       ${recurringTxHash}`)
  console.log(`   🔍 1AM Explorer:     https://explorer.1am.xyz/contract/${recurringContractAddress}`)

  // -------------------------------------------------------------------------
  // UPDATE ENVIRONMENT CONFIGURATION
  // -------------------------------------------------------------------------
  console.log('\n📝 Updating environment configuration files with REAL deployed on-chain addresses...')
  const envLocalPath = path.resolve(process.cwd(), '.env.local')
  const serverEnvPath = path.resolve(process.cwd(), 'server/.env')

  updateEnvFile(envLocalPath, 'NEXT_PUBLIC_MIDNIGHT_ESCROW_CONTRACT_ADDRESS', escrowContractAddress)
  updateEnvFile(envLocalPath, 'NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS', escrowContractAddress)
  updateEnvFile(envLocalPath, 'NEXT_PUBLIC_MIDNIGHT_RECURRING_CONTRACT_ADDRESS', recurringContractAddress)
  updateEnvFile(envLocalPath, 'NEXT_PUBLIC_RECURRING_CONTRACT_ADDRESS', recurringContractAddress)
  updateEnvFile(envLocalPath, 'MIDNIGHT_DEPLOYER_ADDRESS', walletInfo.address)

  updateEnvFile(serverEnvPath, 'MIDNIGHT_ESCROW_CONTRACT_ADDRESS', escrowContractAddress)
  updateEnvFile(serverEnvPath, 'MIDNIGHT_RECURRING_CONTRACT_ADDRESS', recurringContractAddress)
  updateEnvFile(serverEnvPath, 'MIDNIGHT_DEPLOYER_ADDRESS', walletInfo.address)

  console.log('✅ Configuration files (.env.local and server/.env) updated successfully!')

  // Update dust cache
  try {
    const finalDustState = await dustWallet.waitForSyncedState()
    fs.writeFileSync(dustCacheFile, finalDustState.serialize(), 'utf8')
    console.log('💾 Updated local dust cache.')
  } catch {}

  await polkadotApi.disconnect()
  await dustWallet.stop()
  await unshieldedWallet.stop()

  console.log('\n======================================================================')
  console.log('🎉 ALL CONTRACTS DEPLOYED & CONFIGURED ON MIDNIGHT PREPROD!')
  console.log('======================================================================')
  console.log(`Escrow Contract:    ${escrowContractAddress}`)
  console.log(`Recurring Contract: ${recurringContractAddress}`)
  console.log(`Deployer Address:   ${walletInfo.address}`)
  console.log('======================================================================\n')
  process.exit(0)
}

main().catch((err) => {
  console.error('\n❌ Deployment failed:', err)
  process.exit(1)
})
