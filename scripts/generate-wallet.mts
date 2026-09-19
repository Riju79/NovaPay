import * as bip39 from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { HDWallet, Roles, createKeystore, PublicKey, NetworkId } from '@midnight-ntwrk/wallet-sdk'
import fs from 'fs'
import path from 'path'

// Generate 24-word mnemonic (256 bits of entropy)
const mnemonic = bip39.generateMnemonic(wordlist, 256)
const masterSeed = bip39.mnemonicToSeedSync(mnemonic)

const hdResult = HDWallet.fromSeed(masterSeed)
if (hdResult.type !== 'seedOk') {
  throw new Error('HDWallet initialization failed')
}

const acct = hdResult.hdWallet.selectAccount(0)
const role = acct.selectRole(Roles.NightExternal)
const derivedKey = role.deriveKeyAt(0)
if (derivedKey.type !== 'keyDerived') {
  throw new Error('Key derivation failed')
}

const keystore = createKeystore(derivedKey.key, NetworkId.NetworkId.Preview)
const publicKeys = PublicKey.fromKeyStore(keystore)

console.log('======================================================================')
console.log('🔑 NOVA PAY — NEW MIDNIGHT PREVIEW DEPLOYER WALLET')
console.log('======================================================================')
console.log('📍 Unshielded Address:', publicKeys.address)
console.log('🔑 Coin Public Key:   ', publicKeys.publicKey)
console.log('🔒 24-Word Mnemonic:  ', mnemonic)
console.log('======================================================================')

// Update .env.local and server/.env
const envLocalPath = path.resolve(process.cwd(), '.env.local')
const serverEnvPath = path.resolve(process.cwd(), 'server', '.env')

function updateEnv(filePath: string, key: string, value: string) {
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

updateEnv(envLocalPath, 'MIDNIGHT_WALLET_SEED', `"${mnemonic}"`)
updateEnv(envLocalPath, 'MIDNIGHT_DEPLOYER_ADDRESS', `"${publicKeys.address}"`)

updateEnv(serverEnvPath, 'MIDNIGHT_DEPLOYER_ADDRESS', `"${publicKeys.address}"`)

console.log('✅ Updated .env.local and server/.env with the new deployer wallet!')
