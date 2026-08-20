'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Wallet, AlertCircle, RefreshCw, ExternalLink, Copy, Check, Shield, Key, Maximize2 } from 'lucide-react'
import { useMidnightWallet } from '../context/MidnightWalletContext'

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
    balance,
    isLoadingBalance,
    fetchBalance,
  } = useMidnightWallet()

  const [copiedField, setCopiedField] = useState<'unshielded' | 'shielded' | 'primary' | null>(null)
  const [showFullAddresses, setShowFullAddresses] = useState(false)

  if (!isModalOpen) return null

  const handleConnect1AM = async () => {
    clearError()
    await connect('1am')
  }

  const handleCopy = (text: string, field: 'unshielded' | 'shielded' | 'primary') => {
    if (text) {
      navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  const is1AMInstalled = detection ? detection['1am']?.isInstalled : false

  const unshieldedAddr = wallet?.unshieldedAddress || (wallet?.address && !wallet.address.startsWith('mn_shielded') ? wallet.address : wallet?.address || '')
  const shieldedAddr = wallet?.shieldedAddress || (wallet?.address && wallet.address.startsWith('mn_shielded') ? wallet.address : '')

  const truncate = (str: string) => {
    if (!str || str.length <= 22) return str
    return `${str.slice(0, 14)}...${str.slice(-10)}`
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 pointer-events-none">
        {/* Subtle Backdrop overlay */}
        <div
          onClick={closeModal}
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-auto"
        />

        {/* Black and White Popup Anchored Directly Under Wallet Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.2 }}
          className="fixed top-16 right-4 sm:right-8 md:right-12 w-[calc(100vw-2rem)] sm:w-[440px] bg-[#0A0A0A] border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl pointer-events-auto z-50 text-white"
        >
          {/* Top Header */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              CONNECTED WALLET SOURCE
            </span>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-[9px] font-mono font-bold tracking-wider uppercase border border-white/15 text-white/70 bg-white/5">
                {(process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK || 'preview').toUpperCase()} LEDGER
              </span>
              <button
                onClick={closeModal}
                className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Connected State View */}
          {isConnected && wallet ? (
            <div className="mt-5 space-y-6">
              {/* Main Wallet Row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                      1AM WALLET
                    </p>
                    <p className="font-mono text-sm font-bold text-white mt-0.5">
                      {truncate(wallet.address)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleCopy(wallet.address, 'primary')}
                    className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-all cursor-pointer"
                    title="Copy Primary Address"
                  >
                    {copiedField === 'primary' ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => setShowFullAddresses(!showFullAddresses)}
                    className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-all cursor-pointer"
                    title="Toggle Full Address View"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Address Breakdown: Unshielded & Shielded */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3">
                {/* UNSHIELDED ADDRESS */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Key className="w-3 h-3 text-white/60" /> Unshielded Address
                    </span>
                    {unshieldedAddr && (
                      <button
                        onClick={() => handleCopy(unshieldedAddr, 'unshielded')}
                        className="text-[10px] text-white/40 hover:text-white flex items-center gap-1 cursor-pointer font-bold"
                      >
                        {copiedField === 'unshielded' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedField === 'unshielded' ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                  <div className="font-mono text-xs text-white/90 bg-black/60 p-2.5 rounded-xl border border-white/5 break-all select-all">
                    {showFullAddresses ? unshieldedAddr : truncate(unshieldedAddr)}
                  </div>
                </div>

                {/* SHIELDED ADDRESS */}
                <div className="space-y-1 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Shield className="w-3 h-3 text-white/60" /> Shielded Address
                    </span>
                    {shieldedAddr && (
                      <button
                        onClick={() => handleCopy(shieldedAddr, 'shielded')}
                        className="text-[10px] text-white/40 hover:text-white flex items-center gap-1 cursor-pointer font-bold"
                      >
                        {copiedField === 'shielded' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedField === 'shielded' ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                  <div className="font-mono text-xs text-white/90 bg-black/60 p-2.5 rounded-xl border border-white/5 break-all select-all">
                    {shieldedAddr ? (showFullAddresses ? shieldedAddr : truncate(shieldedAddr)) : 'Not available'}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-white/10" />

              {/* Live Balance Ledger Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    LIVE BALANCE LEDGER
                  </span>
                  {isLoadingBalance && <RefreshCw className="w-3 h-3 animate-spin text-white/40" />}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Unshielded Native Asset */}
                  <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                    <span className="text-[9px] text-white/40 uppercase font-bold tracking-wider block">
                      UNSHIELDED NATIVE ASSET
                    </span>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="font-mono text-xl font-black text-white">
                        {isLoadingBalance ? '...' : (balance ? (balance.unshieldedTDust || balance.tDust) : '0.00')}
                      </span>
                      <span className="text-[10px] font-bold text-white/40">tDUST</span>
                    </div>
                  </div>

                  {/* Shielded tDUST */}
                  <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                    <span className="text-[9px] text-white/40 uppercase font-bold tracking-wider block">
                      SHIELDED TDUST
                    </span>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="font-mono text-xl font-black text-white">
                        {isLoadingBalance ? '...' : (balance ? (balance.shieldedTDust || '0.00') : '0.00')}
                      </span>
                      <span className="text-[10px] font-bold text-white/40">tDUST</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={fetchBalance}
                  className="px-5 py-2.5 bg-transparent border border-white/20 hover:bg-white/5 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Balances</span>
                </button>
                <button
                  onClick={async () => {
                    await disconnect()
                    closeModal()
                  }}
                  className="px-5 py-2.5 bg-white text-black hover:bg-white/90 font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
                >
                  Disconnect Wallet
                </button>
              </div>
            </div>
          ) : (
            /* Connection View */
            <div className="mt-5 space-y-4">
              {/* Error Banner */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-1 text-xs">
                  <div className="flex items-start gap-2.5 text-red-300">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-mono font-bold text-[9px] uppercase bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30 inline-block mb-1">
                        {error.code}
                      </span>
                      <p className="text-red-200 text-xs font-medium leading-relaxed">
                        {error.userMessage}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 1AM Status Card */}
              <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.03]">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold text-sm text-white border border-white/10 shrink-0">
                      1
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-white">1AM Wallet</h4>
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            is1AMInstalled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-white/10 text-white/40'
                          }`}
                        >
                          {is1AMInstalled ? 'Detected' : 'Extension'}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/40 mt-0.5">Privacy-focused Midnight Native Wallet</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      disabled={isConnecting}
                      onClick={handleConnect1AM}
                      className="px-5 py-2.5 bg-white hover:bg-white/90 active:scale-95 disabled:opacity-50 text-black font-bold text-xs rounded-xl shadow transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {isConnecting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                          <span>Connecting...</span>
                        </>
                      ) : (
                        <span>Connect 1AM</span>
                      )}
                    </button>
                    {!is1AMInstalled && (
                      <a
                        href="https://1am.app/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white rounded-xl transition-all cursor-pointer"
                        title="Get 1AM Wallet"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-2 flex justify-between items-center text-[11px] text-white/40">
                <span>Midnight Target: <b className="text-white/70">{process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK || 'preview'}</b></span>
                <button
                  onClick={refreshDetection}
                  className="hover:text-white flex items-center gap-1 transition-colors cursor-pointer font-bold"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Rescan 1AM</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}


