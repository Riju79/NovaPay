// Polyfill ECMAScript Iterator helpers for Node 20 environments
function setupIteratorHelpers(targetProto: any) {
  if (!targetProto) return
  if (!targetProto.toArray) {
    targetProto.toArray = function () {
      return Array.from(this)
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
import * as bip39 from '@scure/bip39'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
  const mnemonic = process.env.MIDNIGHT_WALLET_SEED
  if (!mnemonic) throw new Error('No MIDNIGHT_WALLET_SEED')
  
  const masterSeed = bip39.mnemonicToSeedSync(mnemonic.trim())
  const hdResult = HDWallet.fromSeed(masterSeed)
  if (hdResult.type !== 'seedOk') throw new Error('HDWallet failed')

  const acct = hdResult.hdWallet.selectAccount(0)
  const role = acct.selectRole(Roles.NightExternal)
  const derivedKey = role.deriveKeyAt(0)
  if (derivedKey.type !== 'keyDerived') throw new Error('Derive failed')

  const keystore = createKeystore(derivedKey.key, NetworkId.NetworkId.Preview)
  const publicKeys = PublicKey.fromKeyStore(keystore)

  console.log('📍 Address:', publicKeys.address)
  console.log('🔑 Public Key:', publicKeys.publicKey)

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
  console.log('Starting background sync via unshieldedWallet.start()...')
  await unshieldedWallet.start()
  
  console.log('Listening to wallet state updates for 15 seconds...')
  const sub = unshieldedWallet.state.subscribe({
    next: (s) => {
      console.log('--- State Update ---')
      console.log('isConnected:', s.progress?.isConnected)
      console.log('appliedId:', s.progress?.appliedId)
      console.log('highestTransactionId:', s.progress?.highestTransactionId)
      console.log('availableCoins:', s.availableCoins)
      console.log('balances:', s.balances)
    },
    error: (err) => console.error('Subscription error:', err)
  })

  await new Promise(r => setTimeout(r, 15000))
  sub.unsubscribe()
  unshieldedWallet.stop()
}

main().catch(console.error)
