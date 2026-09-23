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
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import crypto from 'crypto'
import { firstValueFrom } from 'rxjs'

export interface DerivedWallet {
  mnemonic: string
  mnemonicSha256: string
  address: string
  coinPublicKeyHex: string
  encryptionPublicKeyHex: string
  networkId: string
  isFreshlyGenerated: boolean
}

/**
 * Single source of truth for Midnight wallet derivation (Preview & Preprod).
 * Rules:
 * 1. Reads MIDNIGHT_WALLET_SEED from .env.local.
 * 2. If missing or invalid (<12 words), generates a new 24-word mnemonic and persists it to .env.local immediately.
 * 3. Never overwrites an existing valid seed.
 * 4. Deterministically derives the unshielded Bech32 address (mn_addr_preprod1... or mn_addr_preview1...) and keys.
 */
export async function getOrDeriveWallet(): Promise<DerivedWallet> {
  const envLocalPath = path.resolve(process.cwd(), '.env.local')
  const serverEnvPath = path.resolve(process.cwd(), 'server', '.env')

  let currentEnvContent = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, 'utf8') : ''
  const seedMatch = currentEnvContent.match(/^MIDNIGHT_WALLET_SEED=["']?([^"'\r\n]+)["']?/m)

  const networkTarget = (
    process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK ||
    process.env.MIDNIGHT_NETWORK ||
    'preview'
  ).toLowerCase()
  const isPreprod = networkTarget === 'preprod'
  const targetNetworkId = isPreprod ? NetworkId.NetworkId.PreProd : NetworkId.NetworkId.Preview
  const indexerHttpUrl = isPreprod
    ? 'https://indexer.preprod.midnight.network/api/v4/graphql'
    : 'https://indexer.preview.midnight.network/api/v4/graphql'

  let mnemonic: string
  let isFreshlyGenerated = false

  if (seedMatch && seedMatch[1] && seedMatch[1].trim().split(/\s+/).length >= 12) {
    mnemonic = seedMatch[1].trim()
  } else {
    // Generate new 24-word BIP-39 mnemonic (256 bits of entropy)
    mnemonic = bip39.generateMnemonic(wordlist, 256).trim()
    isFreshlyGenerated = true

    // PERSIST IMMEDIATELY before doing anything else
    if (fs.existsSync(envLocalPath)) {
      let content = fs.readFileSync(envLocalPath, 'utf8')
      const regex = new RegExp(`^MIDNIGHT_WALLET_SEED=.*$`, 'm')
      if (regex.test(content)) {
        content = content.replace(regex, `MIDNIGHT_WALLET_SEED="${mnemonic}"`)
      } else {
        content += `\nMIDNIGHT_WALLET_SEED="${mnemonic}"`
      }
      fs.writeFileSync(envLocalPath, content, 'utf8')
    }
  }

  // Derive master seed
  const masterSeed = bip39.mnemonicToSeedSync(mnemonic)
  const hdResult = HDWallet.fromSeed(masterSeed)
  if (hdResult.type !== 'seedOk') {
    throw new Error(`HDWallet initialization failed: ${hdResult.error}`)
  }

  // Account 0, Role NightExternal (Role 0), Key Index 0
  const acct = hdResult.hdWallet.selectAccount(0)
  const role = acct.selectRole(Roles.NightExternal)
  const derivedKey = role.deriveKeyAt(0)
  if (derivedKey.type !== 'keyDerived') {
    throw new Error('Key derivation failed at index 0')
  }

  // Create Keystore with targetNetworkId
  const keystore = createKeystore(derivedKey.key, targetNetworkId)
  const publicKeys = PublicKey.fromKeyStore(keystore)

  // Derive Shielded Encryption Key
  const shieldedSeed = masterSeed.subarray(0, 32)
  const SWClass = ShieldedWallet({
    networkId: targetNetworkId,
    indexerClientConnection: { indexerHttpUrl },
    txHistoryStorage: new NoOpTransactionHistoryStorage()
  })
  const shieldedWallet = SWClass.startWithSeed(shieldedSeed)
  const shieldedState = await firstValueFrom(shieldedWallet.state)
  shieldedWallet.stop()

  const address = publicKeys.address
  const coinPublicKeyHex = publicKeys.publicKey
  const encryptionPublicKeyHex = shieldedState.encryptionPublicKey.data.toString('hex')
  const mnemonicSha256 = crypto.createHash('sha256').update(mnemonic).digest('hex')

  // Synchronize MIDNIGHT_DEPLOYER_ADDRESS in .env files
  function updateAddress(filePath: string) {
    if (!fs.existsSync(filePath)) return
    let c = fs.readFileSync(filePath, 'utf8')
    const r = new RegExp(`^MIDNIGHT_DEPLOYER_ADDRESS=.*$`, 'm')
    if (r.test(c)) {
      c = c.replace(r, `MIDNIGHT_DEPLOYER_ADDRESS="${address}"`)
    } else {
      c += `\nMIDNIGHT_DEPLOYER_ADDRESS="${address}"`
    }
    fs.writeFileSync(filePath, c, 'utf8')
  }

  updateAddress(envLocalPath)
  updateAddress(serverEnvPath)

  return {
    mnemonic,
    mnemonicSha256,
    address,
    coinPublicKeyHex,
    encryptionPublicKeyHex,
    networkId: isPreprod ? 'preprod' : 'preview',
    isFreshlyGenerated
  }
}

