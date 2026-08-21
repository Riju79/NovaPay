/**
 * Centralized Transaction Lifecycle Manager for NovaPay
 * Handles states: IDLE -> PREPARING -> AWAITING_WALLET -> SUBMITTED -> CONFIRMING -> CONFIRMED (or FAILED / REJECTED)
 */

export type TransactionStatus =
  | 'IDLE'
  | 'PREPARING'
  | 'AWAITING_WALLET'
  | 'SUBMITTED'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'REJECTED'

export interface TransactionState {
  id: string
  status: TransactionStatus
  txHash?: string
  error?: string
  timestamp: number
  confirmationBlock?: number
  operationName?: string
}

type TxListener = (state: TransactionState) => void

export class TransactionManager {
  private state: TransactionState
  private listeners: Set<TxListener> = new Set()

  constructor(operationName = 'Transaction') {
    this.state = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: 'IDLE',
      timestamp: Date.now(),
      operationName,
    }
  }

  public getState(): TransactionState {
    return { ...this.state }
  }

  public subscribe(listener: TxListener): () => void {
    this.listeners.add(listener)
    listener(this.getState())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    const currentState = this.getState()
    this.listeners.forEach((listener) => listener(currentState))
  }

  public setPreparing() {
    this.state = {
      ...this.state,
      status: 'PREPARING',
      error: undefined,
      timestamp: Date.now(),
    }
    this.notify()
  }

  public setAwaitingWallet() {
    this.state = {
      ...this.state,
      status: 'AWAITING_WALLET',
      timestamp: Date.now(),
    }
    this.notify()
  }

  public setSubmitted(txHash: string) {
    this.state = {
      ...this.state,
      status: 'SUBMITTED',
      txHash,
      timestamp: Date.now(),
    }
    this.notify()
  }

  public setConfirming(txHash?: string) {
    this.state = {
      ...this.state,
      status: 'CONFIRMING',
      txHash: txHash || this.state.txHash,
      timestamp: Date.now(),
    }
    this.notify()
  }

  public setConfirmed(txHash?: string, confirmationBlock?: number) {
    this.state = {
      ...this.state,
      status: 'CONFIRMED',
      txHash: txHash || this.state.txHash,
      confirmationBlock,
      timestamp: Date.now(),
    }
    this.notify()
  }

  public setFailed(error: string) {
    this.state = {
      ...this.state,
      status: 'FAILED',
      error,
      timestamp: Date.now(),
    }
    this.notify()
  }

  public setRejected(error = 'Transaction was rejected in wallet.') {
    this.state = {
      ...this.state,
      status: 'REJECTED',
      error,
      timestamp: Date.now(),
    }
    this.notify()
  }

  public reset() {
    this.state = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: 'IDLE',
      timestamp: Date.now(),
      operationName: this.state.operationName,
    }
    this.notify()
  }
}
