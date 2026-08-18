'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Wallet, AlertCircle, CheckCircle2, RefreshCw, ExternalLink, Copy, Check } from 'lucide-react'
import { useMidnightWallet } from '../context/MidnightWalletContext'
import { MidnightWalletProviderId } from '../lib/midnight-wallet'

export default function MidnightWalletModal() {
  const {
    isModalOpen,
    closeModal,
    connect,
    isConnecting,
    error,
    clearError,
    detection,
    refreshDetection,
    wallet,
    isConnected,
    disconnect,
  } = useMidnightWallet()

  const [copied, setCopied] = useState(false)
  const [activeProvider, setActiveProvider] = useState<MidnightWalletProviderId | null>(null)

  if (!isModalOpen) return null

  const handleSelectProvider = async (providerId: MidnightWalletProviderId) => {
    clearError()
    setActiveProvider(providerId)
    await connect(providerId)
    setActiveProvider(null)
  }

  const handleCopyAddress = () => {
    if (wallet?.address) {
      navigator.clipboard.writeText(wallet.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const providers: Array<{
    id: MidnightWalletProviderId
    name: string
    description: string
    installUrl: string
  }> = [
    {
      id: 'lace',
      name: 'Lace Wallet',
      description: 'Official Midnight Web3 Wallet Extension by Input Output',
      installUrl: 'https://www.lace.io/',
    },
    {
      id: '1am',
      name: '1AM Wallet',
      description: 'Privacy-focused Midnight Native Wallet Extension',
      installUrl: 'https://1am.app/',
    },
  ]

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeModal}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md bg-[#0D0D0D] border border-white/10 rounded-2xl p-6 shadow-2xl z-10 text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/5 rounded-xl border border-white/10">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Midnight Wallet</h3>
                <p className="text-xs text-white/50">Connect Lace or 1AM extension</p>
              </div>
            </div>
            <button
              onClick={closeModal}
              className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Connected State View */}
          {isConnected && wallet ? (
            <div className="py-6 space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Active Midnight Session
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-300/80 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    {wallet.provider}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider block">
                    Wallet Address
                  </span>
                  <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-lg border border-white/5 font-mono text-xs text-white/90 gap-2">
                    <span className="break-all select-all">{wallet.address}</span>
                    <button
                      onClick={handleCopyAddress}
                      className="p-1.5 hover:bg-white/10 rounded text-white/60 hover:text-white transition-all shrink-0 cursor-pointer"
                      title="Copy address"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                {wallet.shieldedAddress && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider block">
                      Shielded Address
                    </span>
                    <div className="bg-black/30 p-2 rounded border border-white/5 font-mono text-[11px] text-white/70 break-all select-all">
                      {wallet.shieldedAddress}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={async () => {
                  await disconnect()
                  closeModal()
                }}
                className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Disconnect Wallet
              </button>
            </div>
          ) : (
            /* Selection & Connect View */
            <div className="py-5 space-y-4">
              {/* Error Banner */}
              {error && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2 text-xs">
                  <div className="flex items-start gap-2.5 text-red-300">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-mono font-bold text-[10px] uppercase bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30 inline-block mb-1">
                        {error.code}
                      </span>
                      <p className="text-red-200 text-xs font-medium leading-relaxed">
                        {error.userMessage}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Providers List */}
              <div className="space-y-3">
                {providers.map((p) => {
                  const isDetected = detection ? detection[p.id]?.isInstalled : false
                  const isThisConnecting = isConnecting && activeProvider === p.id

                  return (
                    <div
                      key={p.id}
                      className="p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center font-bold text-sm text-white border border-white/10 shrink-0">
                            {p.name.substring(0, 1)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-white">{p.name}</h4>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                  isDetected
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-white/10 text-white/40'
                                }`}
                              >
                                {isDetected ? 'Detected' : 'Extension'}
                              </span>
                            </div>
                            <p className="text-[11px] text-white/40 mt-0.5">{p.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            disabled={isConnecting}
                            onClick={() => handleSelectProvider(p.id)}
                            className="px-4 py-2 bg-white hover:bg-white/90 active:scale-95 disabled:opacity-50 text-black font-bold text-xs rounded-xl shadow transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            {isThisConnecting ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                                <span>Connecting...</span>
                              </>
                            ) : (
                              <span>Connect</span>
                            )}
                          </button>
                          {!isDetected && (
                            <a
                              href={p.installUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white rounded-lg transition-all cursor-pointer"
                              title={`Get ${p.name}`}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Footer status */}
              <div className="pt-2 flex justify-between items-center text-[11px] text-white/40">
                <span>Midnight Target: <b className="text-white/70">{process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK || 'preview'}</b></span>
                <button
                  onClick={refreshDetection}
                  className="hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Rescan extensions</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
