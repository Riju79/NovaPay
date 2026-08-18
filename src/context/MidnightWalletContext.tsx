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
} from '../lib/midnight-wallet'

interface MidnightWalletContextType {
  wallet: MidnightWalletSession | null
  isConnected: boolean
  isConnecting: boolean
  error: MidnightWalletError | null
  isModalOpen: boolean
  detection: Record<MidnightWalletProviderId, WalletDetectionResult> | null
  connect: (provider: MidnightWalletProviderId) => Promise<boolean>
  disconnect: () => Promise<void>
  openModal: () => void
  closeModal: () => void
  clearError: () => void
  refreshDetection: () => Promise<void>
}

const MidnightWalletContext = createContext<MidnightWalletContextType | undefined>(undefined)

export function MidnightWalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<MidnightWalletSession | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<MidnightWalletError | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [detection, setDetection] = useState<Record<MidnightWalletProviderId, WalletDetectionResult> | null>(null)

  const refreshDetection = useCallback(async () => {
    try {
      const results = await detectAllWallets()
      setDetection(results)
    } catch (err) {
      console.warn('[MidnightWallet] Error detecting wallets:', err)
    }
  }, [])

  // Initial detection and safe session rehydration
  useEffect(() => {
    detectAllWallets().then((results) => {
      setDetection(results)
    }).catch((err) => {
      console.warn('[MidnightWallet] Initial detection error:', err)
    })

    if (typeof window !== 'undefined') {
      const savedProvider = localStorage.getItem(STORAGE_SESSION_KEY) as MidnightWalletProviderId | null
      if (savedProvider && (savedProvider === 'lace' || savedProvider === '1am')) {
        setIsConnecting(true)
        connectWallet(savedProvider)
          .then((session) => {
            setWallet(session)
          })
          .catch(() => {
            localStorage.removeItem(STORAGE_SESSION_KEY)
          })
          .finally(() => {
            setIsConnecting(false)
          })
      }
    }
  }, [])

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

  const connect = useCallback(async (provider: MidnightWalletProviderId): Promise<boolean> => {
    setIsConnecting(true)
    setError(null)

    try {
      const session = await connectWallet(provider)
      setWallet(session)

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_SESSION_KEY, provider)
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
      setWallet(null)
      setError(null)
      setIsConnecting(false)
    }
  }, [wallet])

  return (
    <MidnightWalletContext.Provider
      value={{
        wallet,
        isConnected: Boolean(wallet && wallet.connected && wallet.address),
        isConnecting,
        error,
        isModalOpen,
        detection,
        connect,
        disconnect,
        openModal,
        closeModal,
        clearError,
        refreshDetection,
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
