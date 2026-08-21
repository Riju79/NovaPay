/**
 * Escrow Contract Types for NovaPay
 */

export enum EscrowStatus {
  CREATED = 0,
  FUNDED = 1,
  LOCKED = 2,
  RELEASED = 3,
  REFUNDED = 4,
  CANCELLED = 5,
  DISPUTED = 6,
}

export interface EscrowDetails {
  id: string
  payer: string
  payee: string
  arbiter: string
  amount: string // Display string in tDUST
  amountBaseUnits: bigint
  status: EscrowStatus
  statusLabel: string
  createdAt: number
  deadline: number
  createdAtFormatted: string
  deadlineFormatted: string
}

export interface CreateEscrowParams {
  payeeAddress: string
  arbiterAddress?: string
  amountTDust: string
  deadlineDays?: number
}
