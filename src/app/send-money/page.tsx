'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useWallet } from '@/context/WalletContext'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { API_URL } from '@/config'
import { signTransaction } from '@stellar/freighter-api'
import {
  Send,
  User,
  Wallet as WalletIcon,
  Loader2,
  Check,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Copy,
  Clock,
  Coins,
  Shield,
  FileText
} from 'lucide-react'

interface DBTransaction {
  id: string
  sender_wallet: string
  recipient_wallet: string
  amount: number
  asset_type: string
  purpose: string
  tx_hash: string | null
  status: string
  created_at: string
}

export default function SendMoneyPage() {
  const router = useRouter()
  const { user, token, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const { publicKey, balance: walletBalance, connect, isConnecting } = useWallet()

  // Form states
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [purpose, setPurpose] = useState('Services')

  // Validation feedback states
  const [isValidRecipient, setIsValidRecipient] = useState<boolean | null>(null)
  const [recipientError, setRecipientError] = useState<string | null>(null)
  const [isValidatingRecipient, setIsValidatingRecipient] = useState(false)
  
  const [localBalance, setLocalBalance] = useState<string | null>(null)
  const [isNotFunded, setIsNotFunded] = useState(false)

  // Simulation / Submission states
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [subStep, setSubStep] = useState(0)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  // History state
  const [history, setHistory] = useState<DBTransaction[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isAuthLoading, router])

  // Fetch live balance and transaction history on load or wallet connection
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchBalance()
      fetchHistory()
    }
  }, [isAuthenticated, token, publicKey])

  // Fetch live wallet balance from backend Horizon query
  const fetchBalance = async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/send-money/balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setLocalBalance(data.balance)
        setIsNotFunded(data.isNotFunded || false)
      }
    } catch (err) {
      console.error('Error fetching balance:', err)
    }
  }

  // Fetch transaction history
  const fetchHistory = async () => {
    if (!token) return
    setIsLoadingHistory(true)
    try {
      const res = await fetch(`${API_URL}/api/send-money/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setHistory(data)
      }
    } catch (err) {
      console.error('Error fetching transaction history:', err)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // Validate recipient on input blur or change
  const handleValidateRecipient = async (address: string) => {
    if (!address) {
      setIsValidRecipient(null)
      setRecipientError(null)
      return
    }

    setIsValidatingRecipient(true)
    setRecipientError(null)

    try {
      const res = await fetch(`${API_URL}/api/send-money/validate-recipient`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ recipientAddress: address })
      })

      const data = await res.json()
      if (res.ok) {
        setIsValidRecipient(true)
      } else {
        setIsValidRecipient(false)
        setRecipientError(data.error || 'Invalid address')
      }
    } catch (err) {
      setIsValidRecipient(false)
      setRecipientError('Validation connection failed')
    } finally {
      setIsValidatingRecipient(false)
    }
  }

  // Handle Send Money form submission review
  const handleOpenReview = (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipient || !amount || !purpose || isValidRecipient !== true) return
    
    // Open transaction verification card modal
    setShowConfirmModal(true)
  }

  // Confirm and execute payment flow
  const handleExecuteSend = async () => {
    setShowConfirmModal(false)
    setIsSubmitting(true)
    setSubStep(0)
    setSubmissionError(null)
    setTxHash(null)

    try {
      // Step 1: Create transaction on backend to fetch unsigned envelope XDR
      setSubStep(1)
      const createRes = await fetch(`${API_URL}/api/send-money/create-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ recipientAddress: recipient, amount, purpose })
      })

      const createData = await createRes.json()
      if (!createRes.ok) {
        throw new Error(createData.error || 'Failed to construct transaction envelope')
      }

      // Step 2: Request Freighter transaction signature
      setSubStep(2)
      let signResult = await signTransaction(createData.xdr, {
        networkPassphrase: "Test SDF Network ; September 2015"
      })
      if (typeof signResult === 'object' && (signResult as any).error) {
        throw new Error((signResult as any).error)
      }
      const signedXdr = typeof signResult === 'string' ? signResult : (signResult as any).signedTxXdr

      // Step 3: Submit signed transaction envelope back to backend Horizon submitter
      setSubStep(3)
      const submitRes = await fetch(`${API_URL}/api/send-money/submit-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ xdr: signedXdr, purpose })
      })

      const submitData = await submitRes.json()
      if (!submitRes.ok) {
        throw new Error(submitData.error || 'Stellar network transaction submission failed.')
      }

      // Success
      setTxHash(submitData.txHash)
      setSubStep(4)
      setRecipient('')
      setAmount('')
      setIsValidRecipient(null)
      fetchBalance()
      fetchHistory()
    } catch (err: any) {
      console.error('Send money error:', err)
      setSubmissionError(err.message || 'An unexpected transaction error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Generate SVG background grid helper
  const generateGridSvg = () => {
    const activeCells = [
      { col: 1, row: 0, seed: 1 },
      { col: 3, row: 0, seed: 2 },
      { col: 0, row: 1, seed: 3 },
      { col: 2, row: 1, seed: 4 },
      { col: 1, row: 2, seed: 5 },
      { col: 3, row: 2, seed: 6 },
      { col: 0, row: 3, seed: 7 },
      { col: 2, row: 3, seed: 8 }
    ]

    let linesHtml = ''

    for (let i = 1; i <= 4; i++) {
      const coord = i * 96
      linesHtml += `<line x1="${coord}" y1="0" x2="${coord}" y2="384" stroke="black" stroke-opacity="0.18" stroke-width="1" />`
      linesHtml += `<line x1="0" y1="${coord}" x2="384" y2="${coord}" stroke="black" stroke-opacity="0.18" stroke-width="1" />`
    }

    activeCells.forEach(cell => {
      const startX = cell.col * 96
      const startY = cell.row * 96
      const lineCount = 11
      const paddingX = 14
      const startYOffset = 16
      const gap = 6

      linesHtml += `<g stroke="black" stroke-opacity="0.22" stroke-width="1.8" stroke-linecap="round">`
      for (let l = 0; l < lineCount; l++) {
        const y = startY + startYOffset + (l * gap)
        const isIndented = (cell.seed + l) % 3 === 0 && l > 1 && l < lineCount - 2
        const indent = isIndented ? 12 : 0
        const left = startX + paddingX + indent
        const lengthFactor = Math.abs(Math.sin(cell.seed * 1.5 + l * 2.3))
        const maxLength = 96 - (paddingX * 2) - indent
        const lineLength = 15 + lengthFactor * (maxLength - 15)
        const right = left + lineLength
        linesHtml += `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" />`
      }
      linesHtml += `</g>`
    })

    return `<svg xmlns="http://www.w3.org/2000/svg" width="384" height="384" viewBox="0 0 384 384">${linesHtml}</svg>`
  }

  const gridBackground = `url("data:image/svg+xml,${encodeURIComponent(generateGridSvg())}")`

  // Loading skeleton screen
  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-black/50 text-sm gap-2.5">
        <Loader2 className="w-6 h-6 animate-spin text-black" />
        <span>Syncing transaction portal...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-white text-black selection:bg-black selection:text-white relative overflow-hidden">
      
      {/* Top Black Fading Radial Glow */}
      <div
        className="absolute top-0 left-0 w-full h-[550px] pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.45), transparent)',
          filter: 'blur(60px)',
          zIndex: 0,
        }}
      />

      {/* Background SVG Grid Pattern */}
      <div
        className="absolute top-0 left-0 w-full h-[550px] pointer-events-none"
        style={{
          backgroundImage: gridBackground,
          backgroundSize: '384px 384px',
          maskImage: 'linear-gradient(to bottom, black 30%, transparent 85%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 30%, transparent 85%)',
          zIndex: 0,
        }}
      />

      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 pt-32 pb-16 relative z-10">
        
        {/* Page title */}
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight font-sans">Send Money</h1>
          <p className="text-sm text-black/50 mt-1 font-medium font-sans animate-pulse">
            Settle global invoices, services, or business expenses instantly on the Stellar Testnet.
          </p>
        </div>

        {/* Form and info boxes container grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start mb-16">
          
          {/* Left panel: Wallet connection summary */}
          <div className="space-y-6">
            
            {/* Wallet Details panel */}
            <div className="bg-black/95 border border-white/10 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider block">Connected Ledger Node</span>
              
              <div className="flex items-center gap-3 mt-4">
                <div className="w-10 h-10 bg-white/10 border border-white/20 rounded-full flex items-center justify-center">
                  <WalletIcon size={18} className="text-white/80" />
                </div>
                <div>
                  <p className="text-[9px] text-white/40 uppercase font-bold tracking-wider">Freighter Account</p>
                  <p className="font-mono text-xs font-semibold mt-0.5 text-white/95">{truncate(publicKey)}</p>
                </div>
              </div>

              <div className="border-t border-white/10 my-4.5" />

              <div className="flex justify-between items-baseline">
                <div>
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider block">Wallet Balance</span>
                  <span className="font-mono text-2xl font-black text-white mt-1 block">
                    {localBalance !== null ? localBalance : '0.00'} <span className="text-xs text-white/40 font-bold">XLM</span>
                  </span>
                </div>
                {isNotFunded && (
                  <span className="px-2 py-0.5 rounded text-[8px] bg-amber-500/15 text-amber-400 border border-amber-500/20 font-bold uppercase tracking-wider">
                    Unfunded
                  </span>
                )}
              </div>

              {!publicKey && (
                <button
                  onClick={connect}
                  disabled={isConnecting}
                  className="w-full mt-5 py-3 flex items-center justify-center gap-2 bg-white text-black hover:bg-white/95 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-98"
                >
                  {isConnecting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <WalletIcon size={14} />
                  )}
                  <span>Connect Freighter Wallet</span>
                </button>
              )}
            </div>

            {/* Platform assurances summary card */}
            <div className="bg-black/95 border border-white/10 rounded-3xl p-6 text-white/50 space-y-4">
              <div className="flex items-center gap-2.5 text-white">
                <Shield size={18} className="text-white/60" />
                <h4 className="font-bold text-sm">Secure Stellar Channels</h4>
              </div>
              <p className="text-xs leading-relaxed font-medium">
                Payments route peer-to-peer natively on the Stellar blockchain network ledger. Funds settle directly into recipient wallets under 5 seconds with cryptographic consensus confirmation receipts.
              </p>
            </div>

          </div>

          {/* Right panel: Form input fields */}
          <div className="md:col-span-2">
            <div className="bg-black/95 border border-white/10 rounded-3xl p-8 shadow-2xl text-white">
              
              <form onSubmit={handleOpenReview} className="space-y-5">
                
                {/* Field: Recipient Wallet */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center pl-1">
                    <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Recipient Public Address</label>
                    {isValidatingRecipient && <Loader2 size={12} className="animate-spin text-white/40" />}
                  </div>
                  
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={recipient}
                      onChange={(e) => {
                        setRecipient(e.target.value)
                        setIsValidRecipient(null)
                      }}
                      onBlur={() => handleValidateRecipient(recipient)}
                      placeholder="G..."
                      className={`w-full px-4 py-3 bg-white/[0.02] border rounded-xl text-sm text-white font-mono placeholder-white/20 focus:outline-none transition-all ${
                        isValidRecipient === true
                          ? 'border-emerald-500/40 focus:border-emerald-500/60'
                          : isValidRecipient === false
                            ? 'border-rose-500/40 focus:border-rose-500/60'
                            : 'border-white/10 focus:border-white/30'
                      }`}
                    />
                    
                    {/* Status visual indicators */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                      {isValidRecipient === true && <Check size={16} className="text-emerald-400" />}
                      {isValidRecipient === false && <AlertTriangle size={16} className="text-rose-400" />}
                    </div>
                  </div>
                  
                  {recipientError && (
                    <p className="text-[11px] text-rose-400 font-semibold pl-1">{recipientError}</p>
                  )}
                </div>

                {/* Field: Amount & Purpose */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  
                  {/* Amount input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">Amount (XLM)</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-white/30 pointer-events-none font-semibold text-xs">
                        XLM
                      </span>
                      <input
                        type="number"
                        step="any"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="100.00"
                        className={`w-full pl-12 pr-4 py-3 bg-white/[0.02] border rounded-xl text-sm text-white placeholder-white/20 focus:outline-none transition-all font-mono ${
                          localBalance !== null && amount && parseFloat(amount) > parseFloat(localBalance)
                            ? 'border-rose-500/40 focus:border-rose-500/60'
                            : 'border-white/10 focus:border-white/30'
                        }`}
                      />
                    </div>
                    {localBalance !== null && amount && parseFloat(amount) > parseFloat(localBalance) && (
                      <p className="text-[11px] text-rose-400 font-semibold pl-1">
                        Insufficient balance to cover transaction.
                      </p>
                    )}
                  </div>

                  {/* Purpose dropdown select */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">Payment Purpose</label>
                    <div className="relative">
                      <select
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        className="w-full appearance-none px-4 py-3 bg-white/[0.02] border border-white/10 hover:border-white/20 rounded-xl text-xs text-white placeholder-white/20 focus:outline-none transition-all font-semibold font-sans cursor-pointer"
                      >
                        <option value="Services" className="bg-[#0F0F0F] text-white font-semibold">Services & Contracts</option>
                        <option value="Rent" className="bg-[#0F0F0F] text-white font-semibold">Business Rent / Lease</option>
                        <option value="Supplies" className="bg-[#0F0F0F] text-white font-semibold">Supplies & Equipment</option>
                        <option value="Logistics" className="bg-[#0F0F0F] text-white font-semibold">Travel & Logistics</option>
                        <option value="Emergency" className="bg-[#0F0F0F] text-white font-semibold">Emergency Transfer</option>
                        <option value="Other" className="bg-[#0F0F0F] text-white font-semibold">Other Remittance</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={14} />
                    </div>
                  </div>

                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!recipient || !amount || isValidRecipient !== true || !publicKey || (localBalance !== null && parseFloat(amount) > parseFloat(localBalance))}
                  className="w-full py-4.5 bg-white text-black hover:bg-white/95 disabled:bg-white/20 disabled:text-black/45 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider active:scale-[0.99]"
                >
                  <Send size={14} />
                  <span>Send Money Review</span>
                </button>

              </form>
            </div>
          </div>

        </div>

        {/* Section: Transaction History */}
        <div className="bg-black/95 border border-white/10 rounded-3xl p-6 shadow-xl shadow-black/25 text-white">
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <Clock className="text-white/60" size={18} />
              <h3 className="font-bold text-lg">Remittance History</h3>
            </div>
            <button
              onClick={fetchHistory}
              className="text-xs text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              Refresh
            </button>
          </div>

          {isLoadingHistory ? (
            <div className="py-12 flex flex-col items-center justify-center text-white/45 text-xs gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Syncing on-chain ledger records...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-white/45 text-xs font-semibold">
              No transactions logged on this account yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-white/40 font-bold uppercase tracking-wider">
                    <th className="py-3 px-2">Date</th>
                    <th className="py-3 px-2">Role</th>
                    <th className="py-3 px-2">Counterparty Wallet</th>
                    <th className="py-3 px-2">Purpose</th>
                    <th className="py-3 px-2">Amount</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2 text-right">Ledger Explorer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-white/80 font-medium">
                  {history.map((tx) => {
                    const isSender = tx.sender_wallet === publicKey
                    const counterparty = isSender ? tx.recipient_wallet : tx.sender_wallet
                    return (
                      <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-2 text-white/50">
                          {new Date(tx.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="py-3.5 px-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            isSender ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {isSender ? 'Sent' : 'Received'}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 font-mono text-white/60">
                          {counterparty.slice(0, 10)}...{counterparty.slice(-8)}
                        </td>
                        <td className="py-3.5 px-2">{tx.purpose}</td>
                        <td className="py-3.5 px-2 font-semibold">
                          {isSender ? '-' : '+'}{tx.amount} XLM
                        </td>
                        <td className="py-3.5 px-2">
                          <span className={`inline-flex items-center gap-1.5 font-bold ${
                            tx.status === 'SUCCESS'
                              ? 'text-emerald-400'
                              : tx.status === 'FAILED'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              tx.status === 'SUCCESS'
                                ? 'bg-emerald-500'
                                : tx.status === 'FAILED'
                                  ? 'bg-rose-500'
                                  : 'bg-amber-500 animate-pulse'
                            }`} />
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 text-right">
                          {tx.tx_hash ? (
                            <a
                              href={`https://stellar.expert/explorer/testnet/tx/${tx.tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-white/55 hover:text-white transition-colors"
                            >
                              <span>Explore</span>
                              <ExternalLink size={11} />
                            </a>
                          ) : (
                            <span className="text-white/30 font-semibold">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>

      {/* Transaction review card modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0F0F0F] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl text-white">
            <h3 className="text-lg font-bold text-white mb-4">Review Transaction</h3>
            
            <div className="space-y-3.5 bg-white/[0.02] border border-white/5 rounded-xl p-4.5 text-xs">
              <div className="flex justify-between items-baseline gap-4">
                <span className="text-white/40">Recipient</span>
                <span className="font-mono text-white/95 font-bold text-right break-all">{recipient}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/40">Amount</span>
                <span className="font-mono text-white/95 font-extrabold text-sm">{amount} XLM</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/40">Purpose</span>
                <span className="text-white/95 font-bold">{purpose}</span>
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-3">
                <span className="text-white/40">Network Fee</span>
                <span className="font-mono text-emerald-400 font-bold">0.00001 XLM</span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-6">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 text-xs font-bold border border-white/10 hover:bg-white/5 rounded-lg text-white/70 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteSend}
                className="px-5 py-2.5 bg-white text-black font-bold text-xs rounded-lg hover:bg-white/90 transition-all cursor-pointer flex items-center gap-1 active:scale-98"
              >
                <Send size={12} />
                <span>Confirm & Sign</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submission overlay / Freighter popups simulator */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0F0F0F] border border-white/10 w-full max-w-lg rounded-3xl p-6 shadow-2xl text-white relative overflow-hidden">
            
            <div className="flex flex-col items-center py-8 text-center space-y-6">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-white/5" />
                <Loader2 className="w-10 h-10 animate-spin text-white" />
              </div>

              <div className="space-y-1.5 max-w-xs">
                <h3 className="font-bold text-lg">Ledger Dispatching</h3>
                <p className="text-xs text-white/55 leading-normal">
                  Authenticating and validating remittance envelope. Please check Freighter wallet extensions.
                </p>
              </div>

              <div className="w-full max-w-sm bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-left font-mono text-[10px] space-y-2.5 text-white/40">
                <div className="flex items-center gap-2.5">
                  <span className={subStep >= 1 ? 'text-emerald-400' : ''}>{subStep > 1 ? '✔' : '⚙'}</span>
                  <span className={subStep === 1 ? 'text-white font-bold' : subStep > 1 ? 'text-white/80' : ''}>
                    Connecting backend & building transaction...
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className={subStep >= 2 ? 'text-emerald-400' : ''}>{subStep > 2 ? '✔' : subStep === 2 ? '⚙' : '○'}</span>
                  <span className={subStep === 2 ? 'text-white font-bold' : subStep > 2 ? 'text-white/80' : ''}>
                    Awaiting Freighter wallet signature...
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className={subStep >= 3 ? 'text-emerald-400' : ''}>{subStep > 3 ? '✔' : subStep === 3 ? '⚙' : '○'}</span>
                  <span className={subStep === 3 ? 'text-white font-bold' : subStep > 3 ? 'text-white/80' : ''}>
                    Submitting signed envelope to Horizon Testnet...
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Transaction Success Receipt Card */}
      {txHash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0F0F0F] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl text-white">
            
            <div className="flex flex-col items-center space-y-5">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-lg shadow-emerald-500/5">
                <Check className="text-emerald-400 w-6 h-6" strokeWidth={3} />
              </div>

              <div className="text-center">
                <h3 className="font-extrabold text-xl tracking-tight uppercase">Transfer Successful</h3>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-2">
                  Settled on Testnet
                </span>
              </div>

              <div className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/40 font-medium">Stellar Transaction Hash</span>
                  <div className="flex items-center gap-2 bg-white/[0.02] border border-white/5 rounded-xl px-3.5 py-2 w-full max-w-[200px]">
                    <span className="font-mono text-[10px] text-white/75 truncate select-all flex-1">{txHash}</span>
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
                      title="View on StellarExpert"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 w-full border-t border-white/10 pt-4 mt-2">
                <button
                  onClick={() => setTxHash(null)}
                  className="w-full py-2.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-white/95 transition-all cursor-pointer active:scale-98"
                >
                  Close Receipt
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Submission error modal warning */}
      {submissionError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0F0F0F] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl text-white">
            <div className="flex items-center gap-2.5 text-rose-400 mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold">Transfer Rejected</h3>
            </div>
            
            <p className="text-xs text-white/60 leading-relaxed font-semibold bg-white/[0.02] border border-white/5 rounded-xl p-4.5">
              {submissionError}
            </p>

            <div className="flex justify-end pt-5">
              <button
                type="button"
                onClick={() => setSubmissionError(null)}
                className="px-5 py-2 bg-white text-black font-bold text-xs rounded-lg hover:bg-white/90 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

function truncate(str: string | null) {
  if (!str) return 'Not connected'
  return `${str.slice(0, 8)}...${str.slice(-8)}`
}

function ChevronDown({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size || 16}
      height={size || 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
