import {
  rpc as SorobanRpc,
  TransactionBuilder,
  Contract,
  BASE_FEE,
  xdr,
} from '@stellar/stellar-sdk'
import {
  invokeContract,
  getRpc,
  addressToScVal,
  amountToScVal,
  u64ToScVal,
  NETWORK_PASSPHRASE,
  ESCROW_CONTRACT_ID,
  RECURRING_CONTRACT_ID,
  ContractCallResult,
} from './soroban'

// ─── XLM Stellar Asset Contract on Testnet ────────────────────────────────────

export const XLM_SAC_TESTNET =
  'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'

// ─── Unit Converters ──────────────────────────────────────────────────────────

export function xlmToStroops(xlm: string | number): number {
  return Math.round(Number(xlm) * 10_000_000)
}

export function stroopsToXlm(stroops: number): string {
  return (stroops / 10_000_000).toFixed(7)
}

// ─── Escrow Contract Functions ────────────────────────────────────────────────

export async function escrowInitialize(params: {
  callerPublicKey: string
  payer: string
  recipient: string
  arbiter: string
  tokenAddress: string
  amountStroops: number
}): Promise<ContractCallResult> {
  return invokeContract({
    callerPublicKey: params.callerPublicKey,
    contractId: ESCROW_CONTRACT_ID,
    method: 'initialize',
    args: [
      addressToScVal(params.payer),
      addressToScVal(params.recipient),
      addressToScVal(params.arbiter),
      addressToScVal(params.tokenAddress),
      amountToScVal(params.amountStroops),
    ],
  })
}

export async function escrowDeposit(
  callerPublicKey: string,
): Promise<ContractCallResult> {
  return invokeContract({
    callerPublicKey,
    contractId: ESCROW_CONTRACT_ID,
    method: 'deposit',
    args: [],
  })
}

export async function escrowApprove(
  callerPublicKey: string,
): Promise<ContractCallResult> {
  return invokeContract({
    callerPublicKey,
    contractId: ESCROW_CONTRACT_ID,
    method: 'approve',
    args: [addressToScVal(callerPublicKey)],
  })
}

export async function escrowRefund(
  callerPublicKey: string,
): Promise<ContractCallResult> {
  return invokeContract({
    callerPublicKey,
    contractId: ESCROW_CONTRACT_ID,
    method: 'refund',
    args: [addressToScVal(callerPublicKey)],
  })
}

export async function escrowGetState(
  callerPublicKey: string,
): Promise<xdr.ScVal | undefined> {
  const rpc = getRpc()
  const account = await rpc.getAccount(callerPublicKey)
  const contract = new Contract(ESCROW_CONTRACT_ID)

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('get_state'))
    .setTimeout(30)
    .build()

  const sim = await rpc.simulateTransaction(tx)

  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`get_state simulation failed: ${(sim as any).error}`)
  }

  return (sim as SorobanRpc.Api.SimulateTransactionSuccessResponse).result
    ?.retval
}

// ─── Recurring Billing Contract Functions ─────────────────────────────────────

export async function recurringInitialize(params: {
  callerPublicKey: string
  payer: string
  payee: string
  tokenAddress: string
  limitStroops: number
  intervalSeconds: number
}): Promise<ContractCallResult> {
  return invokeContract({
    callerPublicKey: params.callerPublicKey,
    contractId: RECURRING_CONTRACT_ID,
    method: 'initialize',
    args: [
      addressToScVal(params.payer),
      addressToScVal(params.payee),
      addressToScVal(params.tokenAddress),
      amountToScVal(params.limitStroops),
      u64ToScVal(params.intervalSeconds),
    ],
  })
}

export async function recurringCharge(
  callerPublicKey: string,
  amountStroops: number,
): Promise<ContractCallResult> {
  return invokeContract({
    callerPublicKey,
    contractId: RECURRING_CONTRACT_ID,
    method: 'charge',
    args: [amountToScVal(amountStroops)],
  })
}

export async function recurringCancel(
  callerPublicKey: string,
): Promise<ContractCallResult> {
  return invokeContract({
    callerPublicKey,
    contractId: RECURRING_CONTRACT_ID,
    method: 'cancel',
    args: [addressToScVal(callerPublicKey)],
  })
}

export async function recurringGetConfig(
  callerPublicKey: string,
): Promise<xdr.ScVal | undefined> {
  const rpc = getRpc()
  const account = await rpc.getAccount(callerPublicKey)
  const contract = new Contract(RECURRING_CONTRACT_ID)

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('get_config'))
    .setTimeout(30)
    .build()

  const sim = await rpc.simulateTransaction(tx)

  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`get_config simulation failed: ${(sim as any).error}`)
  }

  return (sim as SorobanRpc.Api.SimulateTransactionSuccessResponse).result
    ?.retval
}
