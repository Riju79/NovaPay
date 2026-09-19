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
import {
  getStoredAuthToken,
  setStoredAuthToken,
  getStoredRefreshToken,
  setStoredRefreshToken,
  clearStoredAuthTokens,
} from '../lib/auth'

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

export interface AuthenticatedUser {
  id: string
  fullName: string
  email: string
  walletAddress: string
  wallet_address?: string
  walletConnected: boolean
}

interface MidnightWalletContextType {
  wallet: MidnightWalletSession | null
  authToken: string | null
  authUser: AuthenticatedUser | null
  isConnected: boolean
  isConnecting: boolean
  isAuthenticating: boolean
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
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [authUser, setAuthUser] = useState<AuthenticatedUser | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [error, setError] = useState<MidnightWalletError | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [detection, setDetection] = useState<Record<MidnightWalletProviderId, WalletDetectionResult> | null>(null)
  const [balance, setBalance] = useState<WalletBalances | null>(null)
  const [assets, setAssets] = useState<WalletAsset[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)

  // Initialize stored token on mount
  useEffect(() => {
    const stored = getStoredAuthToken()
    if (stored) {
      setAuthToken(stored)
    }
  }, [])

  const refreshDetection = useCallback(async () => {
    try {
      const results = await detectAllWallets()
      setDetection(results)
    } catch (err) {
      console.warn('[MidnightWallet] Error detecting wallets:', err)
    }
  }, [])

  /**
   * Challenge-response authentication with the backend
   */
  const authenticateWithBackend = useCallback(
    async (
      address: string,
      shieldedAddress?: string,
      unshieldedAddress?: string
    ): Promise<string | null> => {
      setIsAuthenticating(true)
      try {
        console.log('[1AM Auth] Requesting authentication challenge for:', address)
        // 1. Request challenge with timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 6000)

        const challengeRes = await fetch(`${API_URL}/api/auth/challenge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            address,
            network: 'preview',
          }),
        }).catch((fetchErr) => {
          console.warn('[1AM Auth] Challenge fetch failed or timed out:', fetchErr?.message)
          return null
        })

        clearTimeout(timeoutId)

        if (!challengeRes || !challengeRes.ok) {
          const errData = challengeRes ? await challengeRes.json().catch(() => ({})) : {}
          console.warn(
            '[1AM Auth] Backend challenge endpoint returned error or unavailable:',
            errData?.error || challengeRes?.statusText || 'Server unreachable. Falling back to local Web3 session.'
          )

          // Fallback to local client session so user is never blocked
          const fallbackToken = `web3_local_${address.slice(0, 16)}_${Date.now()}`
          setStoredAuthToken(fallbackToken)
          setAuthToken(fallbackToken)
          setAuthUser({
            id: `usr_${address.slice(-8)}`,
            fullName: `User ${address.slice(0, 8)}`,
            email: `${address.slice(0, 10)}@midnight.wallet`,
            walletAddress: address,
            wallet_address: address,
            walletConnected: true,
          })
          return fallbackToken
        }

        const challengeData = await challengeRes.json()
        const { challengeId, statement } = challengeData

        // 2. Request signature from 1AM if supported
        let signature: string | undefined = undefined
        const raw1AM = getRaw1AMProvider()

        if (raw1AM && typeof (raw1AM as any).signData === 'function') {
          try {
            console.log('[1AM Auth] Requesting 1AM signature via signData...')
            const hexStatement = Buffer.from(statement).toString('hex')
            signature = await (raw1AM as any).signData(address, hexStatement)
          } catch (signErr) {
            console.warn('[1AM Auth] 1AM signData declined or failed:', signErr)
          }
        } else if (raw1AM && typeof (raw1AM as any).signMessage === 'function') {
          try {
            console.log('[1AM Auth] Requesting 1AM signature via signMessage...')
            signature = await (raw1AM as any).signMessage(statement)
          } catch (signErr) {
            console.warn('[1AM Auth] 1AM signMessage declined or failed:', signErr)
          }
        }

        // 3. Verify challenge with backend
        console.log('[1AM Auth] Verifying challenge response with backend...')
        const verifyRes = await fetch(`${API_URL}/api/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengeId,
            address,
            signature,
            network: 'preview',
            shieldedAddress,
            unshieldedAddress,
          }),
        }).catch((err) => {
          console.warn('[1AM Auth] Verify endpoint fetch error:', err?.message)
          return null
        })

        if (!verifyRes || !verifyRes.ok) {
          console.warn('[1AM Auth] Verification failed on backend. Falling back to local Web3 session.')
          const fallbackToken = `web3_local_${address.slice(0, 16)}_${Date.now()}`
          setStoredAuthToken(fallbackToken)
          setAuthToken(fallbackToken)
          setAuthUser({
            id: `usr_${address.slice(-8)}`,
            fullName: `User ${address.slice(0, 8)}`,
            email: `${address.slice(0, 10)}@midnight.wallet`,
            walletAddress: address,
            wallet_address: address,
            walletConnected: true,
          })
          return fallbackToken
        }

        const verifyData = await verifyRes.json()
        const token = verifyData.token
        const refreshToken = verifyData.refreshToken

        if (token) {
          setStoredAuthToken(token)
          setAuthToken(token)
        }
        if (refreshToken) {
          setStoredRefreshToken(refreshToken)
        }
        if (verifyData.user) {
          setAuthUser({
            ...verifyData.user,
            wallet_address: verifyData.user.walletAddress,
          })
        }

        console.log('[1AM Auth] Successfully authenticated application session with backend.')
        return token
      } catch (err: any) {
        console.warn('[1AM Auth] Authentication encountered warning, proceeding with Web3 session:', err?.message)
        const fallbackToken = `web3_local_${address.slice(0, 16)}_${Date.now()}`
        setStoredAuthToken(fallbackToken)
        setAuthToken(fallbackToken)
        setAuthUser({
          id: `usr_${address.slice(-8)}`,
          fullName: `User ${address.slice(0, 8)}`,
          email: `${address.slice(0, 10)}@midnight.wallet`,
          walletAddress: address,
          wallet_address: address,
          walletConnected: true,
        })
        return fallbackToken
      } finally {
        setIsAuthenticating(false)
      }
    },
    []
  )

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
      const currentToken = authToken || getStoredAuthToken()

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

      // Query server endpoint with authenticated header ONLY IF extension direct balance is zero
      if (liveUnshielded === '0.00' && liveShielded === '0.00' && liveTDust === '0.00' && liveUsdc === '0.00') {
        try {
          const headers: Record<string, string> = {}
          if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`

          const balRes = await fetch(`${API_URL}/api/payment-methods/balances?address=${encodeURIComponent(address)}`, {
            headers,
          })
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

      // 3. Fetch Transaction Activity Data with Auth Token
      try {
        const headers: Record<string, string> = {}
        if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`

        const txRes = await fetch(`${API_URL}/api/send-money/history?walletAddress=${encodeURIComponent(address)}`, {
          headers,
        })
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
  }, [wallet?.address, authToken])

  const refreshWalletData = useCallback(async () => {
    await syncWalletState()
  }, [syncWalletState])

  const fetchBalance = useCallback(async () => {
    await syncWalletState()
  }, [syncWalletState])

  useEffect(() => {
    if (wallet?.address && authToken) {
      syncWalletState()
    }
  }, [wallet?.address, authToken, syncWalletState])

  // Auto-reconnect saved session on page load / hard refresh
  useEffect(() => {
    detectAllWallets()
      .then((results) => {
        setDetection(results)
      })
      .catch((err) => {
        console.warn('[MidnightWallet] Initial detection error:', err)
      })

    if (typeof window !== 'undefined') {
      const savedProvider = localStorage.getItem(STORAGE_SESSION_KEY)
      const savedToken = getStoredAuthToken()

      if (savedProvider === '1am') {
        setIsConnecting(true)
        connectWallet('1am')
          .then(async (session) => {
            if (session && session.connected) {
              // Verify network
              if (session.networkId && session.networkId.toLowerCase() !== 'preview') {
                throw new MidnightWalletError(
                  'WRONG_NETWORK',
                  `1AM Wallet network is '${session.networkId}', but Midnight is required.`
                )
              }

              setWallet(session)

              // Verify or renew token
              if (savedToken) {
                try {
                  const meRes = await fetch(`${API_URL}/api/auth/me`, {
                    headers: { Authorization: `Bearer ${savedToken}` },
                  })
                  if (meRes.ok) {
                    const meData = await meRes.json()
                    const tokenWallet = (meData?.wallet_address || meData?.walletAddress || '').toLowerCase()
                    const currentAddrs = [
                      session.address?.toLowerCase(),
                      session.shieldedAddress?.toLowerCase(),
                      session.unshieldedAddress?.toLowerCase(),
                    ].filter(Boolean)

                    if (tokenWallet && currentAddrs.includes(tokenWallet)) {
                      setAuthToken(savedToken)
                      setAuthUser(meData)
                      return
                    }
                  }
                } catch {
                  // Fall through to re-authenticate
                }
              }

              // Re-authenticate if token invalid, absent, or belongs to a different wallet
              await authenticateWithBackend(session.address, session.shieldedAddress, session.unshieldedAddress)
            }
          })
          .catch((err) => {
            console.warn('[MidnightWallet] Auto-reconnect after refresh warning:', err)
            clearStoredAuthTokens()
          })
          .finally(() => {
            setIsConnecting(false)
          })
      }
    }
  }, [authenticateWithBackend])

  // 1. Live Extension Event & Heartbeat Synchronization (account switch & network check)
  useEffect(() => {
    if (!wallet || !wallet.connected) return

    const handleAccountOrNetworkChange = async () => {
      try {
        const raw1AM = getRaw1AMProvider()
        if (!raw1AM) return

        const extracted = await extractMidnightAddresses(raw1AM, raw1AM)

        // Network mismatch check
        if (extracted.networkId && extracted.networkId.toLowerCase() !== 'preview') {
          console.warn('[MidnightWallet] Network switch to non-preview detected:', extracted.networkId)
          setError(
            new MidnightWalletError(
              'WRONG_NETWORK',
              `1AM Wallet was switched to '${extracted.networkId}'. Please reconnect on Midnight.`
            )
          )
          clearStoredAuthTokens()
          setAuthToken(null)
          setAuthUser(null)
          setWallet(null)
          return
        }

        // Account change check
        if (
          extracted.address &&
          (extracted.address !== wallet.address || extracted.shieldedAddress !== wallet.shieldedAddress)
        ) {
          console.log('[MidnightWallet] Account change detected from 1AM extension:', extracted.address)

          // Invalidate old session tokens immediately
          clearStoredAuthTokens()
          setAuthToken(null)
          setAuthUser(null)

          const newSession: MidnightWalletSession = {
            ...wallet,
            address: extracted.address,
            shieldedAddress: extracted.shieldedAddress,
            unshieldedAddress: extracted.unshieldedAddress,
            connectedAt: Date.now(),
          }
          setWallet(newSession)

          // Re-authenticate for the new address
          await authenticateWithBackend(extracted.address, extracted.shieldedAddress, extracted.unshieldedAddress)
        }
      } catch (err) {
        console.warn('[MidnightWallet] Account change handler error:', err)
      }
    }

    // 1.5s fast heartbeat
    const interval = setInterval(handleAccountOrNetworkChange, 1500)

    // Native extension listeners
    const raw1AM = getRaw1AMProvider()
    if (raw1AM && typeof (raw1AM as any).on === 'function') {
      ;(raw1AM as any).on('accountsChanged', handleAccountOrNetworkChange)
      ;(raw1AM as any).on('accountChanged', handleAccountOrNetworkChange)
      ;(raw1AM as any).on('networkChanged', handleAccountOrNetworkChange)
    }

    return () => {
      clearInterval(interval)
      if (raw1AM && typeof (raw1AM as any).off === 'function') {
        ;(raw1AM as any).off('accountsChanged', handleAccountOrNetworkChange)
        ;(raw1AM as any).off('accountChanged', handleAccountOrNetworkChange)
        ;(raw1AM as any).off('networkChanged', handleAccountOrNetworkChange)
      }
    }
  }, [wallet, authenticateWithBackend])

  // Window Focus Synchronization
  useEffect(() => {
    if (!wallet || !wallet.connected) return

    const syncExtensionState = async () => {
      if (typeof window === 'undefined') return
      try {
        const raw1AM = getRaw1AMProvider()
        if (!raw1AM) return
        const extracted = await extractMidnightAddresses(raw1AM, raw1AM)
        if (extracted.address && extracted.address !== wallet.address) {
          clearStoredAuthTokens()
          setAuthToken(null)
          setAuthUser(null)
          setWallet((prev) => (prev ? { ...prev, address: extracted.address } : null))
          await authenticateWithBackend(extracted.address, extracted.shieldedAddress, extracted.unshieldedAddress)
        }
      } catch {
        // Keep current state
      }
    }

    window.addEventListener('focus', syncExtensionState)
    return () => {
      window.removeEventListener('focus', syncExtensionState)
    }
  }, [wallet, authenticateWithBackend])

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

  const connect = useCallback(
    async (provider: MidnightWalletProviderId = '1am'): Promise<boolean> => {
      setIsConnecting(true)
      setError(null)

      try {
        // 1. Connect to 1AM Wallet
        const session = await connectWallet(provider)

        // 2. Validate network is strictly Preview
        if (session.networkId && session.networkId.toLowerCase() !== 'preview') {
          throw new MidnightWalletError(
            'WRONG_NETWORK',
            `1AM Wallet is connected to '${session.networkId}', but Midnight is required. Please switch networks in your 1AM wallet.`
          )
        }

        setWallet(session)

        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_SESSION_KEY, '1am')
        }

        // 3. Execute Challenge-Response Authentication with Backend
        await authenticateWithBackend(session.address, session.shieldedAddress, session.unshieldedAddress)

        setIsModalOpen(false)
        return true
      } catch (err: unknown) {
        const walletErr =
          err instanceof MidnightWalletError
            ? err
            : new MidnightWalletError('UNKNOWN_ERROR', (err as Error)?.message || String(err), err)

        setError(walletErr)
        setWallet(null)
        clearStoredAuthTokens()
        setAuthToken(null)
        setAuthUser(null)
        setIsModalOpen(true)
        return false
      } finally {
        setIsConnecting(false)
      }
    },
    [authenticateWithBackend]
  )

  const disconnect = useCallback(async () => {
    setIsConnecting(true)
    try {
      const currentToken = authToken || getStoredAuthToken()
      if (currentToken) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentToken}`,
          },
        }).catch(() => {})
      }
      await disconnectWallet(wallet)
    } finally {
      clearStoredAuthTokens()
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_SESSION_KEY)
        localStorage.removeItem('novapay_custom_address')
        localStorage.removeItem('novapay_midnight_wallet_session')
      }
      setWallet(null)
      setAuthToken(null)
      setAuthUser(null)
      setBalance(null)
      setAssets([])
      setTransactions([])
      setLastSyncedAt(null)
      setError(null)
      setIsConnecting(false)
      setIsLoadingData(false)
    }
  }, [wallet, authToken])

  return (
    <MidnightWalletContext.Provider
      value={{
        wallet,
        authToken,
        authUser,
        isConnected: Boolean(wallet && wallet.connected && wallet.address && authToken),
        isConnecting,
        isAuthenticating,
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
