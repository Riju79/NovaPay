'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  MidnightWalletProviderId,
  MidnightWalletSession,
  WalletDetectionResult,
  MidnightWalletError,
  connectWallet,
  disconnectWallet,
  detectAllWallets,
  STORAGE_SESSION_KEY,
  getRaw1AMProvider,
  extractMidnightAddresses,
  extractMidnightBalances,
} from '../lib/midnight-wallet'

import { API_URL } from '../config'

export interface WalletBalances {
  unshieldedTDust: string
  shieldedTDust: string
  tDust: string
  usdc: string
  isNotFunded: boolean
}

export interface WalletAsset {
  assetId: string
  symbol: string
  name: string
  amount: string
  decimals: number
}

interface MidnightWalletContextType {
  wallet: MidnightWalletSession | null
  isConnected: boolean
  isConnecting: boolean
  isLoadingData: boolean
  error: MidnightWalletError | null
  isModalOpen: boolean
  detection: Record<MidnightWalletProviderId, WalletDetectionResult> | null
  balance: WalletBalances | null
  network: string | null
  walletName: string | null
  walletProvider: string | null
  assets: WalletAsset[]
  transactions: any[]
  lastSyncedAt: number | null
  isLoadingBalance: boolean
  connect: (provider?: MidnightWalletProviderId) => Promise<boolean>
  disconnect: () => Promise<void>
  openModal: () => void
  closeModal: () => void
  clearError: () => void
  refreshDetection: () => Promise<void>
  fetchBalance: () => Promise<void>
  syncWalletState: () => Promise<void>
  refreshWalletData: () => Promise<void>
}

const MidnightWalletContext = createContext<MidnightWalletContextType | undefined>(undefined)

export function MidnightWalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<MidnightWalletSession | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [error, setError] = useState<MidnightWalletError | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [detection, setDetection] = useState<Record<MidnightWalletProviderId, WalletDetectionResult> | null>(null)
  const [balance, setBalance] = useState<WalletBalances | null>(null)
  const [assets, setAssets] = useState<WalletAsset[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)

  const refreshDetection = useCallback(async () => {
    try {
      const results = await detectAllWallets()
      setDetection(results)
    } catch (err) {
      console.warn('[MidnightWallet] Error detecting wallets:', err)
    }
  }, [])

  const syncWalletState = useCallback(async () => {
    if (!wallet?.address) {
      setBalance(null)
      setAssets([])
      setTransactions([])
      setLastSyncedAt(null)
      return
    }

    setIsLoadingData(true)
    setIsLoadingBalance(true)

    try {
      const address = wallet.address

      // 1. Fetch live balance & assets
      let liveTDust = '0.00'
      let liveUsdc = '0.00'
      let liveUnshielded = '0.00'
      let liveShielded = '0.00'
      let isNotFunded = false

      const raw1AM = getRaw1AMProvider()
      if (raw1AM) {
        const liveExtBalance = await extractMidnightBalances(raw1AM, raw1AM)
        if (liveExtBalance) {
          liveUnshielded = liveExtBalance.unshieldedTDust || '0.00'
          liveShielded = liveExtBalance.shieldedTDust || '0.00'
          liveTDust = liveExtBalance.tDust || liveUnshielded || '0.00'
          liveUsdc = liveExtBalance.usdc || '0.00'
        }
      }

      // Query server endpoint ONLY IF extension direct balance is completely zero
      if (liveUnshielded === '0.00' && liveShielded === '0.00' && liveTDust === '0.00' && liveUsdc === '0.00') {
        try {
          const balRes = await fetch(`${API_URL}/api/payment-methods/balances?address=${encodeURIComponent(address)}`)
          if (balRes.ok) {
            const balData = await balRes.json()
            liveTDust = balData.tDust || balData.midnight || '0.00'
            liveUnshielded = balData.unshieldedTDust || liveTDust
            liveShielded = balData.shieldedTDust || '0.00'
            liveUsdc = balData.usdc || '0.00'
            isNotFunded = balData.isNotFunded || false
          }
        } catch (err) {
          console.warn('[MidnightWallet] Server balance fetch warning:', err)
        }
      }

      if (liveUnshielded === '0.00' && liveTDust !== '0.00') {
        liveUnshielded = liveTDust
      }

      setBalance({
        unshieldedTDust: liveUnshielded,
        shieldedTDust: liveShielded,
        tDust: liveTDust,
        usdc: liveUsdc,
        isNotFunded,
      })

      // 2. Build Asset List
      const assetList: WalletAsset[] = [
        {
          assetId: 'native-tdust',
          symbol: 'tDUST',
          name: 'Midnight Native Asset',
          amount: liveTDust,
          decimals: 6,
        },
        {
          assetId: 'stablecoin-usdc',
          symbol: 'USDC',
          name: 'USD Coin Asset',
          amount: liveUsdc,
          decimals: 6,
        },
      ]
      setAssets(assetList)

      // 3. Fetch Transaction Activity Data
      try {
        const txRes = await fetch(`${API_URL}/api/send-money/history?walletAddress=${encodeURIComponent(address)}`)
        if (txRes.ok) {
          const txData = await txRes.json()
          setTransactions(Array.isArray(txData) ? txData : [])
        } else {
          setTransactions([])
        }
      } catch (err) {
        console.warn('[MidnightWallet] Activity fetch warning:', err)
        setTransactions([])
      }

      setLastSyncedAt(Date.now())
    } catch (err: any) {
      console.error('[MidnightWallet] Error synchronizing wallet state:', err)
      setError(
        new MidnightWalletError(
          'SYNC_FAILED',
          'Connected to 1AM wallet, but failed to synchronize full ledger data. Please try refreshing.',
          err
        )
      )
    } finally {
      setIsLoadingData(false)
      setIsLoadingBalance(false)
    }
  }, [wallet?.address])

  const refreshWalletData = useCallback(async () => {
    await syncWalletState()
  }, [syncWalletState])

  const fetchBalance = useCallback(async () => {
    await syncWalletState()
  }, [syncWalletState])

  useEffect(() => {
    if (wallet?.address) {
      syncWalletState()
    }
  }, [wallet?.address, syncWalletState])

  // Initial detection only (do NOT auto-connect on page reload)
  useEffect(() => {
    detectAllWallets().then((results) => {
      setDetection(results)
    }).catch((err) => {
      console.warn('[MidnightWallet] Initial detection error:', err)
    })

    // Clean up any legacy persistent session storage keys so refresh always starts clean
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_SESSION_KEY)
      localStorage.removeItem('novapay_custom_address')
      localStorage.removeItem('novapay_midnight_wallet_session')
    }
  }, [])

  // 1. Live Extension Event & Heartbeat Synchronization (only when explicitly connected)
  useEffect(() => {
    if (!wallet || !wallet.connected) return

    // 1.5s Fast Heartbeat to check active 1AM address & state changes
    const interval = setInterval(async () => {
      try {
        const raw1AM = getRaw1AMProvider()
        if (!raw1AM) return

        const extracted = await extractMidnightAddresses(raw1AM, raw1AM)
        if (
          extracted.address &&
          (extracted.address !== wallet.address || extracted.shieldedAddress !== wallet.shieldedAddress)
        ) {
          console.log('[MidnightWallet] Live account change detected from 1AM extension:', extracted.address)
          setWallet((prev) => {
            if (!prev) return null
            return {
              ...prev,
              address: extracted.address,
              shieldedAddress: extracted.shieldedAddress,
              unshieldedAddress: extracted.unshieldedAddress,
              connectedAt: Date.now(),
            }
          })
        }
      } catch (err) {
        console.warn('[MidnightWallet] Live sync error:', err)
      }
    }, 1500)

    // Extension Native Events
    const raw1AM = getRaw1AMProvider()
    const handleAccountChange = async () => {
      console.log('[MidnightWallet] 1AM Extension accountChanged event received')
      try {
        const session = await connectWallet('1am')
        setWallet(session)
      } catch (err) {
        console.warn('[MidnightWallet] Event sync error:', err)
      }
    }

    if (raw1AM && typeof (raw1AM as any).on === 'function') {
      ;(raw1AM as any).on('accountsChanged', handleAccountChange)
      ;(raw1AM as any).on('accountChanged', handleAccountChange)
      ;(raw1AM as any).on('networkChanged', handleAccountChange)
    }

    return () => {
      clearInterval(interval)
      if (raw1AM && typeof (raw1AM as any).off === 'function') {
        ;(raw1AM as any).off('accountsChanged', handleAccountChange)
        ;(raw1AM as any).off('accountChanged', handleAccountChange)
        ;(raw1AM as any).off('networkChanged', handleAccountChange)
      }
    }
  }, [wallet])

  // 2. Window Focus & Tab Visibility Synchronization (only when explicitly connected)
  useEffect(() => {
    if (!wallet || !wallet.connected) return

    const syncExtensionState = async () => {
      if (typeof window === 'undefined') return
      try {
        const session = await connectWallet('1am')
        setWallet((prev) => {
          if (!prev || prev.address !== session.address || prev.shieldedAddress !== session.shieldedAddress) {
            return session
          }
          return prev
        })
      } catch {
        // Keep current state
      }
    }

    window.addEventListener('focus', syncExtensionState)
    const handleVis = () => {
      if (document.visibilityState === 'visible') {
        syncExtensionState()
      }
    }
    document.addEventListener('visibilitychange', handleVis)

    return () => {
      window.removeEventListener('focus', syncExtensionState)
      document.removeEventListener('visibilitychange', handleVis)
    }
  }, [wallet])

  const openModal = useCallback(() => {
    refreshDetection()
    setError(null)
    setIsModalOpen(true)
  }, [refreshDetection])

  const closeModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const connect = useCallback(async (provider: MidnightWalletProviderId = '1am'): Promise<boolean> => {
    setIsConnecting(true)
    setError(null)

    try {
      const session = await connectWallet(provider)
      setWallet(session)

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_SESSION_KEY, '1am')
      }

      setIsModalOpen(false)
      return true
    } catch (err: unknown) {
      const walletErr =
        err instanceof MidnightWalletError
          ? err
          : new MidnightWalletError('UNKNOWN_ERROR', (err as Error)?.message || String(err), err)
      
      setError(walletErr)
      setWallet(null)
      setIsModalOpen(true)
      return false
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const disconnect = useCallback(async () => {
    setIsConnecting(true)
    try {
      await disconnectWallet(wallet)
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_SESSION_KEY)
        localStorage.removeItem('novapay_custom_address')
        localStorage.removeItem('novapay_midnight_wallet_session')
      }
      setWallet(null)
      setBalance(null)
      setAssets([])
      setTransactions([])
      setLastSyncedAt(null)
      setError(null)
      setIsConnecting(false)
      setIsLoadingData(false)
    }
  }, [wallet])

  return (
    <MidnightWalletContext.Provider
      value={{
        wallet,
        isConnected: Boolean(wallet && wallet.connected && wallet.address),
        isConnecting,
        isLoadingData,
        error,
        isModalOpen,
        detection,
        balance,
        network: wallet?.networkId || process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK || 'preview',
        walletName: '1AM Wallet',
        walletProvider: '1am',
        assets,
        transactions,
        lastSyncedAt,
        isLoadingBalance,
        connect,
        disconnect,
        openModal,
        closeModal,
        clearError,
        refreshDetection,
        fetchBalance,
        syncWalletState,
        refreshWalletData,
      }}
    >
      {children}
    </MidnightWalletContext.Provider>
  )
}

export function useMidnightWallet() {
  const context = useContext(MidnightWalletContext)
  if (!context) {
    throw new Error('useMidnightWallet must be used within a MidnightWalletProvider')
  }
  return context
}
