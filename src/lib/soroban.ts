
import {
  Contract,
  Networks,
  rpc as SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  Address,
  xdr,
} from '@stellar/stellar-sdk'
import { signTransaction } from '@stellar/freighter-api'

// ─── Constants ────────────────────────────────────────────────────────────────

export const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org'
export const NETWORK_PASSPHRASE = Networks.TESTNET
export const ESCROW_CONTRACT_ID =
  (process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID ||
  'CA6K4WMGAL4KLNBVXSGHSSHE4TRGFZKXJG6P4MLTLYX2JYINBTRLTGWL').trim()

export const RECURRING_CONTRACT_ID =
  (process.env.NEXT_PUBLIC_RECURRING_CONTRACT_ID ||
  'CBD43KTR6FUCF6HTHPTFZLAYVN3XAVELNXVUZKIZGSYXAZIB2A3EKM5Y').trim()

// ─── RPC Singleton ────────────────────────────────────────────────────────────

let _rpc: SorobanRpc.Server | null = null

export function getRpc(): SorobanRpc.Server {
  if (!_rpc) {
    _rpc = new SorobanRpc.Server(SOROBAN_RPC_URL, { allowHttp: false })
  }
  return _rpc
}

// ─── SC Value Converters ──────────────────────────────────────────────────────

export function addressToScVal(publicKey: string): xdr.ScVal {
  return new Address(publicKey).toScVal()
}

export function amountToScVal(amount: number | bigint): xdr.ScVal {
  return nativeToScVal(BigInt(amount), { type: 'i128' })
}

export function u64ToScVal(value: number | bigint): xdr.ScVal {
  return nativeToScVal(BigInt(value), { type: 'u64' })
}

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface ContractCallResult {
  txHash: string
  success: boolean
  resultValue?: xdr.ScVal
  error?: string
}

// ─── Main Contract Invocation ─────────────────────────────────────────────────

export async function invokeContract(opts: {
  callerPublicKey: string
  contractId: string
  method: string
  args: xdr.ScVal[]
}): Promise<ContractCallResult> {
  if (!opts.contractId) {
    return {
      txHash: '',
      success: false,
      error: `Contract ID is not configured (missing env var). Method: ${opts.method}`,
    }
  }

  const rpc = getRpc()

  // Step 1: Fetch account with current sequence number
  const account = await rpc.getAccount(opts.callerPublicKey)

  // Step 2: Build contract handle
  const contract = new Contract(opts.contractId)

  // Step 3: Build transaction
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(opts.method, ...opts.args))
    .setTimeout(30)
    .build()

  // Step 4: Simulate
  const sim = await rpc.simulateTransaction(tx)
  if (SorobanRpc.Api.isSimulationError(sim)) {
    return { txHash: '', success: false, error: sim.error }
  }

  // Step 5: Assemble
  const assembled = SorobanRpc.assembleTransaction(tx, sim).build()

  // Step 6: Sign via Freighter
  const result = await signTransaction(assembled.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  })
  if ((result as any).error) {
    const errObj = (result as any).error
    const errMsg =
      typeof errObj === 'string'
        ? errObj
        : errObj?.message || 'User rejected signing'
    return { txHash: '', success: false, error: errMsg }
  }

  // Step 7: Reconstruct signed transaction
  const signedTx = TransactionBuilder.fromXDR(
    result.signedTxXdr,
    NETWORK_PASSPHRASE,
  )

  // Step 8: Submit
  const sendResult = await rpc.sendTransaction(signedTx)
  if (sendResult.status === 'ERROR') {
    return {
      txHash: sendResult.hash,
      success: false,
      error: JSON.stringify(sendResult.errorResult),
    }
  }

  // Step 9: Poll for confirmation
  const hash = sendResult.hash
  const MAX_ATTEMPTS = 30
  const POLL_INTERVAL_MS = 1000

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))

    const status = await rpc.getTransaction(hash)

    if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return {
        txHash: hash,
        success: true,
        resultValue: (status as SorobanRpc.Api.GetSuccessfulTransactionResponse)
          .returnValue,
      }
    }

    if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      return { txHash: hash, success: false, error: 'Transaction failed on-chain.' }
    }

    // NOT_FOUND means still pending — keep polling
  }

  // Step 10: Timeout
  return {
    txHash: hash,
    success: false,
    error: 'Transaction confirmation timed out.',
  }
}
