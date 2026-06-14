'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useWallet } from '@/context/WalletContext'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import {
  Coins,
  Wallet as WalletIcon,
  Loader2,
  Check,
  AlertTriangle,
  ArrowRight,
  QrCode,
  Copy,
  ExternalLink,
  Share2,
  FileText,
  DollarSign,
  User,
  Mail,
  ChevronDown
} from 'lucide-react'

// Sub-component to read search params safely in Suspense
function PaymentModeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const {
    publicKey,
    balance,
    isWrongNetwork,
    connect,
    isConnecting
  } = useWallet()

  // Active tab: 'pay' (Pay Tuition) or 'invoice' (Send Request)
  const [activeTab, setActiveTab] = useState<'pay' | 'invoice'>('pay')

  // Selected payment method inside the Pay tab
  const [selectedMethod, setSelectedMethod] = useState<'xlm' | 'usdc' | 'path'>('xlm')

  // Swap calculator states
  const [swapSourceAsset, setSwapSourceAsset] = useState<'ARST' | 'BRLT' | 'EURC' | 'YBX'>('ARST')
  
  // Invoice form states
  const [sponsorName, setSponsorName] = useState('')
  const [sponsorEmail, setSponsorEmail] = useState('')
  const [invoiceAmount, setInvoiceAmount] = useState('4500.00')
  const [studentMemo, setStudentMemo] = useState('NP-2026-8809')
  const [invoiceLink, setInvoiceLink] = useState<string | null>(null)
  const [copiedInvoice, setCopiedInvoice] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  // Transaction simulation states
  const [isSimulating, setIsSimulating] = useState(false)
  const [simStep, setSimStep] = useState(0)
  const [txHash, setTxHash] = useState('')
  const [isTxComplete, setIsTxComplete] = useState(false)
  const [simError, setSimError] = useState<string | null>(null)

  // Sync tab from URL query parameter
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'invoice') {
      setActiveTab('invoice')
    } else {
      setActiveTab('pay')
    }
  }, [searchParams])

  // Setup mock invoice link
  useEffect(() => {
    if (activeTab === 'invoice') {
      setInvoiceLink(null)
      setEmailSent(false)
    }
  }, [activeTab, sponsorName, sponsorEmail, invoiceAmount])

  // Truncate address helper
  const truncate = (str: string | null) => str ? `${str.slice(0, 8)}...${str.slice(-8)}` : 'Not connected'

  // Mock exchange rates: how much source asset is needed to pay $4500 USDC
  const getSwapEstimation = () => {
    switch (swapSourceAsset) {
      case 'ARST':
        return {
          rate: '950.00 ARST = 1 USDC',
          path: 'ARST ➔ XLM ➔ USDC',
          totalNeeded: '4,275,000.00 ARST',
          minReceived: '4,500.00 USDC',
          pathFee: '0.00013 XLM'
        }
      case 'BRLT':
        return {
          rate: '5.60 BRLT = 1 USDC',
          path: 'BRLT ➔ XLM ➔ USDC',
          totalNeeded: '25,200.00 BRLT',
          minReceived: '4,500.00 USDC',
          pathFee: '0.00011 XLM'
        }
      case 'EURC':
        return {
          rate: '0.92 EURC = 1 USDC',
          path: 'EURC ➔ XLM ➔ USDC',
          totalNeeded: '4,140.00 EURC',
          minReceived: '4,500.00 USDC',
          pathFee: '0.00015 XLM'
        }
      case 'YBX':
        return {
          rate: '18.50 YBX = 1 USDC',
          path: 'YBX ➔ XLM ➔ USDC',
          totalNeeded: '83,250.00 YBX',
          minReceived: '4,500.00 USDC',
          pathFee: '0.00014 XLM'
        }
    }
  }

  // Handle invoice link generation
  const handleGenerateInvoice = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sponsorName || !sponsorEmail || !invoiceAmount) {
      alert('Please fill out all invoice details.')
      return
    }
    const randomId = Math.random().toString(36).substring(2, 12)
    setInvoiceLink(`https://novapay.co/pay-tuition?id=inv_${randomId}`)
  }

  // Handle copying invoice link
  const handleCopyLink = () => {
    if (!invoiceLink) return
    navigator.clipboard.writeText(invoiceLink)
    setCopiedInvoice(true)
    setTimeout(() => setCopiedInvoice(false), 2000)
  }

  // Handle email sending simulation
  const handleSendEmail = () => {
    setIsSendingEmail(true)
    setTimeout(() => {
      setIsSendingEmail(false)
      setEmailSent(true)
    }, 1500)
  }

  // Trigger payments simulation
  const triggerPaymentSimulation = () => {
    if (!publicKey) {
      connect()
      return
    }

    setSimError(null)
    setIsSimulating(true)
    setSimStep(0)
    setIsTxComplete(false)

    const steps = [
      'Connecting to Freighter Wallet Node...',
      'Resolving swap paths on Stellar DEX orderbooks...',
      'Constructing transaction envelope...',
      'Awaiting signature verification from Freighter...',
      'Submitting transaction envelope to Horizon Testnet...',
      'Validating ledger consensus...'
    ]

    let currentStep = 0
    const interval = setInterval(() => {
      currentStep++
      if (currentStep < steps.length) {
        setSimStep(currentStep)
      } else {
        clearInterval(interval)
        // Set mock transaction hash and finish
        const hash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
        setTxHash(hash)
        setIsTxComplete(true)
      }
    }, 1200)
  }

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
  const swapDetails = getSwapEstimation()

  return (
    <div className="flex flex-col min-h-screen bg-white text-black selection:bg-black selection:text-white relative overflow-hidden">
      {/* Hero Radial Glow */}
      <div
        className="absolute top-0 left-0 w-full h-[550px] pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.45), transparent)',
          filter: 'blur(60px)',
          zIndex: 0,
        }}
      />

      {/* Grid background fading down */}
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
        
        {/* Top Header Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight font-sans">Payment Routing Hub</h1>
            <p className="text-sm text-black/50 mt-1 font-medium font-sans">
              Choose your preferred settlement method on the Stellar blockchain.
            </p>
          </div>

          {/* Connected Wallet Bar */}
          <div className="bg-black/95 border border-white/10 rounded-2xl px-5 py-3.5 flex items-center gap-4 text-white shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full ${publicKey ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
              <div>
                <p className="text-[9px] uppercase tracking-wider text-white/40 font-bold">Freighter Wallet</p>
                <p className="font-mono text-xs text-white/90 font-medium mt-0.5">{truncate(publicKey)}</p>
              </div>
            </div>
            {publicKey && balance !== null && (
              <div className="border-l border-white/10 pl-4">
                <p className="text-[9px] uppercase tracking-wider text-white/40 font-bold">Balance</p>
                <p className="text-xs font-black text-white mt-0.5">{balance} XLM</p>
              </div>
            )}
            {!publicKey && (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="px-4 py-2 bg-white text-black hover:bg-white/95 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 flex items-center gap-1"
              >
                {isConnecting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <WalletIcon size={12} />
                )}
                <span>Connect</span>
              </button>
            )}
          </div>
        </div>

        {/* Primary Page Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          
          {/* Left Panel: Tuition Summary & Tab Navigation */}
          <div className="space-y-6">
            
            {/* Tuition Card */}
            <div className="bg-black/95 border border-white/10 rounded-3xl p-6 shadow-xl shadow-black/30 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.02] rounded-full blur-xl pointer-events-none" />
              <span className="text-[10px] tracking-wider uppercase font-bold text-white/40 block">Tuition Ledger Balance</span>
              <div className="flex items-baseline gap-1 mt-2.5">
                <span className="text-3xl font-black text-white">$4,500.00</span>
                <span className="text-sm text-white/50 font-bold uppercase">USD</span>
              </div>

              <div className="border-t border-white/10 my-4.5" />

              <div className="space-y-3 text-xs font-semibold text-white/60">
                <div className="flex justify-between">
                  <span className="text-white/40">Student Name</span>
                  <span className="text-white/95">{isAuthenticated && user ? user.full_name : 'Test User'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">University ID</span>
                  <span className="text-white/95">NP-2026-8809</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Term Period</span>
                  <span className="text-white/95">Fall Semester 2026</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Payment Status</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Pending Settlement
                  </span>
                </div>
              </div>
            </div>

            {/* Selector Tabs */}
            <div className="bg-white border border-black/10 p-1.5 rounded-2xl shadow-sm space-y-1">
              <button
                onClick={() => {
                  setActiveTab('pay')
                  router.push('/payment-mode?tab=pay')
                }}
                className={`w-full py-3 px-4 text-xs font-bold rounded-xl transition-all text-left flex items-center gap-3 cursor-pointer ${
                  activeTab === 'pay'
                    ? 'bg-black text-white shadow-md shadow-black/15'
                    : 'text-black/60 hover:text-black hover:bg-black/[0.02]'
                }`}
              >
                <Coins size={16} />
                <div className="flex-1">
                  <p className="font-extrabold">Pay Tuition Directly</p>
                  <p className={`text-[10px] font-medium mt-0.5 ${activeTab === 'pay' ? 'text-white/60' : 'text-black/40'}`}>
                    Settle using your linked wallet
                  </p>
                </div>
              </button>

              <button
                onClick={() => {
                  setActiveTab('invoice')
                  router.push('/payment-mode?tab=invoice')
                }}
                className={`w-full py-3 px-4 text-xs font-bold rounded-xl transition-all text-left flex items-center gap-3 cursor-pointer ${
                  activeTab === 'invoice'
                    ? 'bg-black text-white shadow-md shadow-black/15'
                    : 'text-black/60 hover:text-black hover:bg-black/[0.02]'
                }`}
              >
                <Share2 size={16} />
                <div className="flex-1">
                  <p className="font-extrabold">Send Invoice Request</p>
                  <p className={`text-[10px] font-medium mt-0.5 ${activeTab === 'invoice' ? 'text-white/60' : 'text-black/40'}`}>
                    Generate payment link for sponsors
                  </p>
                </div>
              </button>
            </div>

          </div>

          {/* Right Panel: Active Tab View */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Pay Tuition directly */}
            {activeTab === 'pay' && (
              <div className="space-y-6">
                
                {/* Method Option 1: Direct XLM */}
                <div
                  onClick={() => setSelectedMethod('xlm')}
                  className={`bg-black/95 border rounded-3xl p-6 shadow-xl shadow-black/35 cursor-pointer transition-all duration-300 flex items-start gap-4 text-white relative ${
                    selectedMethod === 'xlm' ? 'border-white/40 ring-1 ring-white/20' : 'border-white/10 opacity-70 hover:opacity-95'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedMethod === 'xlm' ? 'border-white bg-white text-black' : 'border-white/20'
                  }`}>
                    {selectedMethod === 'xlm' && <Check size={12} strokeWidth={3} />}
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Coins className="text-white/60" size={18} />
                        <h3 className="font-bold text-base">Option A: Direct XLM Routing</h3>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Fastest</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                        <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider block">Estimated Amount</span>
                        <span className="font-mono text-base font-extrabold text-white block mt-0.5">37,500.00 XLM</span>
                      </div>
                      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                        <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider block">Network / Path Fee</span>
                        <span className="font-mono text-xs font-semibold text-emerald-400 block mt-1">0.00001 XLM (Free)</span>
                      </div>
                    </div>

                    <p className="text-xs text-white/55 leading-normal">
                      Settle tuition ledger instantly using Stellar Lumens. Your payment path converts directly on the network with zero intermediator fees.
                    </p>

                    {selectedMethod === 'xlm' && (
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            triggerPaymentSimulation()
                          }}
                          className="px-6 py-2.5 bg-white text-black hover:bg-white/95 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-98"
                        >
                          <span>Settle with XLM</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Method Option 2: USDC stablecoin */}
                <div
                  onClick={() => setSelectedMethod('usdc')}
                  className={`bg-black/95 border rounded-3xl p-6 shadow-xl shadow-black/35 cursor-pointer transition-all duration-300 flex items-start gap-4 text-white relative ${
                    selectedMethod === 'usdc' ? 'border-white/40 ring-1 ring-white/20' : 'border-white/10 opacity-70 hover:opacity-95'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedMethod === 'usdc' ? 'border-white bg-white text-black' : 'border-white/20'
                  }`}>
                    {selectedMethod === 'usdc' && <Check size={12} strokeWidth={3} />}
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="text-white/60" size={18} />
                        <h3 className="font-bold text-base">Option B: USDC Stablecoin Settlement</h3>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Volatiles Shield</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                        <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider block">Required USDC</span>
                        <span className="font-mono text-base font-extrabold text-white block mt-0.5">4,500.00 USDC</span>
                      </div>
                      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                        <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider block">Network / Path Fee</span>
                        <span className="font-mono text-xs font-semibold text-emerald-400 block mt-1">0.00001 XLM (Free)</span>
                      </div>
                    </div>

                    <p className="text-xs text-white/55 leading-normal">
                      Pay tuition using USDC stablecoin on the Stellar network. Settle value pegged directly to the USD with zero slippage or market exposure.
                    </p>

                    {selectedMethod === 'usdc' && (
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            triggerPaymentSimulation()
                          }}
                          className="px-6 py-2.5 bg-white text-black hover:bg-white/95 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-98"
                        >
                          <span>Settle with USDC</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Method Option 3: Path Payment Swap */}
                <div
                  onClick={() => setSelectedMethod('path')}
                  className={`bg-black/95 border rounded-3xl p-6 shadow-xl shadow-black/35 cursor-pointer transition-all duration-300 flex items-start gap-4 text-white relative ${
                    selectedMethod === 'path' ? 'border-white/40 ring-1 ring-white/20' : 'border-white/10 opacity-70 hover:opacity-95'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedMethod === 'path' ? 'border-white bg-white text-black' : 'border-white/20'
                  }`}>
                    {selectedMethod === 'path' && <Check size={12} strokeWidth={3} />}
                  </div>

                  <div className="flex-1 space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Coins className="text-white/60" size={18} />
                        <h3 className="font-bold text-base">Option C: Cross-Asset Path Swap</h3>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Smart Routing</span>
                    </div>

                    {/* Interactive Dropdown selection */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] text-white/45 font-bold uppercase tracking-wider pl-1">Select Source Asset in Wallet</label>
                      <div className="relative">
                        <select
                          value={swapSourceAsset}
                          onChange={(e) => setSwapSourceAsset(e.target.value as any)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full appearance-none px-4 py-3 bg-white/[0.04] border border-white/10 hover:border-white/20 rounded-xl text-xs text-white placeholder-white/20 focus:outline-none transition-all font-semibold font-sans cursor-pointer"
                        >
                          <option value="ARST" className="bg-[#0F0F0F] text-white font-semibold">ARST (Argentine Peso Token)</option>
                          <option value="BRLT" className="bg-[#0F0F0F] text-white font-semibold">BRLT (Brazilian Real Token)</option>
                          <option value="EURC" className="bg-[#0F0F0F] text-white font-semibold">EURC (Euro Stablecoin)</option>
                          <option value="YBX" className="bg-[#0F0F0F] text-white font-semibold">YBX (YieldBox Token)</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={14} />
                      </div>
                    </div>

                    {/* Live estimations container */}
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4.5 space-y-3.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-white/40 font-medium">Estimated Exchange Rate</span>
                        <span className="font-mono text-white/95 font-bold">{swapDetails.rate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40 font-medium">Path Route on Stellar DEX</span>
                        <span className="font-mono text-white/95 font-bold text-[11px]">{swapDetails.path}</span>
                      </div>
                      <div className="flex justify-between border-t border-white/5 pt-3">
                        <span className="text-white/40 font-medium">Network / Routing Fee</span>
                        <span className="font-mono text-emerald-400 font-bold">{swapDetails.pathFee}</span>
                      </div>
                      <div className="flex justify-between border-t border-white/5 pt-3 items-center">
                        <span className="text-white/40 font-medium">Total Source Asset Required</span>
                        <span className="font-mono text-base font-extrabold text-white">{swapDetails.totalNeeded}</span>
                      </div>
                    </div>

                    <p className="text-xs text-white/55 leading-normal">
                      Leverages Stellar's path payments. Instantly swaps your source asset for USDC stablecoins inside the ledger transaction, guaranteeing immediate USDC settlement.
                    </p>

                    {selectedMethod === 'path' && (
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            triggerPaymentSimulation()
                          }}
                          className="px-6 py-2.5 bg-white text-black hover:bg-white/95 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-98"
                        >
                          <span>Swap & Settle Tuition</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Send invoice request */}
            {activeTab === 'invoice' && (
              <div className="bg-black/95 border border-white/10 rounded-3xl p-6 shadow-xl shadow-black/35 text-white space-y-6">
                <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                  <Share2 className="text-white/60" size={20} />
                  <h3 className="font-bold text-lg text-white">Generate Tuition Request Link</h3>
                </div>

                <p className="text-xs text-white/50 leading-relaxed font-medium">
                  Create a secure payment link on the Stellar network for parents or sponsors. They can pay directly in their local currencies via credit cards or domestic bank transfers, which are automatically converted to USDC stablecoins and credited to your student ledger.
                </p>

                <form onSubmit={handleGenerateInvoice} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">Sponsor Name</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-white/30 pointer-events-none">
                          <User size={14} />
                        </span>
                        <input
                          type="text"
                          required
                          value={sponsorName}
                          onChange={(e) => setSponsorName(e.target.value)}
                          placeholder="John Doe"
                          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-medium font-sans"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">Sponsor Email</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-white/30 pointer-events-none">
                          <Mail size={14} />
                        </span>
                        <input
                          type="email"
                          required
                          value={sponsorEmail}
                          onChange={(e) => setSponsorEmail(e.target.value)}
                          placeholder="parent@example.com"
                          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-medium font-sans"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">Amount (USD)</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-white/30 pointer-events-none">
                          <DollarSign size={14} />
                        </span>
                        <input
                          type="number"
                          required
                          value={invoiceAmount}
                          onChange={(e) => setInvoiceAmount(e.target.value)}
                          placeholder="4500.00"
                          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-medium font-sans"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">Custom Memo / Student ID</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-white/30 pointer-events-none">
                          <FileText size={14} />
                        </span>
                        <input
                          type="text"
                          required
                          value={studentMemo}
                          onChange={(e) => setStudentMemo(e.target.value)}
                          placeholder="NP-2026-8809"
                          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-medium font-sans"
                        />
                      </div>
                    </div>
                  </div>

                  {!invoiceLink && (
                    <div className="flex justify-end pt-3">
                      <button
                        type="submit"
                        className="px-6 py-3 bg-white text-black hover:bg-white/95 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-98"
                      >
                        <QrCode size={14} />
                        <span>Generate Invoice QR Code</span>
                      </button>
                    </div>
                  )}
                </form>

                {/* Generated Invoice Result Card */}
                {invoiceLink && (
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      
                      {/* Premium Mock QR Code */}
                      <div className="w-28 h-28 bg-white p-2 rounded-xl flex items-center justify-center shrink-0 border border-white/10 relative overflow-hidden">
                        {/* Custom visual QR Code structure using Tailwind classes */}
                        <div className="w-full h-full border-[6px] border-black flex flex-col justify-between p-1">
                          <div className="flex justify-between">
                            <div className="w-5 h-5 bg-black" />
                            <div className="w-5 h-5 bg-black" />
                          </div>
                          {/* Inner pixels noise */}
                          <div className="flex-1 flex flex-wrap gap-1 px-1 py-1 text-black font-mono leading-none tracking-tight select-none">
                            <span className="text-[7px]">▞▚▞▚▞▚</span>
                            <span className="text-[7px]">▚▞▚▞▚▞</span>
                            <span className="text-[7px]">▞▚▞▚▞▚</span>
                          </div>
                          <div className="flex justify-between">
                            <div className="w-5 h-5 bg-black" />
                            <div className="w-3 h-3 bg-black mt-2 mr-2" />
                          </div>
                        </div>
                        <div className="absolute inset-0 bg-black/5 flex items-center justify-center pointer-events-none">
                          <QrCode className="text-black/20 w-8 h-8" />
                        </div>
                      </div>

                      {/* Invoice Link Details */}
                      <div className="flex-1 space-y-3 w-full text-center sm:text-left">
                        <div>
                          <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Tuition Invoice Link</p>
                          <p className="text-sm font-bold mt-0.5">Ready for sharing with {sponsorName}</p>
                        </div>

                        <div className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-xl px-3.5 py-2">
                          <span className="font-mono text-xs text-white/80 select-all flex-1 truncate">{invoiceLink}</span>
                          <button
                            onClick={handleCopyLink}
                            className="p-1.5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Copy link"
                          >
                            {copiedInvoice ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1.5">
                          <button
                            onClick={handleSendEmail}
                            disabled={isSendingEmail || emailSent}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:bg-white/5 text-white border border-white/5 hover:border-white/10 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            {isSendingEmail ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Sending...</span>
                              </>
                            ) : emailSent ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Sent to Sponsor</span>
                              </>
                            ) : (
                              <>
                                <Mail size={12} className="text-white/60" />
                                <span>Send to Sponsor Email</span>
                              </>
                            )}
                          </button>

                          <a
                            href={invoiceLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 border border-white/10 hover:border-white/20 hover:bg-white/5 text-white/80 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <span>Open invoice</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            )}
            
          </div>
        </div>
      </main>

      {/* Interactive Ledger Consensus Simulator Overlay */}
      {isSimulating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0F0F0F] border border-white/10 w-full max-w-lg rounded-3xl p-6 shadow-2xl relative overflow-hidden text-white">
            
            {/* Background Glow */}
            <div className="absolute -top-20 -left-20 w-44 h-44 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            
            {!isTxComplete ? (
              // Consensus Steps State
              <div className="flex flex-col items-center py-8 text-center space-y-6">
                
                {/* Loader ring animation */}
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-white/5" />
                  <Loader2 className="w-10 h-10 animate-spin text-white" />
                </div>

                <div className="space-y-1.5 max-w-xs">
                  <h3 className="font-bold text-lg">Stellar Ledger consensus</h3>
                  <p className="text-xs text-white/55 leading-normal">
                    Please do not close this window or navigate away. Submitting transaction envelope to the testnet Horizon node.
                  </p>
                </div>

                {/* Consensus steps checklist logs */}
                <div className="w-full max-w-sm bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-left font-mono text-[10px] space-y-2.5 text-white/40">
                  <div className="flex items-center gap-2.5">
                    <span className={simStep >= 0 ? 'text-emerald-400' : ''}>{simStep > 0 ? '✔' : '⚙'}</span>
                    <span className={simStep === 0 ? 'text-white font-bold' : simStep > 0 ? 'text-white/80' : ''}>
                      Connecting to Freighter wallet...
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={simStep >= 1 ? 'text-emerald-400' : ''}>{simStep > 1 ? '✔' : simStep === 1 ? '⚙' : '○'}</span>
                    <span className={simStep === 1 ? 'text-white font-bold' : simStep > 1 ? 'text-white/80' : ''}>
                      Resolving swap paths on Stellar DEX orderbooks...
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={simStep >= 2 ? 'text-emerald-400' : ''}>{simStep > 2 ? '✔' : simStep === 2 ? '⚙' : '○'}</span>
                    <span className={simStep === 2 ? 'text-white font-bold' : simStep > 2 ? 'text-white/80' : ''}>
                      Constructing transaction transaction envelope...
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={simStep >= 3 ? 'text-emerald-400' : ''}>{simStep > 3 ? '✔' : simStep === 3 ? '⚙' : '○'}</span>
                    <span className={simStep === 3 ? 'text-white font-bold' : simStep > 3 ? 'text-white/80' : ''}>
                      Awaiting signature verification from Freighter...
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={simStep >= 4 ? 'text-emerald-400' : ''}>{simStep > 4 ? '✔' : simStep === 4 ? '⚙' : '○'}</span>
                    <span className={simStep === 4 ? 'text-white font-bold' : simStep > 4 ? 'text-white/80' : ''}>
                      Submitting envelope to Horizon Testnet...
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={simStep >= 5 ? 'text-emerald-400' : ''}>{simStep > 5 ? '✔' : simStep === 5 ? '⚙' : '○'}</span>
                    <span className={simStep === 5 ? 'text-white font-bold' : simStep > 5 ? 'text-white/80' : ''}>
                      Validating ledger consensus...
                    </span>
                  </div>
                </div>

              </div>
            ) : (
              // Transaction Cryptographic Receipt Success State
              <div className="flex flex-col items-center space-y-6 animate-in zoom-in-95 duration-300">
                
                {/* Glowing Success Badge */}
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-lg shadow-emerald-500/5">
                  <Check className="text-emerald-400 w-6 h-6" strokeWidth={3} />
                </div>

                <div className="text-center">
                  <h3 className="font-extrabold text-xl tracking-tight uppercase">Tuition Payment Successful</h3>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-2">
                    Settled on Ledger
                  </span>
                </div>

                {/* Cryptographic Receipt Details */}
                <div className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/40 font-medium">Receipt ID</span>
                    <span className="font-mono text-white/90 font-bold">NP-REC-489028</span>
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-white/5 pt-3">
                    <span className="text-white/40 font-medium">Student</span>
                    <span className="text-white/90 font-bold">{isAuthenticated && user ? user.full_name : 'Test User'}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-white/5 pt-3">
                    <span className="text-white/40 font-medium">Settled Amount</span>
                    <span className="font-mono text-sm font-extrabold text-white">
                      {selectedMethod === 'xlm' 
                        ? '37,500.00 XLM' 
                        : selectedMethod === 'usdc'
                          ? '4,500.00 USDC'
                          : `4,500.00 USDC (via ${swapSourceAsset} swap)`
                      }
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-white/5 pt-3">
                    <span className="text-white/40 font-medium">Stellar Ledger Index</span>
                    <span className="font-mono text-white/95 font-bold">59,392,104</span>
                  </div>

                  {/* Transaction Hash */}
                  <div className="border-t border-white/5 pt-3.5 text-xs flex flex-col gap-1.5">
                    <span className="text-white/40 font-medium">Stellar Transaction Hash</span>
                    <div className="flex items-center gap-2 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
                      <span className="font-mono text-[10px] text-white/75 truncate select-all flex-1">{txHash}</span>
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="View on StellarExpert"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Confirm / Close CTAs */}
                <div className="flex justify-end gap-3 w-full border-t border-white/10 pt-4 mt-2">
                  <button
                    onClick={() => {
                      setIsSimulating(false)
                      router.push('/')
                    }}
                    className="px-5 py-2.5 text-xs font-bold border border-white/10 hover:bg-white/5 rounded-xl text-white/70 hover:text-white cursor-pointer active:scale-98"
                  >
                    Back to Home
                  </button>
                  <button
                    onClick={() => setIsSimulating(false)}
                    className="px-6 py-2.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-white/95 transition-all cursor-pointer active:scale-98"
                  >
                    Close Receipt
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

export default function PaymentModePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-black/50 text-sm gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-black" />
        <span>Loading payment route options...</span>
      </div>
    }>
      <PaymentModeContent />
    </Suspense>
  )
}
