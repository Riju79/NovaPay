/**
 * Recurring Payment Contract Types for NovaPay
 */

export enum SubscriptionStatus {
  CREATED = 0,
  ACTIVE = 1,
  PAUSED = 2,
  CANCELLED = 3,
  COMPLETED = 4,
}

export type FrequencyType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

export interface SubscriptionDetails {
  id: string
  payer: string
  recipient: string
  amount: string // Display string in tDUST
  amountBaseUnits: bigint
  frequencySeconds: number
  frequencyLabel: string
  nextPaymentTime: number
  endTime: number
  maxPayments: number
  paymentCount: number
  status: SubscriptionStatus
  statusLabel: string
  nextPaymentFormatted: string
  endTimeFormatted: string
}

export interface CreateSubscriptionParams {
  recipientAddress: string
  amountTDust: string
  frequency: FrequencyType
  maxPayments?: number
  durationDays?: number
}
