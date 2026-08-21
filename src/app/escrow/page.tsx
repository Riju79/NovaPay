'use client'

import React, { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { useMidnightWallet } from '@/context/MidnightWalletContext'
import { EscrowService } from '@/contracts/escrow/service'
import { EscrowDetails, EscrowStatus } from '@/contracts/escrow/types'
import { TransactionManager, TransactionState } from '@/transactions/transactionManager'
import {
  ShieldCheck,
  PlusCircle,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Lock,
  Unlock,
  RotateCcw,
  Ban
} from 'lucide-react'

export default function EscrowPage() {
  const { wallet, isConnected, connect } = useMidnightWallet()
  const walletAddress = wallet?.address || ''

  const [escrows, setEscrows] = useState<EscrowDetails[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Create Form State
  const [payee, setPayee] = useState('')
  const [arbiter, setArbiter] = useState('')
  const [amount, setAmount] = useState('')
  const [deadlineDays, setDeadlineDays] = useState(7)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Transaction State
  const [txState, setTxState] = useState<TransactionState | null>(null)
  const [activeActionId, setActiveActionId] = useState<string | null>(null)

  useEffect(() => {
    if (walletAddress) {
      loadEscrows()
    }
  }, [walletAddress])

  const loadEscrows = async () => {
    setIsLoading(true)
    try {
      const list = await EscrowService.fetchEscrows(walletAddress)
      setEscrows(list)
    } catch (err) {
      console.warn('Failed to load escrows:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateEscrow = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isConnected || !walletAddress) {
      connect('1am')
      return
    }

    const txManager = new TransactionManager('Create Escrow')
    const unsubscribe = txManager.subscribe(setTxState)

    try {
      await EscrowService.createEscrow(
        {
          payeeAddress: payee,
          arbiterAddress: arbiter || walletAddress,
          amountTDust: amount,
          deadlineDays,
        },
        walletAddress,
        txManager
      )
      setShowCreateModal(false)
      setPayee('')
      setArbiter('')
      setAmount('')
      loadEscrows()
    } catch (err) {
      console.error('Create escrow error:', err)
    } finally {
      unsubscribe()
    }
  }

  const handleAction = async (escrowId: string, actionName: 'fund' | 'lock' | 'release' | 'refund' | 'cancel') => {
    if (!walletAddress) return
    setActiveActionId(escrowId)

    const txManager = new TransactionManager(`${actionName.toUpperCase()} Escrow`)
    const unsubscribe = txManager.subscribe(setTxState)

    try {
      if (actionName === 'fund') await EscrowService.fundEscrow(escrowId, walletAddress, txManager)
      else if (actionName === 'release') await EscrowService.releaseEscrow(escrowId, walletAddress, txManager)
      else if (actionName === 'refund') await EscrowService.refundEscrow(escrowId, walletAddress, txManager)
      else if (actionName === 'cancel') await EscrowService.cancelEscrow(escrowId, walletAddress, txManager)

      await loadEscrows()
    } catch (err) {
      console.error(`Escrow ${actionName} error:`, err)
    } finally {
      setActiveActionId(null)
      unsubscribe()
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-cyan-400" />
              Midnight Escrow Services
            </h1>
            <p className="text-slate-400 mt-1">
              Secure, zero-knowledge conditional payment contracts on Midnight Network.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all duration-200 shadow-lg shadow-cyan-500/20"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            Create Escrow
          </button>
        </div>

        {/* Transaction Status Overlay */}
        {txState && txState.status !== 'IDLE' && (
          <div className="mb-6 p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/40 text-cyan-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {txState.status === 'CONFIRMED' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              ) : txState.status === 'FAILED' || txState.status === 'REJECTED' ? (
                <XCircle className="w-6 h-6 text-rose-400" />
              ) : (
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              )}
              <div>
                <span className="font-semibold">{txState.operationName}: </span>
                <span>{txState.status}</span>
                {txState.txHash && (
                  <span className="text-xs font-mono ml-2 block sm:inline text-slate-400">
                    (Tx: {txState.txHash.slice(0, 16)}...)
                  </span>
                )}
                {txState.error && <p className="text-xs text-rose-400 mt-1">{txState.error}</p>}
              </div>
            </div>
            {(txState.status === 'CONFIRMED' || txState.status === 'FAILED' || txState.status === 'REJECTED') && (
              <button
                onClick={() => setTxState(null)}
                className="text-xs px-3 py-1 rounded bg-slate-800 hover:bg-slate-700"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* Escrow List */}
        {!isConnected ? (
          <div className="p-12 rounded-2xl border border-slate-800 bg-slate-900/50 text-center max-w-xl mx-auto my-12">
            <ShieldCheck className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-100">Connect Midnight Wallet</h3>
            <p className="text-slate-400 mt-2 mb-6">
              Connect your 1AM Midnight wallet to view and manage smart contract escrows.
            </p>
            <button
              onClick={() => connect('1am')}
              className="px-6 py-3 rounded-xl font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition"
            >
              Connect 1AM Wallet
            </button>
          </div>
        ) : isLoading ? (
          <div className="p-12 text-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-cyan-400" />
            Loading Midnight escrow contracts...
          </div>
        ) : escrows.length === 0 ? (
          <div className="p-12 rounded-2xl border border-slate-800 bg-slate-900/50 text-center my-6">
            <p className="text-slate-400 text-lg">No escrows found for your connected wallet.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center text-cyan-400 hover:underline font-semibold"
            >
              Create your first escrow <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {escrows.map((escrow) => (
              <div
                key={escrow.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono text-slate-500">ID: {escrow.id.slice(0, 12)}...</span>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        escrow.status === EscrowStatus.RELEASED
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : escrow.status === EscrowStatus.REFUNDED
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : escrow.status === EscrowStatus.CANCELLED
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      }`}
                    >
                      {escrow.statusLabel}
                    </span>
                  </div>

                  <div className="mb-4">
                    <div className="text-2xl font-black text-slate-100">{escrow.amount} tDUST</div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" /> Deadline: {escrow.deadlineFormatted}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs border-t border-slate-800/80 pt-3 mb-4">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payer:</span>
                      <span className="font-mono text-slate-300">
                        {escrow.payer.slice(0, 10)}...{escrow.payer.slice(-4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payee:</span>
                      <span className="font-mono text-slate-300">
                        {escrow.payee.slice(0, 10)}...{escrow.payee.slice(-4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Arbiter:</span>
                      <span className="font-mono text-slate-300">
                        {escrow.arbiter.slice(0, 10)}...{escrow.arbiter.slice(-4)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
                  {escrow.status === EscrowStatus.CREATED && (
                    <>
                      <button
                        disabled={activeActionId === escrow.id}
                        onClick={() => handleAction(escrow.id, 'fund')}
                        className="flex-1 py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs transition"
                      >
                        Fund Escrow
                      </button>
                      <button
                        disabled={activeActionId === escrow.id}
                        onClick={() => handleAction(escrow.id, 'cancel')}
                        className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {(escrow.status === EscrowStatus.FUNDED || escrow.status === EscrowStatus.LOCKED) && (
                    <>
                      <button
                        disabled={activeActionId === escrow.id}
                        onClick={() => handleAction(escrow.id, 'release')}
                        className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs transition"
                      >
                        Release Funds
                      </button>
                      <button
                        disabled={activeActionId === escrow.id}
                        onClick={() => handleAction(escrow.id, 'refund')}
                        className="py-2 px-3 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-slate-950 font-semibold text-xs transition"
                      >
                        Refund
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Escrow Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-cyan-400" /> New Escrow Contract
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-200 text-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateEscrow} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Payee Midnight Address</label>
                  <input
                    type="text"
                    required
                    placeholder="mn_addr_preview1..."
                    value={payee}
                    onChange={(e) => setPayee(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Arbiter Address (Optional, defaults to Payer)
                  </label>
                  <input
                    type="text"
                    placeholder="mn_addr_preview1..."
                    value={arbiter}
                    onChange={(e) => setArbiter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Amount (tDUST)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="100.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Deadline (Days)</label>
                  <select
                    value={deadlineDays}
                    onChange={(e) => setDeadlineDays(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value={1}>1 Day</option>
                    <option value={3}>3 Days</option>
                    <option value={7}>7 Days</option>
                    <option value={14}>14 Days</option>
                    <option value={30}>30 Days</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-sm font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                  >
                    Deploy Escrow
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
