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

import WebSocket from 'ws'
;(globalThis as any).WebSocket = WebSocket

import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd'
import { UnshieldedWallet, createKeystore, PublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet'
import { NoOpTransactionHistoryStorage, NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions'
import { CompiledContract } from '@midnight-ntwrk/compact-js'
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider'
import { createUnprovenDeployTxFromVerifierKeys } from '@midnight-ntwrk/midnight-js-contracts'
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id'
import { filter } from 'rxjs'
import * as bip39 from '@scure/bip39'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

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

async function deployRecurring() {
  console.log('======================================================================')
  console.log('🚀 NovaPay — Deploying Recurring Smart Contract to Midnight Preview')
  console.log('======================================================================')

  setNetworkId('preview')
  const mnemonic = process.env.MIDNIGHT_WALLET_SEED
  if (!mnemonic) throw new Error('No MIDNIGHT_WALLET_SEED in .env.local')
  
  const masterSeed = bip39.mnemonicToSeedSync(mnemonic.trim())
  const hdResult = HDWallet.fromSeed(masterSeed)
  const acct = hdResult.hdWallet.selectAccount(0)
  const role = acct.selectRole(Roles.NightExternal)
  const derivedKey = role.deriveKeyAt(0)
  const keystore = createKeystore(derivedKey.key, NetworkId.NetworkId.Preview)
  const publicKeys = PublicKey.fromKeyStore(keystore)

  const UWClass = UnshieldedWallet({
    networkId: NetworkId.NetworkId.Preview,
    indexerClientConnection: {
      indexerHttpUrl: 'https://indexer.preview.midnight.network/api/v4/graphql',
      indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
      ws: WebSocket as any
    },
    txHistoryStorage: new NoOpTransactionHistoryStorage()
  })

  const unshieldedWallet = UWClass.startWithPublicKey(publicKeys)
  await unshieldedWallet.start()

  const { firstValueFrom } = await import('rxjs')
  const state = await firstValueFrom(
    unshieldedWallet.state.pipe(
      filter(s => Boolean(s.availableCoins && s.availableCoins.length > 0))
    )
  )
  console.log('Synced Coins count:', state.availableCoins.length)

  const recurringManagedDir = path.resolve(process.cwd(), 'contracts/recurring/managed')
  const recurringZkConfigProvider = new NodeZkConfigProvider(recurringManagedDir)
  const recurringContractModule = await import(path.join(recurringManagedDir, 'contract/index.js'))
  const RecurringContractCtor = recurringContractModule.Contract || (recurringContractModule as any).default?.Contract
  const recurringCompiledContract = CompiledContract.make('recurring', RecurringContractCtor).pipe(CompiledContract.withVacantWitnesses)

  console.log('Creating unproven deploy transaction for Recurring contract...')
  const unprovenDeployData = await createUnprovenDeployTxFromVerifierKeys(
    recurringZkConfigProvider as any,
    publicKeys.publicKey,
    {
      compiledContract: recurringCompiledContract,
      initialPrivateState: {},
    },
    'c559c4a753d85292f8959f4353585d41b5222a39120e6baaba1de8f5da698cd9'
  )

  const { ContractState, ContractDeploy, Intent, Transaction, LedgerState, WellFormedStrictness } = await import('@midnight-ntwrk/ledger-v8')
  const rawIntent = unprovenDeployData.private.unprovenTx.intents.get(1)
  const rawDeploy = rawIntent.actions[0]
  const freshState = ContractState.deserialize(rawDeploy.initialState.serialize())
  const blankCS = new ContractState()
  freshState.maintenanceAuthority = blankCS.maintenanceAuthority
  const fixedDeploy = new ContractDeploy(freshState)
  const contractAddress = fixedDeploy.address
  console.log('🎯 Fixed Recurring Contract Deploy address:', contractAddress)

  const txTtl = new Date(Date.now() + 3600 * 1000)
  const fixedIntent = Intent.new(txTtl).addDeploy(fixedDeploy)
  const tx = Transaction.fromParts('preview', undefined, undefined, fixedIntent)

  const { provingProvider: wasmProvingProvider } = await import('@midnight-ntwrk/zkir-v2')
  const { createProofProvider, zkConfigToProvingKeyMaterial } = await import('@midnight-ntwrk/midnight-js-types')
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

  console.log('Proving base Recurring deploy transaction...')
  const provenTx = await proofProvider.proveTx(tx)
  console.log('Proven tx created! Serialized length:', provenTx.serialize().length)

  console.log('Initializing and syncing Dust Wallet...')
  const { DustWallet } = await import('@midnight-ntwrk/wallet-sdk-dust-wallet')
  const { DustSecretKey, LedgerParameters } = await import('@midnight-ntwrk/ledger-v8')
  const { makeWasmProvingService } = await import('@midnight-ntwrk/wallet-sdk-capabilities/proving')

  const dustRole = acct.selectRole(Roles.Dust)
  const dustDerived = dustRole.deriveKeyAt(0)
  if (dustDerived.type !== 'keyDerived') throw new Error('Dust derivation failed')
  const dustSecretKey = DustSecretKey.fromSeed(dustDerived.key)

  const query = `query { block { ledgerParameters } }`
  const res = await fetch('https://indexer.preview.midnight.network/api/v4/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  })
  const data = await res.json()
  const hex = data.data.block.ledgerParameters
  const ledgerParams = LedgerParameters.deserialize(Buffer.from(hex, 'hex'))

  const dustWalletClass = DustWallet({
    networkId: NetworkId.NetworkId.Preview,
    indexerClientConnection: {
      indexerHttpUrl: 'https://indexer.preview.midnight.network/api/v4/graphql',
      indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
      ws: WebSocket as any
    },
    txHistoryStorage: new NoOpTransactionHistoryStorage(),
    costModel: ledgerParams.transactionCostModel,
    costParameters: { feeBlocksMargin: 5, additionalFeeOverhead: 2_000_000_000_000_000n },
    batchUpdates: { size: 2000, spacing: 0, timeout: 50 } as any
  })

  const dustCacheFile = path.resolve(process.cwd(), 'cache/dust-wallet-state.json')
  let dustWallet: any
  if (fs.existsSync(dustCacheFile)) {
    console.log('Restoring Dust Wallet from local cache...')
    dustWallet = dustWalletClass.restore(fs.readFileSync(dustCacheFile, 'utf8'))
    await dustWallet.start(dustSecretKey)
  } else {
    console.log('Starting Dust Wallet and syncing from indexer...')
    dustWallet = dustWalletClass.startWithSecretKey(dustSecretKey, ledgerParams.dust)
    await dustWallet.start(dustSecretKey)
  }

  console.log('Waiting for dust wallet to sync with chain...')
  const dustState = await dustWallet.waitForSyncedState()
  try {
    fs.mkdirSync(path.resolve(process.cwd(), 'cache'), { recursive: true })
    fs.writeFileSync(dustCacheFile, dustState.serialize(), 'utf8')
  } catch {}
  console.log('Dust Wallet synced! Available coins:', dustState.availableCoins.length)
  console.log('Dust balance:', dustState.balance(new Date()))

  let polkadotApi: any
  try {
    const baseTx = provenTx
    console.log('Balancing DUST transaction fees with dust wallet...')
    const now = new Date()
    const feeBalancingTx = await dustWallet.balanceTransactions(dustSecretKey, [baseTx], txTtl, now)
    console.log('Fee balancing tx created! Serialized length:', feeBalancingTx.serialize().length)

    console.log('Signing base transaction with deployer keystore...')
    const signedBaseTx = await unshieldedWallet.signUnboundTransaction(baseTx, (data: Uint8Array) => keystore.signData(data))

    console.log('Signing and proving fee balancing transaction...')
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
    console.log('Unbound fee tx serialized length:', unboundFeeTx.serialize().length)

    console.log('Merging unbound base transaction and unbound fee balancing transaction...')
    const mergedUnboundTx = signedBaseTx.merge(unboundFeeTx)
    console.log('Merged unbound tx length:', mergedUnboundTx.serialize().length)

    console.log('Binding merged transaction...')
    const finalTx = mergedUnboundTx.bind()
    console.log('Final transaction serialized length:', finalTx.serialize().length)

    const blankState = LedgerState.blank('preview')
    const strictness = new WellFormedStrictness()
    console.log('Validating with wellFormed (enforceLimits=true, enforceBalancing=true, verifySignatures=true)...')
    finalTx.wellFormed(blankState, strictness, new Date())
    console.log('🎉🎉🎉 WELL FORMED SUCCESS! Verified Recurring deployment transaction is valid!')
    console.log('Final tx identifiers:', finalTx.identifiers())

    console.log('Submitting final tx via polkadotApi...')
    const { ApiPromise, WsProvider } = await import('@polkadot/api')
    const { u8aToHex } = await import('@polkadot/util')
    const wsProvider = new WsProvider('wss://rpc.preview.midnight.network')
    polkadotApi = await ApiPromise.create({ provider: wsProvider, noInitWarn: true })
    
    const txHex = u8aToHex(finalTx.serialize())
    console.log('Hex length:', txHex.length, 'prefix:', txHex.slice(0, 40))
    const ext = polkadotApi.tx.midnight.sendMnTransaction(txHex)

    const txHash = await new Promise((resolve, reject) => {
      ext.send((result: any) => {
        console.log('Extrinsic status:', result.status.type)
        if (result.status.isInBlock) {
          console.log('✅ In block:', result.status.asInBlock.toString())
          resolve(result.status.asInBlock.toString())
        } else if (result.status.isFinalized) {
          console.log('🎉 Finalized:', result.status.asFinalized.toString())
          resolve(result.status.asFinalized.toString())
        } else if (result.isError) {
          reject(new Error('Extrinsic failed'))
        }
      }).catch(reject)
    })

    console.log('🚀 SUBMISSION COMPLETED! Block hash:', txHash)
    console.log('Deployed Recurring contract address:', contractAddress)

    // Save contract addresses
    const envLocal = path.resolve(process.cwd(), '.env.local')
    const serverEnv = path.resolve(process.cwd(), 'server/.env')
    updateEnvFile(envLocal, 'NEXT_PUBLIC_MIDNIGHT_RECURRING_CONTRACT_ADDRESS', contractAddress)
    updateEnvFile(envLocal, 'NEXT_PUBLIC_RECURRING_CONTRACT_ADDRESS', contractAddress)
    updateEnvFile(serverEnv, 'MIDNIGHT_RECURRING_CONTRACT_ADDRESS', contractAddress)
    updateEnvFile(serverEnv, 'NEXT_PUBLIC_RECURRING_CONTRACT_ADDRESS', contractAddress)
    console.log('💾 Saved Recurring contract address to .env.local and server/.env')

    await polkadotApi.disconnect()
    await dustWallet.stop()
    unshieldedWallet.stop()
    return { contractAddress, txHash }
  } catch (e: any) {
    console.error('Execution error:', e)
    if (polkadotApi) await polkadotApi.disconnect()
    await dustWallet.stop()
    unshieldedWallet.stop()
    throw e
  }
}

deployRecurring().catch(console.error)
