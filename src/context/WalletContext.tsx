'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { isConnected, requestAccess, getNetwork, getAddress } from '@stellar/freighter-api'
import { Horizon } from '@stellar/stellar-sdk'

// Define the Wallet Context State structure
interface WalletContextType {
  publicKey: string | null
  balance: string | null
  error: string | null
  isFreighterInstalled: boolean
  isConnected: boolean
  isConnecting: boolean
  isWrongNetwork: boolean
  isNotFunded: boolean
  isFunding: boolean
  connect: () => Promise<void>
  disconnect: () => void
  fundWithFriendbot: () => Promise<void>
  refreshBalance: () => Promise<void>
  setConnectedWallet: (address: string | null) => void
  getFreighterAddress: () => Promise<string | null>
}

// Create the context with default empty values
const WalletContext = createContext<WalletContextType | undefined>(undefined)

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isFreighterInstalled, setIsFreighterInstalled] = useState<boolean>(false)
  const [isConnecting, setIsConnecting] = useState<boolean>(false)
  const [isWrongNetwork, setIsWrongNetwork] = useState<boolean>(false)
  const [isNotFunded, setIsNotFunded] = useState<boolean>(false)
  const [isFunding, setIsFunding] = useState<boolean>(false)

  // 1. Detect if Freighter is installed
  const checkFreighterInstalled = useCallback(async (): Promise<boolean> => {
    try {
      // isConnected can return a boolean directly or an object with { isConnected: boolean }
      const conn = await isConnected()
      const installed = typeof conn === 'boolean' ? conn : !!(conn && (conn as any).isConnected)
      setIsFreighterInstalled(installed)
      return installed
    } catch (err) {
      console.error('Error checking Freighter installation:', err)
      setIsFreighterInstalled(false)
      return false
    }
  }, [])

  // 2. Validate the network is Stellar Testnet
  const validateNetwork = useCallback(async (): Promise<boolean> => {
    try {
      const net = await getNetwork()
      // getNetwork returns { network: string; networkPassphrase: string }
      const isTestnet = net && net.network && net.network.toUpperCase() === 'TESTNET'
      setIsWrongNetwork(!isTestnet)
      if (!isTestnet) {
        setError('Freighter network is incorrect. Please switch to Testnet in your Freighter extension settings.')
      } else {
        setError(null)
      }
      return !!isTestnet
    } catch (err) {
      console.error('Error checking Freighter network:', err)
      setIsWrongNetwork(true)
      setError('Could not verify wallet network. Please ensure Freighter is unlocked.')
      return false
    }
  }, [])

  // 3. Fetch XLM balance from Horizon Testnet
  const fetchBalance = useCallback(async (pubKey: string) => {
    setIsNotFunded(false)
    try {
      const server = new Horizon.Server('https://horizon-testnet.stellar.org')
      const account = await server.loadAccount(pubKey)
      const nativeBalance = account.balances.find((b) => b.asset_type === 'native')
      if (nativeBalance) {
        setBalance(Number(nativeBalance.balance).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        }))
      } else {
        setBalance('0.00')
      }
      setIsNotFunded(false)
    } catch (err: any) {
      console.error('Error fetching Stellar account details:', err)
      // If server returns 404, it means the account does not exist (unfunded) on the Testnet ledger yet
      const is404 = err.status === 404 || (err.response && err.response.status === 404)
      if (is404) {
        setIsNotFunded(true)
        setBalance('0.00')
        setError('Your Stellar account is not funded on Testnet yet.')
      } else {
        setBalance(null)
        setError('Could not load account details. Make sure network connections are active.')
      }
    }
  }, [])

  // 4. Connect Wallet workflow
  const connect = useCallback(async () => {
    setIsConnecting(true)
    setError(null)
    setIsWrongNetwork(false)
    setIsNotFunded(false)

    try {
      const installed = await checkFreighterInstalled()
      if (!installed) {
        setError('Freighter extension not found. Please install Freighter to connect.')
        setIsConnecting(false)
        return
      }

      // Request user's public key (will trigger the browser extension popup if not authorized/unlocked)
      const res = await requestAccess()
      if (!res || !res.address) {
        setError(res?.error || 'Connection request denied or timed out.')
        setIsConnecting(false)
        return
      }

      const address = res.address

      // Verify network setting is Testnet
      const isTestnet = await validateNetwork()
      if (!isTestnet) {
        setIsConnecting(false)
        return
      }

      setPublicKey(address)
      localStorage.setItem('novapay_wallet_connected', 'true')
      await fetchBalance(address)
    } catch (err: any) {
      console.error('Error connecting Freighter wallet:', err)
      setError(err?.message || 'Failed to authenticate wallet connection.')
    } finally {
      setIsConnecting(false)
    }
  }, [checkFreighterInstalled, validateNetwork, fetchBalance])

  // 5. Disconnect Wallet workflow
  const disconnect = useCallback(() => {
    setPublicKey(null)
    setBalance(null)
    setError(null)
    setIsWrongNetwork(false)
    setIsNotFunded(false)
    localStorage.removeItem('novapay_wallet_connected')
  }, [])

  // 6. Refresh balance helper
  const refreshBalance = useCallback(async () => {
    if (!publicKey) return
    setError(null)
    const isTestnet = await validateNetwork()
    if (!isTestnet) return
    await fetchBalance(publicKey)
  }, [publicKey, validateNetwork, fetchBalance])

  // 7. Friendbot Funding workflow
  const fundWithFriendbot = useCallback(async () => {
    if (!publicKey) return
    setIsFunding(true)
    setError(null)
    try {
      const response = await fetch(`https://friendbot.stellar.org/?addr=${publicKey}`)
      if (!response.ok) {
        throw new Error('Friendbot API returned an error status.')
      }
      
      // Delay briefly for the ledger transaction to be validated and indexed by Horizon
      await new Promise((resolve) => setTimeout(resolve, 3500))
      await refreshBalance()
    } catch (err: any) {
      console.error('Error funding account with Friendbot:', err)
      setError('Friendbot funding failed. Please try again in a few moments.')
    } finally {
      setIsFunding(false)
    }
  }, [publicKey, refreshBalance])

  // 8. Auto-reconnect on mount if previously authorized
  useEffect(() => {
    const autoConnect = async () => {
      const installed = await checkFreighterInstalled()
      if (!installed) return

      const wasConnected = localStorage.getItem('novapay_wallet_connected') === 'true'
      if (wasConnected) {
        try {
          // getAddress fetches the current authorized address without showing a prompt if authorized
          const res = await getAddress()
          if (res && res.address) {
            const address = res.address
            setPublicKey(address)
            const isTestnet = await validateNetwork()
            if (isTestnet) {
              await fetchBalance(address)
            }
          }
        } catch (err) {
          console.error('Freighter auto-connection error:', err)
        }
      }
    }

    autoConnect()
  }, [checkFreighterInstalled, validateNetwork, fetchBalance])

  const setConnectedWallet = useCallback((address: string | null) => {
    setPublicKey(address)
    if (address) {
      fetchBalance(address)
      localStorage.setItem('novapay_wallet_connected', 'true')
    } else {
      setBalance(null)
    }
  }, [fetchBalance])

  const getFreighterAddress = useCallback(async (): Promise<string | null> => {
    setIsConnecting(true)
    setError(null)
    setIsWrongNetwork(false)

    try {
      const installed = await checkFreighterInstalled()
      if (!installed) {
        setError('Freighter extension not found. Please install Freighter to connect.')
        return null
      }

      const res = await requestAccess()
      if (!res || !res.address) {
        setError(res?.error || 'Connection request denied or timed out.')
        return null
      }

      const address = res.address

      const isTestnet = await validateNetwork()
      if (!isTestnet) {
        return null
      }

      return address
    } catch (err: any) {
      console.error('Error retrieving Freighter address:', err)
      setError(err?.message || 'Failed to retrieve wallet address.')
      return null
    } finally {
      setIsConnecting(false)
    }
  }, [checkFreighterInstalled, validateNetwork])

  return (
    <WalletContext.Provider
      value={{
        publicKey,
        balance,
        error,
        isFreighterInstalled,
        isConnected: !!publicKey,
        isConnecting,
        isWrongNetwork,
        isNotFunded,
        isFunding,
        connect,
        disconnect,
        fundWithFriendbot,
        refreshBalance,
        setConnectedWallet,
        getFreighterAddress,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

// Custom hook to consume the WalletContext safely
export const useWallet = () => {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}
