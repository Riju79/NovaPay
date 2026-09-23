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

import * as bip39 from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd'
import { createKeystore, PublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet'
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded'
import { NoOpTransactionHistoryStorage, NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { firstValueFrom } from 'rxjs'

const TOTAL_WALLETS = 80
const NETWORK = 'preprod'
const TARGET_NETWORK_ID = NetworkId.NetworkId.PreProd
const INDEXER_HTTP_URL = 'https://indexer.preprod.midnight.network/api/v4/graphql'
const OUTPUT_FILE = path.resolve(process.cwd(), 'preprod-wallets.json')
const OUTPUT_CSV = path.resolve(process.cwd(), 'preprod-wallets.csv')

interface WalletEntry {
  index: number
  mnemonic: string
  mnemonicSha256: string
  unshieldedAddress: string
  encryptionPublicKeyHex: string
  coinPublicKeyHex: string
  network: string
}

async function deriveWalletFromMnemonic(mnemonic: string, index: number): Promise<WalletEntry> {
  const masterSeed = bip39.mnemonicToSeedSync(mnemonic)

  const hdResult = HDWallet.fromSeed(masterSeed)
  if (hdResult.type !== 'seedOk') {
    throw new Error(`HDWallet init failed for wallet ${index}: ${hdResult.error}`)
  }

  const acct = hdResult.hdWallet.selectAccount(0)
  const role = acct.selectRole(Roles.NightExternal)
  const derivedKey = role.deriveKeyAt(0)
  if (derivedKey.type !== 'keyDerived') {
    throw new Error(`Key derivation failed for wallet ${index}`)
  }

  const keystore = createKeystore(derivedKey.key, TARGET_NETWORK_ID)
  const publicKeys = PublicKey.fromKeyStore(keystore)

  const shieldedSeed = masterSeed.subarray(0, 32)
  const SWClass = ShieldedWallet({
    networkId: TARGET_NETWORK_ID,
    indexerClientConnection: { indexerHttpUrl: INDEXER_HTTP_URL },
    txHistoryStorage: new NoOpTransactionHistoryStorage()
  })
  const shieldedWallet = SWClass.startWithSeed(shieldedSeed)
  const shieldedState = await firstValueFrom(shieldedWallet.state)
  shieldedWallet.stop()

  const mnemonicSha256 = crypto.createHash('sha256').update(mnemonic).digest('hex')

  return {
    index,
    mnemonic,
    mnemonicSha256,
    unshieldedAddress: publicKeys.address,
    encryptionPublicKeyHex: shieldedState.encryptionPublicKey.data.toString('hex'),
    coinPublicKeyHex: publicKeys.publicKey,
    network: NETWORK
  }
}

async function main() {
  console.log(`\n🌙 Midnight Preprod Batch Wallet Generator`)
  console.log(`   Generating ${TOTAL_WALLETS} unique wallets on ${NETWORK.toUpperCase()}...`)
  console.log(`   Network ID: ${TARGET_NETWORK_ID}\n`)

  const wallets: WalletEntry[] = []
  const usedMnemonics = new Set<string>()

  for (let i = 1; i <= TOTAL_WALLETS; i++) {
    process.stdout.write(`   [${i.toString().padStart(2, '0')}/${TOTAL_WALLETS}] Generating wallet... `)

    // Generate a unique 24-word BIP-39 mnemonic (256 bits entropy)
    let mnemonic: string
    do {
      mnemonic = bip39.generateMnemonic(wordlist, 256).trim()
    } while (usedMnemonics.has(mnemonic))
    usedMnemonics.add(mnemonic)

    try {
      const wallet = await deriveWalletFromMnemonic(mnemonic, i)
      wallets.push(wallet)
      console.log(`✅ ${wallet.unshieldedAddress.slice(0, 30)}...`)
    } catch (err: any) {
      console.log(`❌ FAILED: ${err.message}`)
      wallets.push({
        index: i,
        mnemonic,
        mnemonicSha256: '',
        unshieldedAddress: 'DERIVATION_FAILED',
        encryptionPublicKeyHex: '',
        coinPublicKeyHex: '',
        network: NETWORK
      })
    }
  }

  // Write JSON output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(wallets, null, 2), 'utf8')
  console.log(`\n💾 JSON saved → ${OUTPUT_FILE}`)

  // Write CSV output
  const csvHeader = 'index,unshielded_address,encryption_public_key_hex,coin_public_key_hex,network,mnemonic\n'
  const csvRows = wallets
    .map(w =>
      [
        w.index,
        w.unshieldedAddress,
        w.encryptionPublicKeyHex,
        w.coinPublicKeyHex,
        w.network,
        `"${w.mnemonic}"`
      ].join(',')
    )
    .join('\n')
  fs.writeFileSync(OUTPUT_CSV, csvHeader + csvRows, 'utf8')
  console.log(`💾 CSV  saved → ${OUTPUT_CSV}`)

  const successful = wallets.filter(w => w.unshieldedAddress !== 'DERIVATION_FAILED').length
  console.log(`\n✅ Done! ${successful}/${TOTAL_WALLETS} wallets generated successfully.\n`)

  // Print summary table
  console.log('Index | Unshielded Address (first 42 chars)')
  console.log('------+-----------------------------------------------')
  wallets.forEach(w => {
    const addr = w.unshieldedAddress.slice(0, 42)
    console.log(`  ${w.index.toString().padStart(2, ' ')}  | ${addr}...`)
  })
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
