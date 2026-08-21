/**
 * NovaPay Contract & Frontend Integration Abstraction Layer
 * Direct connection between compiled Compact Smart Contracts and NovaPay Frontend.
 */

import {
  invokeContract,
  addressToScVal,
  amountToScVal,
  u64ToScVal,
  ESCROW_CONTRACT_ID,
  RECURRING_CONTRACT_ID,
  ContractCallResult,
} from './midnight'

import { EscrowService } from '@/contracts/escrow/service'
import { RecurringService } from '@/contracts/recurring/service'

// Import compiled Compact smart contract classes directly
// @ts-ignore - JavaScript compiled contract artifact
import { Contract as CompiledEscrowContract } from '../../contracts/escrow/managed/contract/index.js'
// @ts-ignore - JavaScript compiled contract artifact
import { Contract as CompiledRecurringContract } from '../../contracts/recurring/managed/contract/index.js'

export const EscrowContract = CompiledEscrowContract
export const RecurringContract = CompiledRecurringContract

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

// ─── Escrow Contract Entry Points ─────────────────────────────────────────────

export async function escrowInitialize(params: {
  callerPublicKey: string
  payer: string
  recipient: string
  arbiter: string
  tokenAddress: string
  amountStroops: number
}): Promise<ContractCallResult> {
  try {
    const amountTDust = (params.amountStroops / 1_000_000).toString()
    const { escrowId, txHash } = await EscrowService.createEscrow(
      {
        payeeAddress: params.recipient,
        arbiterAddress: params.arbiter,
        amountTDust,
        deadlineDays: 7,
      },
      params.payer
    )
    return {
      txHash,
      success: true,
      resultValue: { escrowId, contractId: ESCROW_CONTRACT_ID },
    }
  } catch (err: any) {
    return {
      txHash: '',
      success: false,
      error: err?.message || 'Escrow initialization failed',
    }
  }
}

export async function escrowDeposit(
  callerPublicKey: string,
  escrowId = 'escrow_active'
): Promise<ContractCallResult> {
  try {
    const { txHash } = await EscrowService.fundEscrow(escrowId, callerPublicKey)
    return { txHash, success: true }
  } catch (err: any) {
    return { txHash: '', success: false, error: err?.message }
  }
}

export async function escrowApprove(
  callerPublicKey: string,
  escrowId = 'escrow_active'
): Promise<ContractCallResult> {
  try {
    const { txHash } = await EscrowService.releaseEscrow(escrowId, callerPublicKey)
    return { txHash, success: true }
  } catch (err: any) {
    return { txHash: '', success: false, error: err?.message }
  }
}

export async function escrowRefund(
  callerPublicKey: string,
  escrowId = 'escrow_active'
): Promise<ContractCallResult> {
  try {
    const { txHash } = await EscrowService.refundEscrow(escrowId, callerPublicKey)
    return { txHash, success: true }
  } catch (err: any) {
    return { txHash: '', success: false, error: err?.message }
  }
}

export async function escrowGetState(callerPublicKey: string): Promise<any> {
  const escrows = await EscrowService.fetchEscrows(callerPublicKey)
  return escrows.length > 0 ? escrows[0] : { payer: callerPublicKey, status: 'ACTIVE', initialized: true }
}

// ─── Recurring Billing Contract Entry Points ──────────────────────────────────

export async function recurringInitialize(params: {
  callerPublicKey: string
  payer: string
  payee: string
  tokenAddress: string
  limitStroops: number
  intervalSeconds: number
}): Promise<ContractCallResult> {
  try {
    const amountTDust = (params.limitStroops / 1_000_000).toString()
    const { subscriptionId, txHash } = await RecurringService.createSubscription(
      {
        recipientAddress: params.payee,
        amountTDust,
        frequency: 'MONTHLY',
        durationDays: 365,
      },
      params.payer
    )
    return {
      txHash,
      success: true,
      resultValue: { subscriptionId, contractId: RECURRING_CONTRACT_ID },
    }
  } catch (err: any) {
    return { txHash: '', success: false, error: err?.message }
  }
}

export async function recurringCharge(
  callerPublicKey: string,
  amountOrSubId?: number | string
): Promise<ContractCallResult> {
  const subId = typeof amountOrSubId === 'string' ? amountOrSubId : 'sub_active'
  try {
    const { txHash } = await RecurringService.executePayment(subId, callerPublicKey)
    return { txHash, success: true }
  } catch (err: any) {
    return { txHash: '', success: false, error: err?.message }
  }
}

export async function recurringCancel(
  callerPublicKey: string,
  subscriptionId = 'sub_active'
): Promise<ContractCallResult> {
  try {
    const { txHash } = await RecurringService.cancelSubscription(subscriptionId, callerPublicKey)
    return { txHash, success: true }
  } catch (err: any) {
    return { txHash: '', success: false, error: err?.message }
  }
}

export async function recurringGetConfig(callerPublicKey: string): Promise<any> {
  const subs = await RecurringService.fetchSubscriptions(callerPublicKey)
  return subs.length > 0 ? subs[0] : { payer: callerPublicKey, active: true, limit: 1000 }
}
