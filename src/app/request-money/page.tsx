'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useWallet } from '@/context/WalletContext'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { signTransaction } from '@stellar/freighter-api'
import { StrKey, Horizon } from '@stellar/stellar-sdk'
import {
  Share2,
  QrCode,
  Check,
  Copy,
  Mail,
  ExternalLink,
  Loader2,
  User,
  DollarSign,
  FileText,
  Clock,
  ArrowRight,
  AlertTriangle,
  XCircle,
  TrendingDown,
  TrendingUp,
  Inbox,
  Send,
  Lock,
  ChevronDown
} from 'lucide-react'

interface PaymentRequest {
  id: string
  requester_wallet: string
  recipient_wallet: string
  amount: number
  asset: string
  purpose: string
  message: string | null
  status: string
  transaction_hash: string | null
  created_at: string
  updated_at: string
}

export default function RequestMoneyPage() {
  const router = useRouter()
  const { user, token, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const { publicKey, connect, isConnecting } = useWallet()

  // Form states
  const [recipientWallet, setRecipientWallet] = useState('')
  const [amount, setAmount] = useState('')
  const [asset, setAsset] = useState('USDC')
  const [purpose, setPurpose] = useState('Services')
  const [message, setMessage] = useState('')

  // Form Validation & Creation States
  const [isValidAddress, setIsValidAddress] = useState<boolean | null>(null)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [isCreatingRequest, setIsCreatingRequest] = useState(false)
  const [creationError, setCreationError] = useState<string | null>(null)

  // Requests List States
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [isLoadingRequests, setIsLoadingRequests] = useState(false)
  const [activeTab, setActiveTab] = useState<'pending' | 'completed' | 'declined'>('pending')

  // Payment Simulation & Execution States
  const [payingRequest, setPayingRequest] = useState<PaymentRequest | null>(null)
  const [isPaying, setIsPaying] = useState(false)
  const [payStep, setPayStep] = useState(0)
  const [payError, setPayError] = useState<string | null>(null)
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null)
  const [isEstablishingTrustline, setIsEstablishingTrustline] = useState(false)
  const [trustlineSuccess, setTrustlineSuccess] = useState(false)

  // Decline execution states
  const [decliningId, setDecliningId] = useState<string | null>(null)

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentRequest | null>(null)

  // Wallet Balance states for validation
  const [xlmBalance, setXlmBalance] = useState<string>('0.00')
  const [usdcBalance, setUsdcBalance] = useState<string>('0.00')
  const [isNotFunded, setIsNotFunded] = useState(false)
  const [hasUsdcTrustline, setHasUsdcTrustline] = useState(false)

  const fetchBalances = async (address: string) => {
    try {
      const server = new Horizon.Server('https://horizon-testnet.stellar.org')
      const account = await server.loadAccount(address)
      const native = account.balances.find((b) => b.asset_type === 'native')
      const usdc = account.balances.find(
        (b: any) =>
          b.asset_code === 'USDC' &&
          b.asset_issuer === 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
      )
      setXlmBalance(native ? native.balance : '0.0000000')
      setUsdcBalance(usdc ? usdc.balance : '0.0000000')
      setHasUsdcTrustline(!!usdc)
      setIsNotFunded(false)
    } catch (err: any) {
      const is404 = err.status === 404 || (err.response && err.response.status === 404)
      if (is404) {
        setIsNotFunded(true)
        setXlmBalance('0.00')
        setUsdcBalance('0.00')
        setHasUsdcTrustline(false)
      }
    }
  }

  useEffect(() => {
    if (publicKey) {
      fetchBalances(publicKey)
    }
  }, [publicKey])

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isAuthLoading, router])

  // Fetch requests list
  const fetchRequests = async () => {
    if (!token) return
    setIsLoadingRequests(true)
    try {
      const res = await fetch('http://localhost:5000/api/payment-requests', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setRequests(data)
      } else {
        console.error('Error fetching requests:', data.error)
      }
    } catch (err) {
      console.error('Network error fetching requests:', err)
    } finally {
      setIsLoadingRequests(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchRequests()
    }
  }, [isAuthenticated, token, publicKey])

  // Validate address input format
  const handleValidateAddress = (address: string) => {
    if (!address) {
      setIsValidAddress(null)
      setAddressError(null)
      return
    }

    const validFormat = StrKey.isValidEd25519PublicKey(address)
    if (!validFormat) {
      setIsValidAddress(false)
      setAddressError('Invalid Stellar wallet address format.')
      return
    }

    if (user && user.wallet_address === address) {
      setIsValidAddress(false)
      setAddressError('You cannot request money from your own wallet.')
      return
    }

    setIsValidAddress(true)
    setAddressError(null)
  }

  // Handle Request Creation Submission
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreationError(null)

    if (!recipientWallet || !amount || !purpose || isValidAddress !== true) {
      return
    }

    setIsCreatingRequest(true)
    try {
      const res = await fetch('http://localhost:5000/api/payment-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientWallet,
          amount: parseFloat(amount),
          asset,
          purpose,
          message: message || undefined
        })
      })

      const data = await res.json()
      if (res.ok) {
        // Clear form
        setRecipientWallet('')
        setAmount('')
        setMessage('')
        setIsValidAddress(null)
        // Refresh requests
        fetchRequests()
      } else {
        setCreationError(data.error || 'Failed to create payment request.')
      }
    } catch (err) {
      setCreationError('Network error creating request.')
    } finally {
      setIsCreatingRequest(false)
    }
  }

  // Decline Request Handler
  const handleDeclineRequest = async (id: string) => {
    setDecliningId(id)
    try {
      const res = await fetch(`http://localhost:5000/api/payment-requests/${id}/decline`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (res.ok) {
        fetchRequests()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to decline request.')
      }
    } catch (err) {
      alert('Network error declining request.')
    } finally {
      setDecliningId(null)
    }
  }

  // Pay Request Consensus Workflow
  const handlePayRequest = async (req: PaymentRequest) => {
    if (!publicKey) {
      alert('Connect your wallet first.')
      return
    }

    try {
      // Load fresh balances
      const server = new Horizon.Server('https://horizon-testnet.stellar.org')
      const account = await server.loadAccount(publicKey)
      const native = account.balances.find((b) => b.asset_type === 'native')
      const usdc = account.balances.find(
        (b: any) =>
          b.asset_code === 'USDC' &&
          b.asset_issuer === 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
      )

      const isUSDC = req.asset === 'USDC'
      const balanceVal = isUSDC ? (usdc ? parseFloat(usdc.balance) : 0) : (native ? parseFloat(native.balance) : 0)
      const hasTrust = !!usdc

      if (isUSDC && !hasTrust) {
        alert('USDC trustline is not established. Add a USDC trustline in your wallet first.')
        return
      }

      if (balanceVal < req.amount) {
        alert(`Insufficient balance. You need ${req.amount} ${req.asset}, but you only have ${balanceVal} ${req.asset}.`)
        return
      }
    } catch (err: any) {
      const is404 = err.status === 404 || (err.response && err.response.status === 404)
      if (is404) {
        alert('Your Stellar address is not funded on the Testnet. Fund your account with friendbot first.')
        return
      }
      console.error('Error verifying balances:', err)
    }

    setPayingRequest(req)
    setIsPaying(true)
    setPayStep(0)
    setPayError(null)
    setSuccessTxHash(null)

    try {
      // Step 1: Prepare transaction (fetch unsigned XDR from server)
      setPayStep(1)
      const prepareRes = await fetch(`http://localhost:5000/api/payment-requests/${req.id}/pay`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({})
      })

      const prepareData = await prepareRes.json()
      if (!prepareRes.ok) {
        throw new Error(prepareData.error || 'Failed to prepare transaction.')
      }

      const unsignedXdr = prepareData.xdr

      // Step 2: Request Freighter Signature
      setPayStep(2)
      const signResult = await signTransaction(unsignedXdr, {
        networkPassphrase: 'Test SDF Network ; September 2015'
      })

      if (typeof signResult === 'object' && (signResult as any).error) {
        throw new Error((signResult as any).error)
      }
      const signedXdr = typeof signResult === 'string' ? signResult : (signResult as any).signedTxXdr

      // Step 3: Submit transaction to Stellar network
      setPayStep(3)
      const submitRes = await fetch(`http://localhost:5000/api/payment-requests/${req.id}/pay`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ xdr: signedXdr })
      })

      const submitData = await submitRes.json()
      if (!submitRes.ok) {
        throw new Error(submitData.error || 'Stellar Horizon submission rejected.')
      }

      // Success
      setSuccessTxHash(submitData.txHash)
      setPayStep(4)
      fetchRequests()
    } catch (err: any) {
      console.error(err)
      setPayError(err.message || 'An unexpected error occurred during execution.')
    } finally {
      setIsPaying(false)
    }
  }

  const handleEstablishTrustline = async () => {
    if (!token) return
    setIsEstablishingTrustline(true)
    setPayError(null)
    try {
      // Step 1: Prepare changeTrust transaction XDR
      const prepareRes = await fetch('http://localhost:5000/wallet/trustline/usdc/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })
      const prepareData = await prepareRes.json()
      if (!prepareRes.ok) {
        throw new Error(prepareData.error || 'Failed to prepare trustline transaction.')
      }

      // Step 2: Request Freighter Signature
      const signedXdr = await signTransaction(prepareData.xdr, {
        networkPassphrase: 'Test SDF Network ; September 2015'
      })
      if (typeof signedXdr === 'object' && (signedXdr as any).error) {
        throw new Error((signedXdr as any).error)
      }
      const finalXdr = typeof signedXdr === 'string' ? signedXdr : (signedXdr as any).signedTxXdr

      // Step 3: Submit transaction to Stellar network
      const submitRes = await fetch('http://localhost:5000/wallet/trustline/usdc/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ xdr: finalXdr })
      })
      const submitData = await submitRes.json()
      if (!submitRes.ok) {
        throw new Error(submitData.error || 'Stellar Horizon trustline submission rejected.')
      }

      setTrustlineSuccess(true)
      alert("USDC Trustline established successfully! You can now pay the request.")
      
      // If we have a paying request active, automatically re-trigger pay flow
      if (payingRequest) {
        handlePayRequest(payingRequest)
      }
    } catch (err: any) {
      console.error(err)
      setPayError(err.message || 'Failed to establish USDC trustline.')
    } finally {
      setIsEstablishingTrustline(false)
    }
  }

  // Filter requests based on tab
  const filteredRequests = requests.filter((r) => {
    if (activeTab === 'pending') return r.status === 'PENDING'
    if (activeTab === 'completed') return r.status === 'COMPLETED'
    return r.status === 'DECLINED' || r.status === 'EXPIRED'
  })

  // Format truncated wallet strings
  const truncate = (str: string) => `${str.slice(0, 8)}...${str.slice(-8)}`

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

  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-black/50 text-sm gap-2.5">
        <Loader2 className="w-6 h-6 animate-spin text-black" />
        <span>Loading request dashboard...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-white text-black selection:bg-black selection:text-white relative overflow-hidden">
      {/* Top Fading Radial Glow */}
      <div
        className="absolute top-0 left-0 w-full h-[550px] pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.45), transparent)',
          filter: 'blur(60px)',
          zIndex: 0
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
          zIndex: 0
        }}
      />

      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 pt-32 pb-16 relative z-10">
        {/* Title */}
        <div className="mb-10 text-center sm:text-left">
          <h1 className="text-3xl font-extrabold tracking-tight font-sans">Request Money</h1>
          <p className="text-sm text-black/50 mt-1 font-medium font-sans">
            Ask for funds or manage invoices. Requesters will receive payments directly on their connected wallets.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left panel: Create Payment Request Form */}
          <div className="bg-black/95 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-xl shadow-black/35 text-white space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-white/10">
              <Share2 className="text-white/60" size={18} />
              <h3 className="font-bold text-base text-white">Create New Request</h3>
            </div>

            {creationError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl p-3 flex gap-2 font-semibold">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <p>{creationError}</p>
              </div>
            )}

            <form onSubmit={handleCreateRequest} className="space-y-4">
              {/* Recipient address */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">
                  Recipient Wallet Address
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={recipientWallet}
                    onChange={(e) => {
                      setRecipientWallet(e.target.value)
                      setIsValidAddress(null)
                    }}
                    onBlur={() => handleValidateAddress(recipientWallet)}
                    placeholder="G..."
                    className={`w-full px-4 py-2.5 bg-white/[0.02] border rounded-xl text-xs text-white font-mono placeholder-white/20 focus:outline-none transition-all ${
                      isValidAddress === true
                        ? 'border-emerald-500/40 focus:border-emerald-500/60'
                        : isValidAddress === false
                          ? 'border-rose-500/40 focus:border-rose-500/60'
                          : 'border-white/10 focus:border-white/30'
                    }`}
                  />
                  {isValidAddress === true && (
                    <Check size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-400" />
                  )}
                  {isValidAddress === false && (
                    <XCircle size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-rose-400" />
                  )}
                </div>
                {addressError && (
                  <p className="text-[10px] text-rose-400 font-semibold pl-1">{addressError}</p>
                )}
              </div>

              {/* Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">
                    Amount
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="100.00"
                      className="w-full pl-8 pr-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-mono font-medium"
                    />
                    <DollarSign size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  </div>
                </div>

                {/* Asset Select */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">
                    Currency/Asset
                  </label>
                  <div className="relative">
                    <select
                      value={asset}
                      onChange={(e) => setAsset(e.target.value)}
                      className="w-full appearance-none px-4 py-2.5 bg-white/[0.02] border border-white/10 hover:border-white/20 rounded-xl text-xs text-white placeholder-white/20 focus:outline-none transition-all font-semibold font-sans cursor-pointer"
                    >
                      <option value="USDC" className="bg-[#0F0F0F] text-white">USDC</option>
                      <option value="XLM" className="bg-[#0F0F0F] text-white">XLM</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={14} />
                  </div>
                </div>
              </div>

              {/* Purpose */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">
                  Purpose / Category
                </label>
                <div className="relative">
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full appearance-none px-4 py-2.5 bg-white/[0.02] border border-white/10 hover:border-white/20 rounded-xl text-xs text-white placeholder-white/20 focus:outline-none transition-all font-semibold font-sans cursor-pointer"
                  >
                    <option value="Services" className="bg-[#0F0F0F] text-white">Services & Contracts</option>
                    <option value="Rent" className="bg-[#0F0F0F] text-white">Business Rent / Lease</option>
                    <option value="Supplies" className="bg-[#0F0F0F] text-white">Supplies & Equipment</option>
                    <option value="Logistics" className="bg-[#0F0F0F] text-white">Travel & Logistics</option>
                    <option value="Emergency" className="bg-[#0F0F0F] text-white">Emergency Transfer</option>
                    <option value="Other" className="bg-[#0F0F0F] text-white">Other Remittance</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={14} />
                </div>
              </div>

              {/* Optional message */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">
                  Message (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-white/30">
                    <FileText size={14} />
                  </span>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add billing notes or description..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreatingRequest || !recipientWallet || !amount || isValidAddress !== true}
                className="w-full py-3 bg-white hover:bg-white/95 text-black disabled:bg-white/20 disabled:text-black/45 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider active:scale-[0.98] mt-6"
              >
                {isCreatingRequest ? (
                  <Loader2 size={14} className="animate-spin text-black" />
                ) : (
                  <Send size={12} />
                )}
                <span>Request Money</span>
              </button>
            </form>
          </div>

          {/* Right panel: Requests Inbox */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tab Navigation */}
            <div className="flex border-b border-black/10 text-xs font-bold font-sans">
              <button
                onClick={() => setActiveTab('pending')}
                className={`py-3 px-6 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'pending'
                    ? 'border-black text-black'
                    : 'border-transparent text-black/45 hover:text-black'
                }`}
              >
                Pending Requests
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`py-3 px-6 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'completed'
                    ? 'border-black text-black'
                    : 'border-transparent text-black/45 hover:text-black'
                }`}
              >
                Completed Requests
              </button>
              <button
                onClick={() => setActiveTab('declined')}
                className={`py-3 px-6 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'declined'
                    ? 'border-black text-black'
                    : 'border-transparent text-black/45 hover:text-black'
                }`}
              >
                Declined
              </button>
            </div>

            {/* Inbox List Container */}
            {isLoadingRequests ? (
              <div className="py-20 flex flex-col items-center justify-center text-black/45 text-xs gap-2">
                <Loader2 size={20} className="animate-spin text-black" />
                <span>Loading request ledger...</span>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-black/10 rounded-3xl flex flex-col items-center justify-center gap-3 bg-black/[0.01]">
                <Inbox size={32} className="text-black/20" />
                <p className="text-xs text-black/40 font-semibold">No requests found in this folder.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRequests.map((req) => {
                  const isIncoming = req.recipient_wallet === user.wallet_address
                  const counterparty = isIncoming ? req.requester_wallet : req.recipient_wallet

                  return (
                    <div
                      key={req.id}
                      className="bg-black/95 border border-white/10 rounded-2xl p-5 text-white flex flex-col justify-between shadow-lg relative overflow-hidden group hover:border-white/20 transition-all duration-300"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-white/40 font-bold block">
                              {isIncoming ? 'Requested From You' : 'You Requested'}
                            </span>
                            <span className="font-mono text-[10px] text-white/70 block mt-0.5 select-all">
                              {isIncoming ? 'From: ' : 'To: '}{truncate(counterparty)}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                              isIncoming ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                            }`}
                          >
                            {isIncoming ? 'Incoming' : 'Outgoing'}
                          </span>
                        </div>

                        {/* Amount & Currency */}
                        <div className="flex items-baseline gap-1 pt-1">
                          <span className="text-2xl font-black">{req.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          <span className="text-xs font-bold text-white/50">{req.asset}</span>
                        </div>

                        {/* Details */}
                        <div className="space-y-1 pt-1.5 text-xs text-white/60 font-medium font-sans border-t border-white/5">
                          <div className="flex justify-between">
                            <span className="text-white/30">Purpose</span>
                            <span className="text-white/95">{req.purpose}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/30">Created</span>
                            <span className="text-white/95">
                              {new Date(req.created_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          {req.message && (
                            <div className="pt-1.5 text-[10.5px] leading-relaxed text-white/50 border-t border-white/5 mt-1.5">
                              <p className="font-bold text-white/40 text-[9px] uppercase tracking-wider mb-0.5">Note</p>
                              <p className="italic font-normal">"{req.message}"</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Action footer */}
                      <div className="mt-5 pt-3.5 border-t border-white/5 flex justify-end gap-2.5 items-center">
                        {req.status === 'PENDING' && isIncoming && (
                          <>
                            <button
                              disabled={decliningId === req.id}
                              onClick={() => handleDeclineRequest(req.id)}
                              className="px-3 py-1.5 text-[10px] font-bold border border-white/10 hover:bg-white/5 text-rose-400 rounded-lg cursor-pointer transition-colors active:scale-95 disabled:opacity-50 shrink-0"
                            >
                              {decliningId === req.id ? 'Declining...' : 'Decline'}
                            </button>
                            <button
                              onClick={() => handlePayRequest(req)}
                              className="px-4.5 py-1.5 text-[10px] font-bold bg-white hover:bg-white/90 text-black rounded-lg cursor-pointer shadow-sm transition-all active:scale-95 shrink-0 flex items-center gap-1"
                            >
                              <Lock size={10} />
                              <span>Pay Request</span>
                            </button>
                          </>
                        )}

                        {req.status === 'PENDING' && !isIncoming && (
                          <span className="text-[10px] text-white/45 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Clock size={11} className="text-white/30" />
                            Awaiting Payment
                          </span>
                        )}

                        {req.status === 'COMPLETED' && (
                          <button
                            onClick={() => setSelectedReceipt(req)}
                            className="px-4 py-1.5 text-[10px] font-bold bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-white rounded-lg cursor-pointer transition-colors flex items-center gap-1 active:scale-95"
                          >
                            <FileText size={10} className="text-white/50" />
                            <span>View Receipt</span>
                          </button>
                        )}

                        {req.status === 'DECLINED' && (
                          <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1">
                            <XCircle size={11} />
                            Declined
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Cryptographic Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0F0F0F] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl text-white relative animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-extrabold tracking-tight uppercase text-white mb-4">Request Payment Receipt</h3>

            <div className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-4.5 space-y-3.5 text-xs">
              <div className="flex justify-between items-baseline gap-4">
                <span className="text-white/40 font-medium">Request ID</span>
                <span className="font-mono text-white/95 font-bold break-all select-all">{selectedReceipt.id}</span>
              </div>
              <div className="flex justify-between items-baseline gap-4 border-t border-white/5 pt-3">
                <span className="text-white/40 font-medium">Requester (Payee)</span>
                <span className="font-mono text-white/95 font-semibold break-all select-all">{truncate(selectedReceipt.requester_wallet)}</span>
              </div>
              <div className="flex justify-between items-baseline gap-4 border-t border-white/5 pt-3">
                <span className="text-white/40 font-medium">Sender (Payer)</span>
                <span className="font-mono text-white/95 font-semibold break-all select-all">{truncate(selectedReceipt.recipient_wallet)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-3">
                <span className="text-white/40 font-medium">Payment Amount</span>
                <span className="font-mono text-sm font-extrabold text-white">
                  {selectedReceipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {selectedReceipt.asset}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-3">
                <span className="text-white/40 font-medium">Status</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-400 uppercase text-[9px] bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <Check size={8} strokeWidth={3} />
                  Settled on Testnet
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-3">
                <span className="text-white/40 font-medium">Settled Timestamp</span>
                <span className="text-white/90 font-bold">
                  {new Date(selectedReceipt.updated_at).toLocaleString()}
                </span>
              </div>

              {selectedReceipt.transaction_hash && (
                <div className="border-t border-white/5 pt-3.5 text-xs flex flex-col gap-1.5">
                  <span className="text-white/40 font-medium">Stellar Transaction Hash</span>
                  <div className="flex items-center gap-2 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
                    <span className="font-mono text-[10px] text-white/75 truncate select-all flex-1">
                      {selectedReceipt.transaction_hash}
                    </span>
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${selectedReceipt.transaction_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="View on StellarExpert"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-5">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-5 py-2.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-white/90 transition-all cursor-pointer"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* consensus simulation loading overlay */}
      {isPaying && payingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#0F0F0F] border border-white/10 w-full max-w-lg rounded-3xl p-6 shadow-2xl text-white relative overflow-hidden">
            <div className="absolute -top-20 -left-20 w-44 h-44 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            {!successTxHash ? (
              <div className="flex flex-col items-center py-8 text-center space-y-6">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-white/5 animate-pulse" />
                  <Loader2 className="w-10 h-10 animate-spin text-white" />
                </div>

                <div className="space-y-1.5 max-w-xs">
                  <h3 className="font-bold text-lg">Stellar Ledger Consensus</h3>
                  <p className="text-xs text-white/55 leading-normal">
                    Fulfilling request of {payingRequest.amount} {payingRequest.asset}. Do not close this window.
                  </p>
                </div>

                {/* Checklist logs */}
                <div className="w-full max-w-sm bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-left font-mono text-[10px] space-y-2.5 text-white/40">
                  <div className="flex items-center gap-2.5">
                    <span className={payStep >= 1 ? 'text-emerald-400' : ''}>{payStep > 1 ? '✔' : '⚙'}</span>
                    <span className={payStep === 1 ? 'text-white font-bold' : payStep > 1 ? 'text-white/80' : ''}>
                      Constructing payment operation & loading ledger...
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={payStep >= 2 ? 'text-emerald-400' : ''}>{payStep > 2 ? '✔' : payStep === 2 ? '⚙' : '○'}</span>
                    <span className={payStep === 2 ? 'text-white font-bold' : payStep > 2 ? 'text-white/80' : ''}>
                      Awaiting signature verification from Freighter Wallet...
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={payStep >= 3 ? 'text-emerald-400' : ''}>{payStep > 3 ? '✔' : payStep === 3 ? '⚙' : '○'}</span>
                    <span className={payStep === 3 ? 'text-white font-bold' : payStep > 3 ? 'text-white/80' : ''}>
                      Submitting signed transaction envelope to Horizon network...
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              // Payment Consensus Finished State
              <div className="flex flex-col items-center space-y-6 py-6 animate-in zoom-in-95 duration-300 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Check className="text-emerald-400 w-6 h-6" strokeWidth={3} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-lg uppercase">Consensus Reached</h3>
                  <p className="text-xs text-white/50">Your payment has cleared and settled in under 5 seconds.</p>
                </div>

                <div className="w-full bg-white/[0.02] border border-white/5 rounded-2xl p-4.5 text-left text-xs space-y-3.5">
                  <div className="flex justify-between items-center">
                    <span className="text-white/40">Settled Amount</span>
                    <span className="font-mono text-sm font-extrabold text-white">
                      {payingRequest.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {payingRequest.asset}
                    </span>
                  </div>
                  {successTxHash && (
                    <div className="border-t border-white/5 pt-3.5 flex flex-col gap-1.5">
                      <span className="text-white/40">Transaction Hash</span>
                      <div className="flex items-center gap-2 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-1.5 w-full">
                        <span className="font-mono text-[10px] text-white/70 truncate flex-1 select-all">{successTxHash}</span>
                        <a
                          href={`https://stellar.expert/explorer/testnet/tx/${successTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setPayingRequest(null)
                    setSuccessTxHash(null)
                  }}
                  className="px-6 py-2.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-white/95 transition-all cursor-pointer active:scale-98 w-full"
                >
                  Return to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pay error modal warning */}
      {payError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0F0F0F] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl text-white">
            <div className="flex items-center gap-2.5 text-rose-400 mb-4">
              <XCircle className="w-6 h-6" />
              <h3 className="text-base font-bold">Payment Rejected</h3>
            </div>

            <p className="text-xs text-white/60 leading-relaxed font-semibold bg-white/[0.02] border border-white/5 rounded-xl p-4.5">
              {payError}
            </p>

            <div className="flex justify-end pt-5 gap-3">
              {payError.includes("USDC trustline is not established") && (
                <button
                  type="button"
                  disabled={isEstablishingTrustline}
                  onClick={handleEstablishTrustline}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/20 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isEstablishingTrustline ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Establishing...</span>
                    </>
                  ) : (
                    <span>Establish USDC Trustline</span>
                  )}
                </button>
              )}
              <button
                type="button"
                disabled={isEstablishingTrustline}
                onClick={() => {
                  setPayError(null)
                  setPayingRequest(null)
                }}
                className="px-5 py-2.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-white/95 transition-all cursor-pointer disabled:opacity-50"
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
