'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useWallet } from '@/context/WalletContext'
import { motion } from 'framer-motion'
import {
  Mail,
  Lock,
  User as UserIcon,
  Wallet as WalletIcon,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowLeft
} from 'lucide-react'
import Logo from '@/components/Logo'

function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, signup, error, clearError, isAuthenticated, isLoading } = useAuth()
  const {
    publicKey,
    connect,
    isConnecting,
    isWrongNetwork,
    isFreighterInstalled,
    getFreighterAddress
  } = useWallet()

  // Tabs: 'signin' or 'signup'
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin')

  // Signin fields
  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')

  // Signup fields
  const [signUpName, setSignUpName] = useState('')
  const [signUpEmail, setSignUpEmail] = useState('')
  const [signUpPassword, setSignUpPassword] = useState('')
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('')
  const [signupWalletAddress, setSignupWalletAddress] = useState<string | null>(null)

  // Validation messages
  const [localError, setLocalError] = useState<string | null>(null)

  // Sync state from query params (e.g. Option 1 redirect)
  useEffect(() => {
    clearError()
    setLocalError(null)
    const mode = searchParams.get('mode')
    if (mode === 'signup') {
      setActiveTab('signup')
    }
  }, [searchParams, clearError])

  // Sync signupWalletAddress if publicKey is already set globally (e.g. from homepage redirect)
  useEffect(() => {
    if (publicKey) {
      setSignupWalletAddress(publicKey)
    }
  }, [publicKey])

  const handleConnectSignupWallet = async () => {
    const address = await getFreighterAddress()
    if (address) {
      setSignupWalletAddress(address)
    }
  }

  // Handle traditional login
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    clearError()

    if (!signInEmail || !signInPassword) {
      setLocalError('Please fill in all fields')
      return
    }

    const success = await login(signInEmail, signInPassword)
    if (success) {
      router.push('/')
    }
  }

  // Handle traditional signup
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    clearError()

    // 1. Validate inputs
    if (!signUpName || !signUpEmail || !signUpPassword || !signUpConfirmPassword) {
      setLocalError('All registration fields are required')
      return
    }

    if (signUpPassword !== signUpConfirmPassword) {
      setLocalError('Passwords do not match')
      return
    }

    // 2. Validate Freighter connection is active
    if (!signupWalletAddress) {
      setLocalError('Freighter wallet connection is required to complete registration')
      return
    }

    if (isWrongNetwork) {
      setLocalError('Please configure your Freighter extension to Testnet')
      return
    }

    const success = await signup(signUpName, signUpEmail, signUpPassword, signupWalletAddress)
    if (success) {
      router.push('/')
    }
  }

  // Auto redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, router])

  return (
    <div className="w-full max-w-md">
      {/* Back to Home link */}
      <button
        onClick={() => router.push('/')}
        className="mb-8 flex items-center gap-1.5 text-sm font-semibold text-black/50 hover:text-black transition-colors cursor-pointer"
      >
        <ArrowLeft size={16} />
        Back to Home
      </button>

      {/* Auth Card Container */}
      <div className="bg-black/95 border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/30">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <Logo inverted={true} />
          <h2 className="text-xl font-bold text-white mt-4 tracking-tight">NovaPay Student Portal</h2>
          <p className="text-xs text-white/40 mt-1.5 max-w-[280px]">
            Make tuition payments globally with near-zero transfer fees
          </p>
        </div>

        {/* Tab Headers */}
        <div className="grid grid-cols-2 bg-white/[0.03] border border-white/5 p-1 rounded-xl mb-6">
          <button
            onClick={() => {
              setActiveTab('signin')
              setLocalError(null)
              clearError()
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeTab === 'signin'
              ? 'bg-white text-black font-bold shadow-md shadow-black/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
              }`}
          >
            Log In
          </button>
          <button
            onClick={() => {
              setActiveTab('signup')
              setLocalError(null)
              clearError()
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeTab === 'signup'
              ? 'bg-white text-black font-bold shadow-md shadow-black/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
              }`}
          >
            Sign Up
          </button>
        </div>

        {/* Error Banners */}
        {(localError || error) && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl p-3 flex gap-2.5 mb-6">
            <AlertTriangle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
            <p className="leading-normal flex-1 font-semibold">{localError || error}</p>
          </div>
        )}

        {/* Sign In View */}
        {activeTab === 'signin' && (
          <form onSubmit={handleSignInSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-white/30 pointer-events-none">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  placeholder="name@university.edu"
                  className="w-full pl-10 pr-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-white/30 pointer-events-none">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 py-3.5 flex items-center justify-center gap-1.5 bg-white hover:bg-white/90 text-black font-bold text-xs rounded-xl shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>

            <p className="text-xs text-white/40 text-center mt-4.5 font-medium">
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signup')
                  setLocalError(null)
                  clearError()
                }}
                className="text-white hover:underline font-bold cursor-pointer"
              >
                Sign Up
              </button>
            </p>
          </form>
        )}

        {/* Sign Up / Registration View */}
        {activeTab === 'signup' && (
          <form onSubmit={handleSignUpSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">Full Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-white/30 pointer-events-none">
                  <UserIcon size={16} />
                </span>
                <input
                  type="text"
                  value={signUpName}
                  onChange={(e) => setSignUpName(e.target.value)}
                  placeholder="Alex Mercer"
                  className="w-full pl-10 pr-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-white/30 pointer-events-none">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  placeholder="alex@university.edu"
                  className="w-full pl-10 pr-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-white/30 pointer-events-none">
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">Confirm</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-white/30 pointer-events-none">
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    value={signUpConfirmPassword}
                    onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Connected Wallet address requirements (Enforced) */}
            <div className="space-y-1.5 pt-2 border-t border-white/5">
              <div className="flex justify-between items-center pl-1">
                <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Linked Stellar Wallet</label>
                <span className="text-[9px] text-amber-600 font-semibold uppercase tracking-wider">Required</span>
              </div>

              {signupWalletAddress ? (
                <div className="flex items-center justify-between gap-3 px-3.5 py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="font-mono text-xs text-emerald-400 font-medium select-all">
                      {`${signupWalletAddress.slice(0, 8)}...${signupWalletAddress.slice(-8)}`}
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Linked
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectSignupWallet}
                  disabled={isConnecting}
                  className="w-full py-3 border border-dashed border-white/15 bg-white/[0.01] hover:bg-white/[0.03] text-white hover:border-white/30 flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {isConnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white/60" />
                  ) : (
                    <>
                      <WalletIcon size={16} className="text-white/60" />
                      <span className="text-xs font-semibold">Connect Freighter Wallet</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !signupWalletAddress}
              className="w-full mt-6 py-3.5 flex items-center justify-center gap-1.5 bg-white hover:bg-white/90 text-black font-bold text-xs rounded-xl shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>

            <p className="text-xs text-white/40 text-center mt-4.5 font-medium">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signin')
                  setLocalError(null)
                  clearError()
                }}
                className="text-white hover:underline font-bold cursor-pointer"
              >
                Sign In
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
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
    ];

    let linesHtml = '';

    for (let i = 1; i <= 4; i++) {
      const coord = i * 96;
      linesHtml += `<line x1="${coord}" y1="0" x2="${coord}" y2="384" stroke="black" stroke-opacity="0.18" stroke-width="1" />`;
      linesHtml += `<line x1="0" y1="${coord}" x2="384" y2="${coord}" stroke="black" stroke-opacity="0.18" stroke-width="1" />`;
    }

    activeCells.forEach(cell => {
      const startX = cell.col * 96;
      const startY = cell.row * 96;
      
      const lineCount = 11;
      const paddingX = 14;
      const startYOffset = 16;
      const gap = 6;
      
      linesHtml += `<g stroke="black" stroke-opacity="0.22" stroke-width="1.8" stroke-linecap="round">`;
      
      for (let l = 0; l < lineCount; l++) {
        const y = startY + startYOffset + (l * gap);
        const isIndented = (cell.seed + l) % 3 === 0 && l > 1 && l < lineCount - 2;
        const indent = isIndented ? 12 : 0;
        
        const left = startX + paddingX + indent;
        const lengthFactor = Math.abs(Math.sin(cell.seed * 1.5 + l * 2.3));
        const maxLength = 96 - (paddingX * 2) - indent;
        const lineLength = 15 + lengthFactor * (maxLength - 15);
        
        const right = left + lineLength;
        linesHtml += `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" />`;
      }
      
      linesHtml += `</g>`;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="384" height="384" viewBox="0 0 384 384">
      ${linesHtml}
    </svg>`;
  };

  const svgString = generateGridSvg();
  const gridBackground = `url("data:image/svg+xml,${encodeURIComponent(svgString)}")`;

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center relative p-6 overflow-hidden selection:bg-black selection:text-white">
      {/* Hero Radial Glow */}
      <div 
        className="absolute top-0 left-0 w-full h-[550px] pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.45), transparent)',
          filter: 'blur(60px)',
          zIndex: 0,
        }}
      />

      {/* Grid of structured boxes fading down */}
      <div 
        className="absolute top-0 left-0 w-full h-[550px] pointer-events-none"
        style={{
          backgroundImage: gridBackground,
          backgroundSize: '384px 384px',
          maskImage: 'linear-gradient(to bottom, black 30%, transparent 85%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 30%, transparent 85%)',
          zIndex: 0,
        }}
      />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center text-black/50 text-sm gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-black" />
            <span>Loading...</span>
          </div>
        }>
          <AuthForm />
        </Suspense>
      </div>
    </main>
  )
}
