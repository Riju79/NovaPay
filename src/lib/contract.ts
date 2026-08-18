import {
  invokeContract,
  addressToScVal,
  amountToScVal,
  u64ToScVal,
  ESCROW_CONTRACT_ID,
  RECURRING_CONTRACT_ID,
  ContractCallResult,
  ValueContainer,
} from './midnight'

// ─── Native Midnight Token Reference ──────────────────────────────────────────

export const NATIVE_TOKEN_TESTNET =
  process.env.NEXT_PUBLIC_NATIVE_TOKEN_ADDRESS || 'token_native_midnight_tDUST'

export const MIDNIGHT_TOKEN_TESTNET = NATIVE_TOKEN_TESTNET
export const XLM_SAC_TESTNET = NATIVE_TOKEN_TESTNET // Alias for legacy code

// ─── Unit Converters (tDUST micro-units, 1 tDUST = 1,000,000 microDUST) ──────

export function tDustToMicro(amount: string | number): number {
  return Math.round(Number(amount) * 1_000_000)
}

export function microToTDust(amount: number): string {
  return (amount / 1_000_000).toFixed(4)
}

// Backward compatibility helper aliases
export const xlmToStroops = tDustToMicro
export const stroopsToXlm = microToTDust

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
): Promise<any> {
  return {
    payer: callerPublicKey,
    status: 'ACTIVE',
    initialized: true,
  }
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
): Promise<any> {
  return {
    payer: callerPublicKey,
    active: true,
    limit: 1000,
  }
}

