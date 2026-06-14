'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useWallet } from '@/context/WalletContext'
import { 
  Wallet, 
  LogOut, 
  Copy, 
  Check, 
  RefreshCw, 
  AlertTriangle, 
  ExternalLink, 
  Coins, 
  Loader2, 
  ChevronDown 
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// Helper to truncate public key for display
const truncateKey = (key: string | null) => {
  if (!key) return ''
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}

export default function ConnectWalletButton() {
  const {
    publicKey,
    balance,
    error,
    isFreighterInstalled,
    isConnected,
    isConnecting,
    isWrongNetwork,
    isNotFunded,
    isFunding,
    connect,
    disconnect,
    fundWithFriendbot,
    refreshBalance,
  } = useWallet()

  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Handle clicking outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Clipboard copy handler
  const handleCopy = () => {
    if (!publicKey) return
    navigator.clipboard.writeText(publicKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Refreshes account details with active spinner feedback
  const handleRefresh = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    await refreshBalance()
    // Ensure the spinner spins for at least 600ms for positive visual feedback
    setTimeout(() => setIsRefreshing(false), 600)
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Action Button */}
      {!isConnected ? (
        <button
          onClick={connect}
          disabled={isConnecting}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 shadow-sm cursor-pointer ${
            isConnecting
              ? 'bg-[#1A1A1A] text-white/50 border border-white/5 cursor-not-allowed'
              : 'bg-white text-black hover:bg-white/90 hover:shadow-md hover:shadow-white/10 active:scale-95'
          }`}
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white/50" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <Wallet className="w-4 h-4" />
              <span>Connect Wallet</span>
            </>
          )}
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-full border border-white/15 bg-white/5 text-white hover:bg-white/10 hover:border-white/30 transition-all duration-200 active:scale-98 cursor-pointer ${
            isWrongNetwork || isNotFunded ? 'border-amber-500/40 bg-amber-500/5' : ''
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${
              isWrongNetwork 
                ? 'bg-rose-500 animate-pulse' 
                : isNotFunded 
                  ? 'bg-amber-500 animate-pulse' 
                  : 'bg-emerald-500'
            }`} />
            <span className="font-mono text-xs">{truncateKey(publicKey)}</span>
          </div>
          {balance !== null && !isNotFunded && !isWrongNetwork && (
            <span className="text-white/40 text-xs border-l border-white/10 pl-2">
              {balance} XLM
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 text-white/60 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {/* Popover / Dropdown Menu */}
      <AnimatePresence>
        {isOpen && isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-3.5 w-80 origin-top-right rounded-2xl border border-white/10 bg-[#0F0F0F] p-5 shadow-2xl shadow-black/80 backdrop-blur-md z-50 text-white"
          >
            {/* Header / Network Badging */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <span className="text-xs font-semibold text-white/50 tracking-wider uppercase">Stellar Account</span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                isWrongNetwork 
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {isWrongNetwork ? 'Wrong Network' : 'Testnet'}
              </span>
            </div>

            {/* Account Details */}
            <div className="space-y-4">
              {/* Address / PublicKey Section */}
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] text-white/40 font-medium">Public Key</span>
                  <span className="font-mono text-sm text-white/80 font-medium">{truncateKey(publicKey)}</span>
                </div>
                <button
                  onClick={handleCopy}
                  className="p-2 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="Copy full public key"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Network Warning Error Display */}
              {isWrongNetwork && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs rounded-xl p-3 flex gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-rose-300">Switch Network Needed</p>
                    <p className="mt-0.5 text-white/60 leading-normal">
                      Freighter is not configured to Testnet. Open the extension settings and switch to the Test network.
                    </p>
                  </div>
                </div>
              )}

              {/* Wallet Info (Balance or Not Funded Banner) */}
              {!isWrongNetwork && (
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                  {isNotFunded ? (
                    <div className="w-full">
                      <div className="mx-auto w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center mb-2.5 border border-amber-500/20">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      </div>
                      <h4 className="text-sm font-semibold text-white/90">Account Unfunded</h4>
                      <p className="text-[11px] text-white/50 mt-1 mb-3.5 leading-normal">
                        This address has not been registered on the Stellar Testnet ledger yet.
                      </p>
                      
                      <button
                        onClick={fundWithFriendbot}
                        disabled={isFunding}
                        className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black font-semibold text-xs rounded-lg shadow-sm transition-all active:scale-98 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isFunding ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Funding...</span>
                          </>
                        ) : (
                          <>
                            <Coins className="w-3.5 h-3.5" />
                            <span>Fund 10,000 XLM</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="w-full flex justify-between items-center">
                      <div className="text-left">
                        <span className="text-[10px] text-white/40 font-medium">Available Balance</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-2xl font-black tracking-tight">{balance}</span>
                          <span className="text-xs text-white/40 font-semibold">XLM</span>
                        </div>
                      </div>

                      <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-2 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        title="Refresh balance"
                      >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Inline standard errors (non-network/non-funding specific) */}
              {error && !isWrongNetwork && !isNotFunded && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl p-3 flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <p className="flex-1 leading-normal">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="py-2 text-xs font-semibold border border-white/10 hover:border-white/20 hover:bg-white/5 rounded-lg text-white/80 hover:text-white transition-all cursor-pointer text-center"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    disconnect()
                    setIsOpen(false)
                  }}
                  className="py-2 text-xs font-semibold bg-rose-950 hover:bg-rose-900 border border-rose-500/20 text-rose-200 rounded-lg hover:text-rose-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Freighter Not Installed Warning Modally Rendered when clicking Connect */}
      <AnimatePresence>
        {isOpen && !isConnected && !isFreighterInstalled && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-3.5 w-80 origin-top-right rounded-2xl border border-white/10 bg-[#0F0F0F] p-5 shadow-2xl shadow-black/80 backdrop-blur-md z-50 text-white"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-[#1A1A1A] border border-white/10 flex items-center justify-center mb-3">
                <Wallet className="w-5 h-5 text-white/80" />
              </div>
              <h3 className="text-sm font-semibold">Freighter Extension Required</h3>
              <p className="text-xs text-white/50 mt-1.5 mb-4.5 leading-normal px-2">
                Freighter wallet is not detected. Install the browser extension to connect your Stellar account.
              </p>
              
              <a
                href="https://www.freighter.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white text-black font-semibold text-xs rounded-xl shadow-sm hover:bg-white/95 transition-all active:scale-98 mb-2 cursor-pointer"
              >
                <span>Get Freighter Wallet</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-2 text-xs font-medium text-white/60 hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
