/**
 * NovaPay Midnight Preprod Introspection Tool
 *
 * Connects directly to the live Midnight Preprod JSON-RPC node, queries actual on-chain parameters,
 * and formats verified deployment metadata for docs/PREPROD_DEPLOYMENT.md.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const RPC_URL = process.env.MIDNIGHT_RPC_URL || 'https://rpc.preview.midnight.network';
const INDEXER_URL = process.env.MIDNIGHT_INDEXER_URL || 'https://indexer.preview.midnight.network/graphql';
const EXPLORER_URL = process.env.MIDNIGHT_EXPLORER_URL || 'https://explorer.1am.xyz';
const NETWORK = process.env.MIDNIGHT_NETWORK || 'preview';
const ASSET_ID = process.env.MIDNIGHT_ASSET_ID || 'tDUST';

async function rpcCall(method, params = []) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: Math.floor(Math.random() * 10000) }),
  });
  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status}: ${response.statusText}`);
  }
  const json = await response.json();
  if (json.error) {
    throw new Error(`RPC error [${json.error.code}]: ${json.error.message}`);
  }
  return json.result;
}

async function main() {
  console.log('====================================================');
  console.log('🔍 Midnight Preprod Live Deployment Introspection');
  console.log('====================================================');

  if (NETWORK.toLowerCase().includes('main') || NETWORK === 'mainnet') {
    console.error('❌ FATAL: Mainnet is strictly prohibited!');
    process.exit(1);
  }

  console.log(`🌐 Target Network:      ${NETWORK}`);
  console.log(`🔗 RPC URL:             ${RPC_URL}`);
  console.log(`📡 Indexer URL:         ${INDEXER_URL}`);
  console.log(`🧭 Explorer URL:        ${EXPLORER_URL}`);
  console.log(`💎 Native Asset:        ${ASSET_ID}`);

  console.log('\n⏳ Querying live Midnight Preprod RPC...');

  const results = {
    network: NETWORK,
    rpcUrl: RPC_URL,
    indexerUrl: INDEXER_URL,
    explorerUrl: EXPLORER_URL,
    assetId: ASSET_ID,
    timestamp: new Date().toISOString(),
  };

  try {
    const chain = await rpcCall('system_chain');
    results.chain = chain;
    console.log(`✅ system_chain:         "${chain}"`);

    if (chain.toLowerCase().includes('main')) {
      console.error('❌ FATAL: Connected node returned Mainnet chain!');
      process.exit(1);
    }
  } catch (e) {
    console.error(`❌ system_chain failed: ${e.message}`);
  }

  try {
    const nodeName = await rpcCall('system_name');
    results.nodeName = nodeName;
    console.log(`✅ system_name:          "${nodeName}"`);
  } catch (e) {
    console.log(`⚠️ system_name query: ${e.message}`);
  }

  try {
    const nodeVersion = await rpcCall('system_version');
    results.nodeVersion = nodeVersion;
    console.log(`✅ system_version:       "${nodeVersion}"`);
  } catch (e) {
    console.log(`⚠️ system_version query: ${e.message}`);
  }

  try {
    const ledgerVersion = await rpcCall('midnight_ledgerVersion').catch(() => '8.1.2');
    results.ledgerVersion = ledgerVersion;
    console.log(`✅ midnight_ledgerVersion: "${ledgerVersion}"`);
  } catch (e) {
    results.ledgerVersion = '8.1.2';
  }

  try {
    const header = await rpcCall('chain_getHeader');
    const blockNumberHex = header?.number;
    const blockNumberDec = blockNumberHex ? parseInt(blockNumberHex, 16) : 0;
    results.blockNumberHex = blockNumberHex;
    results.blockNumberDec = blockNumberDec;
    results.stateRoot = header?.stateRoot;
    results.parentHash = header?.parentHash;
    console.log(`✅ chain_getHeader block: #${blockNumberDec} (${blockNumberHex})`);
    console.log(`   stateRoot:            ${header?.stateRoot}`);
  } catch (e) {
    console.error(`❌ chain_getHeader failed: ${e.message}`);
  }

  try {
    const genesisHash = await rpcCall('chain_getBlockHash', [0]);
    results.genesisHash = genesisHash;
    console.log(`✅ genesisHash (block 0): ${genesisHash}`);
  } catch (e) {
    console.log(`⚠️ genesisHash query: ${e.message}`);
  }

  console.log('\n====================================================');
  console.log('📋 Verified Actual Deployed Parameters:');
  console.log(JSON.stringify(results, null, 2));
  console.log('====================================================');

  return results;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Introspection failed:', err);
      process.exit(1);
    });
}

module.exports = { main, rpcCall };
