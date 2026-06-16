'use client'

import React, { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/context/WalletContext'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { API_URL } from '@/config'
import { signTransaction } from '@stellar/freighter-api'
import { Horizon } from '@stellar/stellar-sdk'
import {
  Wallet as WalletIcon,
  Check,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Send,
  ArrowRight,
  Info
} from 'lucide-react'

interface PaymentLinkDetails {
  id: string
  creator_wallet: string
  amount: number
  asset: string
  status: string
  created_at: string
}

export default function PayLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { publicKey, connect, isConnecting, disconnect } = useWallet()

  // State
  const [details, setDetails] = useState<PaymentLinkDetails | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(true)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  const [xlmBalance, setXlmBalance] = useState<string>('0.00')
  const [usdcBalance, setUsdcBalance] = useState<string>('0.00')
  const [isNotFunded, setIsNotFunded] = useState(false)
  const [hasUsdcTrustline, setHasUsdcTrustline] = useState(false)
  const [isLoadingBalances, setIsLoadingBalances] = useState(false)

  // Payment execution state
  const [isPaying, setIsPaying] = useState(false)
  const [payStep, setPayStep] = useState(0) // 1: Preparing, 2: Signing, 3: Submitting, 4: Success
  const [payError, setPayError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  // Fetch payment link details on mount
  useEffect(() => {
    fetchLinkDetails()
  }, [id])

  // Fetch balances when wallet is connected
  useEffect(() => {
    if (publicKey) {
      fetchClientBalances(publicKey)
    } else {
      setXlmBalance('0.00')
      setUsdcBalance('0.00')
      setIsNotFunded(false)
      setHasUsdcTrustline(false)
    }
  }, [publicKey, details])

  const fetchLinkDetails = async () => {
    setIsLoadingDetails(true)
    setDetailsError(null)
    try {
      const res = await fetch(`${API_URL}/api/payment-links/${id}`)
      const data = await res.json()
      if (res.ok) {
        setDetails(data)
      } else {
        setDetailsError(data.error || 'Payment link not found or expired.')
      }
    } catch (err) {
      console.error('Error fetching link details:', err)
      setDetailsError('Failed to load invoice details. Please verify your network connection.')
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const fetchClientBalances = async (address: string) => {
    setIsLoadingBalances(true)
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
        setXlmBalance('0.0000000')
        setUsdcBalance('0.0000000')
        setHasUsdcTrustline(false)
      } else {
        console.error('Error fetching on-chain balances:', err)
      }
    } finally {
      setIsLoadingBalances(false)
    }
  }

  const handlePay = async () => {
    if (!publicKey || !details) return
    setIsPaying(true)
    setPayStep(0)
    setPayError(null)
    setTxHash(null)

    try {
      // Step 1: Prepare transaction from backend
      setPayStep(1)
      const prepRes = await fetch(`${API_URL}/api/payment-links/${id}/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payerAddress: publicKey })
      })
      const prepData = await prepRes.json()
      if (!prepRes.ok) {
        throw new Error(prepData.error || 'Failed to prepare transaction.')
      }

      // Step 2: Sign transaction using Freighter
      setPayStep(2)
      const signResult = await signTransaction(prepData.xdr, {
        networkPassphrase: 'Test SDF Network ; September 2015'
      })
      if (typeof signResult === 'object' && (signResult as any).error) {
        throw new Error((signResult as any).error)
      }
      const signedXdr = typeof signResult === 'string' ? signResult : (signResult as any).signedTxXdr

      // Step 3: Submit transaction to Stellar network via backend
      setPayStep(3)
      const submitRes = await fetch(`${API_URL}/api/payment-links/${id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ xdr: signedXdr })
      })
      const submitData = await submitRes.json()
      if (!submitRes.ok) {
        throw new Error(submitData.error || 'Horizon network submission rejected.')
      }

      // Success!
      setTxHash(submitData.txHash)
      setPayStep(4)
      if (publicKey) {
        fetchClientBalances(publicKey)
      }
    } catch (err: any) {
      console.error('Payment error:', err)
      setPayError(err.message || 'An unexpected transaction error occurred.')
    } finally {
      setIsPaying(false)
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

  // Loading skeleton screen
  if (isLoadingDetails) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-black/50 text-sm gap-2.5">
        <Loader2 className="w-6 h-6 animate-spin text-black" />
        <span>Resolving invoice details...</span>
      </div>
    )
  }

  // Error screen
  if (detailsError || !details) {
    return (
      <div className="flex flex-col min-h-screen bg-white text-black selection:bg-black selection:text-white relative overflow-hidden">
        <Navbar />
        <main className="flex-1 max-w-md mx-auto w-full px-6 pt-40 pb-16 flex flex-col items-center justify-center text-center z-10 relative">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6">
            <AlertTriangle className="text-rose-500 w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold font-sans">Invalid Payment Link</h1>
          <p className="text-sm text-black/50 mt-2 leading-relaxed">
            {detailsError || 'This payment link is inactive, fully settled, or expired.'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-8 px-6 py-2.5 bg-black text-white hover:bg-black/90 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Return Home
          </button>
        </main>
        <Footer />
      </div>
    )
  }

  // Check balance validation
  const currentAsset = details.asset
  const neededAmount = details.amount
  const payerBalance = currentAsset === 'USDC' ? parseFloat(usdcBalance) : parseFloat(xlmBalance)
  const isInsufficient = publicKey ? payerBalance < neededAmount : false
  const isUsdcMissingTrustline = publicKey && currentAsset === 'USDC' && !hasUsdcTrustline

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

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pt-32 pb-16 relative z-10">
        <div className="bg-black/95 border border-white/10 rounded-3xl p-8 text-white shadow-2xl space-y-6">
          <div className="text-center space-y-1.5 pb-4 border-b border-white/10">
            <span className="px-2 py-0.5 rounded text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">
              NovaPay Quick Bill
            </span>
            <p className="text-xs text-white/40 mt-1 font-semibold font-mono">Invoice #{details.id.slice(0, 8).toUpperCase()}</p>
            <h1 className="text-4xl font-mono font-black tracking-tight text-white mt-3">
              {details.amount.toFixed(2)} <span className="text-sm font-bold text-white/50">{details.asset}</span>
            </h1>
          </div>

          {/* Payee Info Box */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4.5 space-y-3.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-white/40 font-semibold">Payee Recipient</span>
              <span className="font-mono text-white/95 font-bold">{details.creator_wallet.slice(0, 10)}...{details.creator_wallet.slice(-8)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/40 font-semibold">Network Asset</span>
              <span className="font-bold text-white/95">{details.asset === 'USDC' ? 'USDC Stablecoin' : 'XLM Native'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/40 font-semibold">Created Date</span>
              <span className="font-semibold text-white/60">
                {new Date(details.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>
          </div>

          {/* Wallet Payer Box */}
          <div className="space-y-4 pt-2">
            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider block pl-1">Payment Method Source</span>

            {publicKey ? (
              <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                      <WalletIcon size={16} className="text-white/70" />
                    </div>
                    <div>
                      <p className="text-[9px] text-white/40 uppercase font-bold tracking-wider">Freighter Account</p>
                      <p className="font-mono text-[11px] text-white/80">{publicKey.slice(0, 10)}...{publicKey.slice(-8)}</p>
                    </div>
                  </div>
                  <button
                    onClick={disconnect}
                    className="text-[10px] font-bold text-white/40 hover:text-rose-400 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>

                <div className="border-t border-white/5 pt-4 flex justify-between items-baseline">
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Available Balance</span>
                  <span className="font-mono text-base font-bold text-white">
                    {isLoadingBalances ? (
                      <Loader2 size={12} className="animate-spin text-white/40 inline" />
                    ) : currentAsset === 'USDC' ? (
                      `${usdcBalance} USDC`
                    ) : (
                      `${xlmBalance} XLM`
                    )}
                  </span>
                </div>

                {isNotFunded && (
                  <div className="bg-amber-500/15 border border-amber-500/20 rounded-xl p-3 flex gap-2 text-amber-400 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="font-semibold leading-relaxed">
                      Your Stellar address is not funded on the Testnet ledger yet. Make a test transaction to instantiate.
                    </p>
                  </div>
                )}

                {isUsdcMissingTrustline && (
                  <div className="bg-rose-500/15 border border-rose-500/20 rounded-xl p-3 flex gap-2 text-rose-400 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="font-semibold leading-relaxed">
                      USDC trustline is not established. Add a USDC trustline in your wallet first.
                    </p>
                  </div>
                )}

                {isInsufficient && !isUsdcMissingTrustline && (
                  <div className="bg-rose-500/15 border border-rose-500/20 rounded-xl p-3 flex gap-2 text-rose-400 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="font-semibold leading-relaxed">
                      Insufficient balance to cover invoice payment of {details.amount} {details.asset}.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="w-full py-4 bg-white text-black hover:bg-white/95 disabled:bg-white/20 font-bold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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

          {/* Action Submission */}
          {publicKey && (
            <button
              onClick={handlePay}
              disabled={isPaying || isInsufficient || isUsdcMissingTrustline || isNotFunded}
              className="w-full py-4.5 bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-white/10 disabled:text-white/30 font-bold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
            >
              {isPaying ? (
                <Loader2 size={14} className="animate-spin text-white" />
              ) : (
                <ShieldCheck size={14} />
              )}
              <span>Authorize Settlement Payment</span>
            </button>
          )}
        </div>
      </main>

      {/* Submission Simulator Overlay */}
      {isPaying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0F0F0F] border border-white/10 w-full max-w-lg rounded-3xl p-6 shadow-2xl text-white relative overflow-hidden">
            <div className="flex flex-col items-center py-8 text-center space-y-6">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-white/5" />
                <Loader2 className="w-10 h-10 animate-spin text-white" />
              </div>

              <div className="space-y-1.5 max-w-xs">
                <h3 className="font-bold text-lg">Processing Payment</h3>
                <p className="text-xs text-white/55 leading-normal">
                  Preparing secure transaction envelope. Please approve Freighter wallet confirmation popup.
                </p>
              </div>

              <div className="w-full max-w-sm bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-left font-mono text-[10px] space-y-2.5 text-white/40">
                <div className="flex items-center gap-2.5">
                  <span className={payStep >= 1 ? 'text-emerald-400' : ''}>{payStep > 1 ? '✔' : '⚙'}</span>
                  <span className={payStep === 1 ? 'text-white font-bold' : payStep > 1 ? 'text-white/80' : ''}>
                    Constructing billing transaction...
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className={payStep >= 2 ? 'text-emerald-400' : ''}>{payStep > 2 ? '✔' : payStep === 2 ? '⚙' : '○'}</span>
                  <span className={payStep === 2 ? 'text-white font-bold' : payStep > 2 ? 'text-white/80' : ''}>
                    Awaiting Freighter wallet signature...
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className={payStep >= 3 ? 'text-emerald-400' : ''}>{payStep > 3 ? '✔' : payStep === 3 ? '⚙' : '○'}</span>
                  <span className={payStep === 3 ? 'text-white font-bold' : payStep > 3 ? 'text-white/80' : ''}>
                    Submitting transaction to Horizon ledger...
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Receipt Modal */}
      {txHash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0F0F0F] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl text-white">
            <div className="flex flex-col items-center space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-lg">
                <Check className="text-emerald-400 w-6 h-6" strokeWidth={3} />
              </div>

              <div>
                <h3 className="font-extrabold text-xl tracking-tight uppercase">Invoice Paid</h3>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-2">
                  Settled on Horizon
                </span>
              </div>

              <div className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 space-y-4 text-xs text-left">
                <div className="flex justify-between">
                  <span className="text-white/40">Amount Settled</span>
                  <span className="font-mono text-white/90 font-bold">{details.amount} {details.asset}</span>
                </div>
                <div className="flex justify-between items-center border-t border-white/5 pt-3">
                  <span className="text-white/40">Transaction Hash</span>
                  <div className="flex items-center gap-2 bg-white/[0.02] border border-white/5 rounded-lg px-2 py-1 max-w-[160px]">
                    <span className="font-mono text-[9px] text-white/75 truncate select-all">{txHash}</span>
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/60 hover:text-white"
                    >
                      <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setTxHash(null)
                  router.push('/')
                }}
                className="w-full py-3 bg-white text-black font-bold text-xs rounded-xl hover:bg-white/95 transition-all cursor-pointer"
              >
                Return Home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error alert modal */}
      {payError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0F0F0F] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl text-white">
            <div className="flex items-center gap-2.5 text-rose-400 mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold">Payment Rejected</h3>
            </div>

            <p className="text-xs text-white/60 leading-relaxed font-semibold bg-white/[0.02] border border-white/5 rounded-xl p-4.5">
              {payError}
            </p>

            <div className="flex justify-end pt-5">
              <button
                type="button"
                onClick={() => setPayError(null)}
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
