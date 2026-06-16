'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/context/WalletContext'
import { API_URL } from '@/config'

interface User {
  id: string
  full_name: string
  email: string
  wallet_address: string
  wallet_connected: boolean
  email_verified: boolean
  profile_picture: string | null
  created_at: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  clearError: () => void
  login: (email: string, password: string) => Promise<boolean>
  signup: (full_name: string, email: string, password: string, wallet_address: string) => Promise<boolean>
  logout: () => Promise<void>
  updateProfile: (data: { full_name?: string; email?: string; password?: string; new_password?: string }) => Promise<boolean>
  syncWalletConnection: (wallet_address: string) => Promise<{ exists: boolean; wallet_address: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)



export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { publicKey, disconnect: disconnectWallet, setConnectedWallet } = useWallet()

  const clearError = useCallback(() => setError(null), [])

  // Helper to fetch authenticated routes using the current memory token
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    let currentToken = token
    
    // Check if token needs refresh / is missing but we think we're logged in
    if (!currentToken && localStorage.getItem('novapay_logged_in') === 'true') {
      const refreshed = await refreshToken()
      if (refreshed) {
        currentToken = refreshed
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
    }

    return fetch(`${API_URL}${url}`, {
      ...options,
      headers,
      credentials: 'include',
    })
  }, [token])

  // 1. Silent token refresh logic
  const refreshToken = async (): Promise<string | null> => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Refresh session expired')
      }

      const data = await response.json()
      setToken(data.accessToken)
      setUser(data.user)
      localStorage.setItem('novapay_logged_in', 'true')
      return data.accessToken
    } catch (err) {
      console.warn('Silent refresh failed. User must log in.', err)
      setUser(null)
      setToken(null)
      localStorage.removeItem('novapay_logged_in')
      return null
    }
  }

  // 2. Traditional login
  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      setToken(data.accessToken)
      setUser(data.user)
      localStorage.setItem('novapay_logged_in', 'true')
      
      // Also cache wallet status locally to sync contexts
      if (data.user.wallet_address) {
        localStorage.setItem('novapay_wallet_connected', 'true')
      }
      
      router.push('/')
      return true
    } catch (err: any) {
      setError(err.message || 'Server error occurred during login')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  // 3. Register a new user (Freight wallet must be connected)
  const signup = async (full_name: string, email: string, password: string, wallet_address: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name, email, password, wallet_address }),
        credentials: 'include',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Signup failed')
      }

      setToken(data.accessToken)
      setUser(data.user)
      localStorage.setItem('novapay_logged_in', 'true')
      localStorage.setItem('novapay_wallet_connected', 'true')
      
      router.push('/')
      return true
    } catch (err: any) {
      setError(err.message || 'Server error occurred during signup')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  // 4. End user session
  const logout = async () => {
    setIsLoading(true)
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (err) {
      console.error('Logout request failed:', err)
    } finally {
      // Disconnect wallet to prevent auto-login trigger on home redirect
      disconnectWallet()
      
      setUser(null)
      setToken(null)
      localStorage.removeItem('novapay_logged_in')
      localStorage.removeItem('novapay_wallet_connected')
      setIsLoading(false)
      router.push('/')
    }
  }

  // 5. Update authenticated user profile
  const updateProfile = async (data: { full_name?: string; email?: string; password?: string; new_password?: string }): Promise<boolean> => {
    setError(null)
    try {
      const response = await authFetch('/profile/update', {
        method: 'PUT',
        body: JSON.stringify(data),
      })

      const resData = await response.json()
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to update profile')
      }

      setUser(resData)
      return true
    } catch (err: any) {
      setError(err.message || 'Server error occurred during update')
      return false
    }
  }

  // 6. Connect Wallet and Sync / Auto Login (Option 1)
  const syncWalletConnection = async (wallet_address: string): Promise<{ exists: boolean; wallet_address: string }> => {
    setError(null)
    try {
      const response = await fetch(`${API_URL}/wallet/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address }),
        credentials: 'include',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Wallet connection check failed')
      }

      if (data.exists) {
        // Log in user automatically since the wallet already has an account
        setToken(data.accessToken)
        setUser(data.user)
        localStorage.setItem('novapay_logged_in', 'true')
        localStorage.setItem('novapay_wallet_connected', 'true')
        router.push('/')
      }

      return { exists: !!data.exists, wallet_address }
    } catch (err: any) {
      setError(err.message || 'Server error verifying wallet connection')
      return { exists: false, wallet_address }
    }
  }

  // Restore session on application mount
  useEffect(() => {
    const initAuth = async () => {
      const isLoggedIn = localStorage.getItem('novapay_logged_in') === 'true'
      if (isLoggedIn) {
        await refreshToken()
      }
      setIsLoading(false)
    }
    initAuth()
  }, [])

  // Auto-refresh token every 10 minutes (expires in 15)
  useEffect(() => {
    const isLoggedIn = localStorage.getItem('novapay_logged_in') === 'true'
    if (!isLoggedIn) return

    const interval = setInterval(() => {
      refreshToken()
    }, 10 * 60 * 1000)

    return () => clearInterval(interval)
  }, [token])

  // Option 1: Auto-authenticate or redirect on wallet connection

  useEffect(() => {
    const checkWalletAutoAuth = async () => {
      // Only trigger if wallet connected, user is not logged in, and wallet is marked connected in local storage
      const isWalletConnected = localStorage.getItem('novapay_wallet_connected') === 'true'
      if (publicKey && !user && !isLoading && isWalletConnected) {
        const res = await syncWalletConnection(publicKey)
        if (!res.exists) {
          router.push('/login?mode=signup')
        }
      }
    }
    checkWalletAutoAuth()
  }, [publicKey, user, isLoading])

  // Automatically connect the user's wallet if they logged in and it's linked
  useEffect(() => {
    const isWalletConnected = localStorage.getItem('novapay_wallet_connected') === 'true'
    if (isWalletConnected && user && user.wallet_address && publicKey !== user.wallet_address) {
      setConnectedWallet(user.wallet_address)
    }
  }, [user, publicKey, setConnectedWallet])

  // Synchronize client-side wallet disconnection to the backend
  useEffect(() => {
    const syncDisconnect = async () => {
      const isWalletConnected = localStorage.getItem('novapay_wallet_connected') === 'true'
      if (!publicKey && user && user.wallet_connected && !isWalletConnected) {
        try {
          await authFetch('/wallet/disconnect', { method: 'POST' })
          setUser(prev => prev ? { ...prev, wallet_connected: false } : null)
        } catch (err) {
          console.error('Failed to sync wallet disconnect to backend:', err)
        }
      }
    }
    syncDisconnect()
  }, [publicKey, user, authFetch])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        error,
        clearError,
        login,
        signup,
        logout,
        updateProfile,
        syncWalletConnection,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
