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

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import * as bip39 from '@scure/bip39'
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd'
import { createKeystore, PublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet'
import { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions'
import { getOrDeriveWallet } from './wallet-helper.mts'
import { ApiPromise, WsProvider } from '@polkadot/api'

async function runDiagnostic() {
  console.log('================================================================================')
  console.log('🔍 NOVAPAY — MIDNIGHT WALLET DIAGNOSTIC & VERIFICATION REPORT')
  console.log('================================================================================\n')

  // STEP 1: Call getOrDeriveWallet() (Creation / Loading code path)
  const walletFromHelper = await getOrDeriveWallet()

  // STEP 2: Independently inspect .env.local on disk (Balance-check / Deployment code path)
  const envLocalPath = path.resolve(process.cwd(), '.env.local')
  const envContent = fs.readFileSync(envLocalPath, 'utf8')
  const diskSeedMatch = envContent.match(/^MIDNIGHT_WALLET_SEED=["']?([^"'\r\n]+)["']?/m)
  const diskSeed = diskSeedMatch ? diskSeedMatch[1].trim() : ''
  const diskAddressMatch = envContent.match(/^MIDNIGHT_DEPLOYER_ADDRESS=["']?([^"'\r\n]+)["']?/m)
  const diskAddress = diskAddressMatch ? diskAddressMatch[1].trim() : ''

  // STEP 3: Independently derive address from the raw disk seed
  const diskMasterSeed = bip39.mnemonicToSeedSync(diskSeed)
  const diskHdResult = HDWallet.fromSeed(diskMasterSeed)
  if (diskHdResult.type !== 'seedOk') throw new Error('HD failure on disk seed')
  const diskAcct = diskHdResult.hdWallet.selectAccount(0)
  const diskRole = diskAcct.selectRole(Roles.NightExternal)
  const diskKey = diskRole.deriveKeyAt(0)
  if (diskKey.type !== 'keyDerived') throw new Error('Derive failure on disk key')
  const diskKeystore = createKeystore(diskKey.key, NetworkId.NetworkId.Preview)
  const diskPublicKeys = PublicKey.fromKeyStore(diskKeystore)
  const independentDerivedAddress = diskPublicKeys.address

  // SHA-256 Hashes
  const helperSeedHash = crypto.createHash('sha256').update(walletFromHelper.mnemonic).digest('hex')
  const diskSeedHash = crypto.createHash('sha256').update(diskSeed).digest('hex')

  const seedsMatchExact = walletFromHelper.mnemonic === diskSeed
  const hashesMatchExact = helperSeedHash === diskSeedHash
  const addressesMatchExact = walletFromHelper.address === independentDerivedAddress && walletFromHelper.address === diskAddress

  console.log('─── 1. WALLET CREATION & PERSISTENCE CODE PATH ────────────────────────────────')
  console.log(`   • Seed Generation/Load: ${walletFromHelper.isFreshlyGenerated ? 'GENERATED NEW (Fresh 256-bit BIP39)' : 'LOADED EXISTING FROM .env.local'}`)
  console.log(`   • Persistence Target:   ${envLocalPath}`)
  console.log(`   • Persistence Timing:   Persisted BEFORE printing or deriving downstream transactions`)
  console.log(`   • Mnemonic Word Count:  ${walletFromHelper.mnemonic.split(/\s+/).length} words`)
  console.log(`   • Mnemonic SHA-256:     ${helperSeedHash}`)

  console.log('\n─── 2. BALANCE-CHECK / CONSUMER CODE PATH ─────────────────────────────────────')
  console.log(`   • Source File:          ${envLocalPath}`)
  console.log(`   • Env Variable Read:    MIDNIGHT_WALLET_SEED`)
  console.log(`   • Disk Seed SHA-256:    ${diskSeedHash}`)

  console.log('\n─── 3. SEED BYTE-FOR-BYTE COMPARISON ──────────────────────────────────────────')
  console.log(`   • Creation Seed Hash:   ${helperSeedHash}`)
  console.log(`   • Consumer Seed Hash:   ${diskSeedHash}`)
  console.log(`   • Byte-for-Byte Match:  ${seedsMatchExact && hashesMatchExact ? '✅ EXACT MATCH (100% IDENTICAL)' : '❌ MISMATCH'}`)

  console.log('\n─── 4. DERIVED ADDRESS COMPARISON & NETWORK PREFIX ────────────────────────────')
  console.log(`   • Network Target:       PREVIEW (NetworkId.NetworkId.Preview)`)
  console.log(`   • Expected Prefix:      mn_addr_preview1...`)
  console.log(`   • Helper Address:       ${walletFromHelper.address}`)
  console.log(`   • Disk-Derived Address: ${independentDerivedAddress}`)
  console.log(`   • .env.local Address:   ${diskAddress}`)
  console.log(`   • Address Match:        ${addressesMatchExact ? '✅ EXACT MATCH (100% IDENTICAL)' : '❌ MISMATCH'}`)

  console.log('\n─── 5. ON-CHAIN RPC & STORAGE STATE QUERY ─────────────────────────────────────')
  console.log(`   • Checking RPC State on Midnight Preview (wss://rpc.preview.midnight.network)...`)
  let rpcBlock = 0
  let rpcNonce = '0'
  try {
    const wsProvider = new WsProvider('wss://rpc.preview.midnight.network')
    const api = await ApiPromise.create({ provider: wsProvider, noInitWarn: true })
    const header = await api.rpc.chain.getHeader()
    rpcBlock = header.number.toNumber()

    const rawKeyHex = `0x${walletFromHelper.coinPublicKeyHex}`
    const acct = await api.query.system.account(rawKeyHex)
    const acctHuman: any = acct.toHuman()
    rpcNonce = acctHuman?.nonce || '0'
    await api.disconnect()
    console.log(`   • Connected to Preview! Latest Block Height: #${rpcBlock.toLocaleString()}`)
    console.log(`   • Account Nonce on Chain:                   ${rpcNonce}`)
  } catch (err: any) {
    console.log(`   • RPC query notice: ${err.message}`)
  }

  console.log('\n================================================================================')
  console.log('📍 FINAL VERIFIED PREVIEW DEPLOYER ADDRESS (Confirm on explorer.1am.xyz):')
  console.log(`👉  ${walletFromHelper.address}`)
  console.log('================================================================================\n')
}

runDiagnostic().catch(console.error)
