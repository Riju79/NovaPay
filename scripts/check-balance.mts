// Polyfill ECMAScript Iterator helpers for Node 20 environments
function setupIteratorHelpers(targetProto: any) {
  if (!targetProto) return
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
}
const mapIterProto = Object.getPrototypeOf(new Map().entries())
const setIterProto = Object.getPrototypeOf(new Set().values())
const arrIterProto = Object.getPrototypeOf([][Symbol.iterator]())
const globalIterProto = Object.getPrototypeOf(mapIterProto)
setupIteratorHelpers(mapIterProto)
setupIteratorHelpers(setIterProto)
setupIteratorHelpers(arrIterProto)
setupIteratorHelpers(globalIterProto)

import WebSocket from 'ws'
;(globalThis as any).WebSocket = WebSocket

import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd'
import { UnshieldedWallet, createKeystore, PublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet'
import { NoOpTransactionHistoryStorage, NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions'
import { firstValueFrom, filter, timeout } from 'rxjs'
import * as bip39 from '@scure/bip39'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function checkBalance() {
  const mnemonic = process.env.MIDNIGHT_WALLET_SEED
  if (!mnemonic) throw new Error('No MIDNIGHT_WALLET_SEED found in .env.local')

  const masterSeed = bip39.mnemonicToSeedSync(mnemonic.trim())
  const hdResult = HDWallet.fromSeed(masterSeed)
  const acct = hdResult.hdWallet.selectAccount(0)
  const role = acct.selectRole(Roles.NightExternal)
  const derivedKey = role.deriveKeyAt(0)
  const keystore = createKeystore(derivedKey.key, NetworkId.NetworkId.Preview)
  const publicKeys = PublicKey.fromKeyStore(keystore)

  const address = publicKeys.address

  console.log('Target Wallet Address:', address)
  console.log('Connecting to Midnight Preview Indexer (https://indexer.preview.midnight.network/api/v4/graphql)...')

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

  console.log('Syncing wallet state with on-chain UTXOs...')

  let latestState: any = null
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve()
    }, 12000)

    unshieldedWallet.state.subscribe({
      next: (s) => {
        latestState = s
        console.log(`[Sync Update] Coins count: ${s.availableCoins?.length || 0} | Sync: ${JSON.stringify(s.syncStatus)} | Balances: ${JSON.stringify(s.balances, (k, v) => typeof v === 'bigint' ? v.toString() : v)}`)
      },
      error: (e) => reject(e),
      complete: () => resolve()
    })
  })

  console.log('\n=================== MIDNIGHT PREVIEW WALLET BALANCE ===================')
  console.log(`Address:               ${address}`)
  console.log(`Total UTXOs on-chain:  ${latestState?.availableCoins?.length || 0}`)
  console.log('-----------------------------------------------------------------------')

  let totalRaw = 0n
  if (latestState?.availableCoins) {
    latestState.availableCoins.forEach((coin: any, idx: number) => {
      const val = BigInt(coin.utxo?.value || 0)
      totalRaw += val
      console.log(`UTXO #${idx + 1}: ${(Number(val) / 1e6).toLocaleString()} NIGHT (${val.toString()} raw units) | Intent: ${coin.utxo?.intentHash?.substring(0, 16)}... | OutputNo: ${coin.utxo?.outputNo}`)
    })
  }

  console.log('-----------------------------------------------------------------------')
  console.log(`TOTAL CONFIRMED BALANCE: ${(Number(totalRaw) / 1e6).toLocaleString()} NIGHT (${totalRaw.toString()} raw units)`)
  console.log('=======================================================================\n')

  process.exit(0)
}

checkBalance().catch(err => {
  console.error('Balance check failed:', err)
  process.exit(1)
})
