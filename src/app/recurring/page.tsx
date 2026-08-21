'use client'

import React, { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { useMidnightWallet } from '@/context/MidnightWalletContext'
import { RecurringService } from '@/contracts/recurring/service'
import { SubscriptionDetails, SubscriptionStatus, FrequencyType } from '@/contracts/recurring/types'
import { TransactionManager, TransactionState } from '@/transactions/transactionManager'
import {
  Repeat,
  PlusCircle,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  Pause,
  Ban,
  Zap
} from 'lucide-react'

export default function RecurringPage() {
  const { wallet, isConnected, connect } = useMidnightWallet()
  const walletAddress = wallet?.address || ''

  const [subscriptions, setSubscriptions] = useState<SubscriptionDetails[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Create Form State
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<FrequencyType>('MONTHLY')
  const [maxPayments, setMaxPayments] = useState(12)
  const [durationDays, setDurationDays] = useState(365)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Transaction State
  const [txState, setTxState] = useState<TransactionState | null>(null)
  const [activeActionId, setActiveActionId] = useState<string | null>(null)

  useEffect(() => {
    if (walletAddress) {
      loadSubscriptions()
    }
  }, [walletAddress])

  const loadSubscriptions = async () => {
    setIsLoading(true)
    try {
      const list = await RecurringService.fetchSubscriptions(walletAddress)
      setSubscriptions(list)
    } catch (err) {
      console.warn('Failed to load subscriptions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isConnected || !walletAddress) {
      connect('1am')
      return
    }

    const txManager = new TransactionManager('Create Subscription')
    const unsubscribe = txManager.subscribe(setTxState)

    try {
      await RecurringService.createSubscription(
        {
          recipientAddress: recipient,
          amountTDust: amount,
          frequency,
          maxPayments,
          durationDays,
        },
        walletAddress,
        txManager
      )
      setShowCreateModal(false)
      setRecipient('')
      setAmount('')
      loadSubscriptions()
    } catch (err) {
      console.error('Create subscription error:', err)
    } finally {
      unsubscribe()
    }
  }

  const handleAction = async (subId: string, actionName: 'execute' | 'pause' | 'resume' | 'cancel') => {
    if (!walletAddress) return
    setActiveActionId(subId)

    const txManager = new TransactionManager(`${actionName.toUpperCase()} Subscription`)
    const unsubscribe = txManager.subscribe(setTxState)

    try {
      if (actionName === 'execute') await RecurringService.executePayment(subId, walletAddress, txManager)
      else if (actionName === 'pause') await RecurringService.pauseSubscription(subId, walletAddress, txManager)
      else if (actionName === 'resume') await RecurringService.resumeSubscription(subId, walletAddress, txManager)
      else if (actionName === 'cancel') await RecurringService.cancelSubscription(subId, walletAddress, txManager)

      await loadSubscriptions()
    } catch (err) {
      console.error(`Subscription ${actionName} error:`, err)
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
              <Repeat className="w-8 h-8 text-cyan-400" />
              Midnight Recurring Payments
            </h1>
            <p className="text-slate-400 mt-1">
              Automated, scheduled zero-knowledge payment agreements on Midnight Network.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all duration-200 shadow-lg shadow-cyan-500/20"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            New Recurring Payment
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

        {/* Subscriptions List */}
        {!isConnected ? (
          <div className="p-12 rounded-2xl border border-slate-800 bg-slate-900/50 text-center max-w-xl mx-auto my-12">
            <Repeat className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-100">Connect Midnight Wallet</h3>
            <p className="text-slate-400 mt-2 mb-6">
              Connect your 1AM Midnight wallet to manage your recurring billing contracts.
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
            Loading Midnight recurring subscriptions...
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="p-12 rounded-2xl border border-slate-800 bg-slate-900/50 text-center my-6">
            <p className="text-slate-400 text-lg">No recurring payment subscriptions found.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center text-cyan-400 hover:underline font-semibold"
            >
              Create your first recurring payment <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono text-slate-500">ID: {sub.id.slice(0, 12)}...</span>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        sub.status === SubscriptionStatus.ACTIVE
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : sub.status === SubscriptionStatus.PAUSED
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : sub.status === SubscriptionStatus.COMPLETED
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {sub.statusLabel}
                    </span>
                  </div>

                  <div className="mb-4">
                    <div className="text-2xl font-black text-slate-100">
                      {sub.amount} tDUST <span className="text-xs font-normal text-slate-400">/ {sub.frequencyLabel}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" /> Next Due: {sub.nextPaymentFormatted}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs border-t border-slate-800/80 pt-3 mb-4">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payer:</span>
                      <span className="font-mono text-slate-300">
                        {sub.payer.slice(0, 10)}...{sub.payer.slice(-4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Recipient:</span>
                      <span className="font-mono text-slate-300">
                        {sub.recipient.slice(0, 10)}...{sub.recipient.slice(-4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payments Completed:</span>
                      <span className="font-medium text-slate-200">
                        {sub.paymentCount} {sub.maxPayments > 0 ? `/ ${sub.maxPayments}` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
                  {sub.status === SubscriptionStatus.ACTIVE && (
                    <>
                      <button
                        disabled={activeActionId === sub.id}
                        onClick={() => handleAction(sub.id, 'execute')}
                        className="flex-1 py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition inline-flex items-center justify-center gap-1"
                      >
                        <Zap className="w-3.5 h-3.5" /> Execute
                      </button>
                      <button
                        disabled={activeActionId === sub.id}
                        onClick={() => handleAction(sub.id, 'pause')}
                        className="py-2 px-3 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-slate-950 font-semibold text-xs transition"
                      >
                        Pause
                      </button>
                      <button
                        disabled={activeActionId === sub.id}
                        onClick={() => handleAction(sub.id, 'cancel')}
                        className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {sub.status === SubscriptionStatus.PAUSED && (
                    <>
                      <button
                        disabled={activeActionId === sub.id}
                        onClick={() => handleAction(sub.id, 'resume')}
                        className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs transition"
                      >
                        Resume
                      </button>
                      <button
                        disabled={activeActionId === sub.id}
                        onClick={() => handleAction(sub.id, 'cancel')}
                        className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Subscription Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <Repeat className="w-6 h-6 text-cyan-400" /> New Recurring Payment
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-200 text-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSubscription} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Recipient Midnight Address</label>
                  <input
                    type="text"
                    required
                    placeholder="mn_addr_preview1..."
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Amount Per Interval (tDUST)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="50.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as FrequencyType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Maximum Payments</label>
                  <input
                    type="number"
                    value={maxPayments}
                    onChange={(e) => setMaxPayments(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
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
                    Deploy Subscription
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
