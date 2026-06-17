'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useWallet } from '@/context/WalletContext'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { API_URL } from '@/config'
import {
  Wallet as WalletIcon,
  CreditCard,
  Landmark,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Link2,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Maximize2
} from 'lucide-react'

interface PaymentMethod {
  id: string
  user_id: string
  provider: string
  wallet_address: string
  network: string
  status: string
  is_default: boolean
  created_at: string
}

interface PaymentLink {
  id: string
  creator_wallet: string
  amount: number
  asset: string
  status: string
  created_at: string
}

export default function PaymentMethodsPage() {
  const router = useRouter()
  const { user, token, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const { publicKey, connect, isConnecting, disconnect } = useWallet()

  // State
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [isLoadingMethods, setIsLoadingMethods] = useState(false)
  const [xlmBalance, setXlmBalance] = useState<string>('0.00')
  const [usdcBalance, setUsdcBalance] = useState<string>('0.00')
  const [isNotFunded, setIsNotFunded] = useState(false)
  const [isLoadingBalances, setIsLoadingBalances] = useState(false)

  // Payment Link Generator State
  const [linkAmount, setLinkAmount] = useState('')
  const [linkAsset, setLinkAsset] = useState('USDC')
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)

  // UI Modals
  const [showAddressModal, setShowAddressModal] = useState(false)

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isAuthLoading, router])

  // Fetch payment methods and balances when authenticated & wallet is connected
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchPaymentMethods()
    }
  }, [isAuthenticated, token, publicKey])

  useEffect(() => {
    if (publicKey) {
      fetchBalances(publicKey)
    } else {
      setXlmBalance('0.00')
      setUsdcBalance('0.00')
      setIsNotFunded(false)
    }
  }, [publicKey])

  const fetchPaymentMethods = async () => {
    if (!token) return
    setIsLoadingMethods(true)
    try {
      const res = await fetch(`${API_URL}/api/payment-methods`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setMethods(data)
      }
    } catch (err) {
      console.error('Error fetching payment methods:', err)
    } finally {
      setIsLoadingMethods(false)
    }
  }

  const fetchBalances = async (address: string) => {
    setIsLoadingBalances(true)
    try {
      const res = await fetch(`${API_URL}/api/payment-methods/balances?address=${address}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setXlmBalance(Number(data.xlm).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }))
        setUsdcBalance(Number(data.usdc).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }))
        setIsNotFunded(data.isNotFunded || false)
      }
    } catch (err) {
      console.error('Error fetching balances:', err)
    } finally {
      setIsLoadingBalances(false)
    }
  }

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkAmount || isNaN(parseFloat(linkAmount)) || parseFloat(linkAmount) <= 0) return
    if (!token || !publicKey) {
      alert('Authentication token or connected wallet address is missing. Please reconnect and try again.')
      return
    }

    setIsGeneratingLink(true)
    setGeneratedLink(null)
    try {
      const res = await fetch(`${API_URL}/api/payment-links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(linkAmount),
          asset: linkAsset
        })
      })
      const data = await res.json()
      if (res.ok) {
        const payUrl = `${window.location.origin}/pay/${data.id}`
        setGeneratedLink(payUrl)
        setLinkAmount('')
      } else {
        alert(data.error || 'Failed to generate payment link')
      }
    } catch (err) {
      console.error('Error generating link:', err)
      alert('Connection failed')
    } finally {
      setIsGeneratingLink(false)
    }
  }

  const handleCopyLink = () => {
    if (!generatedLink) return
    navigator.clipboard.writeText(generatedLink)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleCopyAddress = () => {
    if (!publicKey) return
    navigator.clipboard.writeText(publicKey)
    setCopiedAddress(true)
    setTimeout(() => setCopiedAddress(false), 2000)
  }

  // Generate SVG background grid helper (matching send-money style)
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

    activeCells.forEach((cell) => {
      const startX = cell.col * 96
      const startY = cell.row * 96
      const lineCount = 11
      const paddingX = 14
      const startYOffset = 16
      const gap = 6

      linesHtml += `<g stroke="black" stroke-opacity="0.22" stroke-width="1.8" stroke-linecap="round">`
      for (let l = 0; l < lineCount; l++) {
        const y = startY + startYOffset + l * gap
        const isIndented = (cell.seed + l) % 3 === 0 && l > 1 && l < lineCount - 2
        const indent = isIndented ? 12 : 0
        const left = startX + paddingX + indent
        const lengthFactor = Math.abs(Math.sin(cell.seed * 1.5 + l * 2.3))
        const maxLength = 96 - paddingX * 2 - indent
        const lineLength = 15 + lengthFactor * (maxLength - 15)
        const right = left + lineLength
        linesHtml += `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" />`
      }
      linesHtml += `</g>`
    })

    return `<svg xmlns="http://www.w3.org/2000/svg" width="384" height="384" viewBox="0 0 384 384">${linesHtml}</svg>`
  }

  const gridBackground = `url("data:image/svg+xml,${encodeURIComponent(generateGridSvg())}")`

  // Loading state
  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-black/50 text-sm gap-2.5">
        <Loader2 className="w-6 h-6 animate-spin text-black" />
        <span>Syncing payment dashboard...</span>
      </div>
    )
  }

  const defaultMethod = methods.find((m) => m.is_default) || (publicKey ? { provider: 'FREIGHTER', wallet_address: publicKey } : null)

  return (
    <div className="flex flex-col min-h-screen bg-white text-black selection:bg-black selection:text-white relative overflow-hidden">
      {/* Top Black Fading Radial Glow */}
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

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 pt-32 pb-16 relative z-10">
        {/* Page Title */}
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight font-sans">Payment Methods</h1>
          <p className="text-sm text-black/50 mt-1 font-medium font-sans">
            Connect Stellar wallets, manage default funding, and create shareable payment links.
          </p>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start mb-16">
          {/* Left panel: connected Freighter wallet & Preferred Default Preferences */}
          <div className="md:col-span-2 space-y-8">
            {/* Wallet Details panel */}
            <div className="bg-black/95 border border-white/10 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6">
                <span className="px-2 py-0.5 rounded text-[8px] bg-white/10 text-white/80 border border-white/10 font-bold uppercase tracking-wider">
                  Testnet Ledger
                </span>
              </div>

              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider block">Connected Wallet Source</span>

              {publicKey ? (
                <div className="space-y-6 mt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/10 border border-white/20 rounded-full flex items-center justify-center">
                        <WalletIcon size={22} className="text-white/90" />
                      </div>
                      <div>
                        <p className="text-[9px] text-white/40 uppercase font-bold tracking-wider">Freighter Account Provider</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="font-mono text-xs font-semibold text-white/95">{publicKey.slice(0, 12)}...{publicKey.slice(-12)}</p>
                          <button
                            onClick={handleCopyAddress}
                            className="p-1 hover:bg-white/10 rounded text-white/60 hover:text-white transition-colors"
                            title="Copy Wallet Address"
                          >
                            {copiedAddress ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          </button>
                          <button
                            onClick={() => setShowAddressModal(true)}
                            className="p-1 hover:bg-white/10 rounded text-white/60 hover:text-white transition-colors"
                            title="Expand Address"
                          >
                            <Maximize2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-6">
                    <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider block">Live Balance Ledger</span>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                        <span className="text-[9px] text-white/40 uppercase font-bold tracking-wider">Native Asset (XLM)</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="font-mono text-xl font-bold text-white">
                            {isLoadingBalances ? (
                              <Loader2 size={14} className="animate-spin text-white/40 inline" />
                            ) : (
                              xlmBalance
                            )}
                          </span>
                          <span className="text-[10px] text-white/40 font-bold">XLM</span>
                        </div>
                      </div>
                      <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                        <span className="text-[9px] text-white/40 uppercase font-bold tracking-wider">Stablecoin Asset (USDC)</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="font-mono text-xl font-bold text-white">
                            {isLoadingBalances ? (
                              <Loader2 size={14} className="animate-spin text-white/40 inline" />
                            ) : (
                              usdcBalance
                            )}
                          </span>
                          <span className="text-[10px] text-white/40 font-bold">USDC</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isNotFunded && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3 text-amber-400 text-xs">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold uppercase tracking-wider text-[10px]">Unfunded Wallet</p>
                        <p className="font-medium text-white/70 leading-relaxed">
                          Your wallet address has not been funded on the Stellar Testnet ledger yet. Send a test payment or use friendbot to instantiate this account.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => fetchBalances(publicKey)}
                      className="px-4 py-2 text-xs font-bold border border-white/10 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                    >
                      Refresh Balances
                    </button>
                    <button
                      onClick={disconnect}
                      className="px-4 py-2 text-xs font-bold bg-white text-black hover:bg-white/90 rounded-xl transition-all cursor-pointer"
                    >
                      Disconnect Wallet
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center space-y-5">
                  <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mx-auto">
                    <WalletIcon size={24} className="text-white/40" />
                  </div>
                  <div className="max-w-xs mx-auto space-y-1.5">
                    <h3 className="font-bold text-sm">No Connected Wallet Found</h3>
                    <p className="text-xs text-white/50 leading-relaxed font-medium">
                      Authenticate with your Freighter wallet to view account balances, receive payments, and sign transactions.
                    </p>
                  </div>
                  <button
                    onClick={connect}
                    disabled={isConnecting}
                    className="px-6 py-3 bg-white text-black hover:bg-white/95 disabled:bg-white/20 disabled:text-black/45 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                  >
                    {isConnecting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <WalletIcon size={14} />
                    )}
                    <span>Connect Freighter Wallet</span>
                  </button>
                </div>
              )}
            </div>

            {/* Default Preference Setting */}
            {publicKey && (
              <div className="bg-black/95 border border-white/10 rounded-3xl p-8 text-white shadow-2xl">
                <h3 className="text-base font-bold mb-4">Preferred Payment Method</h3>
                <div className="bg-white/[0.02] border border-emerald-500/30 rounded-2xl p-5 flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
                      <Check className="text-emerald-400" size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm flex items-center gap-2">
                        Freighter Wallet
                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">
                          Default
                        </span>
                      </h4>
                      <p className="text-xs text-white/60 font-mono mt-1 font-semibold">
                        {publicKey.slice(0, 10)}...{publicKey.slice(-10)}
                      </p>
                      <p className="text-[10px] text-white/40 mt-2 font-medium">
                        Used automatically for processing outgoing transfers and settling payment requests.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Link Generator Section */}
            {publicKey && (
              <div className="bg-black/95 border border-white/10 rounded-3xl p-8 text-white shadow-2xl">
                <div className="flex items-center gap-2.5 mb-2">
                  <Link2 className="text-white/60" size={18} />
                  <h3 className="text-base font-bold">Generate Shareable Payment Link</h3>
                </div>
                <p className="text-xs text-white/50 mb-6 font-medium leading-relaxed">
                  Create a unique, persistent URL for invoice settlements. Payers can open this link to settle funds immediately without logging in.
                </p>

                <form onSubmit={handleGenerateLink} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">Amount</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={linkAmount}
                        onChange={(e) => setLinkAmount(e.target.value)}
                        placeholder="50.00"
                        className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">Asset</label>
                      <div className="relative">
                        <select
                          value={linkAsset}
                          onChange={(e) => setLinkAsset(e.target.value)}
                          className="w-full appearance-none px-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-white focus:outline-none cursor-pointer font-bold"
                        >
                          <option value="USDC" className="bg-[#0F0F0F] text-white font-semibold">USDC Stablecoin</option>
                          <option value="XLM" className="bg-[#0F0F0F] text-white font-semibold">XLM Native</option>
                        </select>
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none text-xs">▼</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isGeneratingLink || !linkAmount}
                    className="w-full py-4.5 bg-white text-black hover:bg-white/95 disabled:bg-white/20 disabled:text-black/45 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider font-sans"
                  >
                    {isGeneratingLink ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    <span>Generate Invoice Link</span>
                  </button>
                </form>

                {generatedLink && (
                  <div className="mt-6 bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
                    <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider block">Generated Payment Link</span>
                    <div className="flex items-center gap-2 bg-black/50 border border-white/5 rounded-xl px-3 py-2">
                      <span className="font-mono text-xs text-emerald-400 truncate flex-1 select-all">{generatedLink}</span>
                      <button
                        onClick={handleCopyLink}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
                        title="Copy URL"
                      >
                        {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right panel: Alternative funding sources */}
          <div className="space-y-8">
            {/* Other Payment Sources (Coming Soon) */}
            <div className="bg-black/95 border border-white/10 rounded-3xl p-6 text-white shadow-2xl space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-white/40">Alternative Sources</h3>

              {/* Debit/Credit Card Placeholder */}
              <div className="border border-white/5 bg-white/[0.01] rounded-2xl p-4.5 flex gap-4 items-center relative opacity-50 select-none">
                <div className="w-10 h-10 border border-white/10 bg-white/5 rounded-full flex items-center justify-center shrink-0">
                  <CreditCard size={18} className="text-white/60" />
                </div>
                <div>
                  <h4 className="font-bold text-xs">Credit & Debit Cards</h4>
                  <p className="text-[10px] text-white/40 mt-0.5">Settle balance using Visa, Mastercard, or AMEX.</p>
                </div>
                <span className="absolute top-3 right-3 text-[8px] bg-white/10 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider text-white/60">
                  Soon
                </span>
              </div>

              {/* Bank Transfer Placeholder */}
              <div className="border border-white/5 bg-white/[0.01] rounded-2xl p-4.5 flex gap-4 items-center relative opacity-50 select-none">
                <div className="w-10 h-10 border border-white/10 bg-white/5 rounded-full flex items-center justify-center shrink-0">
                  <Landmark size={18} className="text-white/60" />
                </div>
                <div>
                  <h4 className="font-bold text-xs">Linked Bank Accounts</h4>
                  <p className="text-[10px] text-white/40 mt-0.5">Wire ACH deposits or SEPA transfers directly.</p>
                </div>
                <span className="absolute top-3 right-3 text-[8px] bg-white/10 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider text-white/60">
                  Soon
                </span>
              </div>

              {/* Integration Disclaimer */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4.5 text-[10px] text-white/40 leading-relaxed font-semibold">
                Circle integration APIs will automatically map digital credit balances to secure dollar liquidity vaults in subsequent network releases.
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Address modal */}
      {showAddressModal && publicKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0F0F0F] border border-white/10 w-full max-w-lg rounded-2xl p-6 shadow-2xl text-white">
            <h3 className="text-base font-bold text-white mb-4">Stellar Wallet Public Key</h3>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 font-mono text-[11px] break-all leading-relaxed select-all">
              {publicKey}
            </div>
            <div className="flex justify-end gap-3 pt-6">
              <button
                onClick={handleCopyAddress}
                className="px-4 py-2.5 text-xs font-bold border border-white/10 hover:bg-white/5 rounded-lg text-white/70 hover:text-white cursor-pointer"
              >
                {copiedAddress ? 'Address Copied!' : 'Copy PublicKey'}
              </button>
              <button
                onClick={() => setShowAddressModal(false)}
                className="px-4 py-2.5 bg-white text-black font-bold text-xs rounded-lg hover:bg-white/90 transition-all cursor-pointer"
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
