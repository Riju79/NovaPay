'use client'

import React, { useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useWallet } from '@/context/WalletContext'
import {
  Wallet as WalletIcon,
  AlertTriangle,
  Loader2,
  ArrowLeft
} from 'lucide-react'
import Logo from '@/components/Logo'

function AuthForm() {
  const router = useRouter()
  const { error, clearError, isAuthenticated, isLoading } = useAuth()
  const {
    publicKey,
    connect,
    isConnecting,
    isWrongNetwork,
    isFreighterInstalled
  } = useWallet()

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
          <h2 className="text-xl font-bold text-white mt-4 tracking-tight">NovaPay Portal</h2>
          <p className="text-xs text-white/40 mt-1.5 max-w-[280px]">
            Access your secure cross-border dashboard instantly on the Stellar network
          </p>
        </div>

        {/* Error Banners */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl p-3 flex gap-2.5 mb-6">
            <AlertTriangle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
            <p className="leading-normal flex-1 font-semibold">{error}</p>
          </div>
        )}

        {/* Connect Wallet Action */}
        <div className="space-y-4">
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
              <WalletIcon className="w-6 h-6 text-white" />
            </div>
            <h4 className="text-sm font-semibold text-white/95">Stellar Wallet Access</h4>
            <p className="text-xs text-white/45 mt-1.5 mb-5.5 leading-normal max-w-[240px]">
              No username or password required. Simply connect your Freighter extension to securely authenticate and access your account.
            </p>
            
            <button
              onClick={connect}
              disabled={isConnecting}
              className="w-full py-3.5 flex items-center justify-center gap-2 bg-white hover:bg-white/90 text-black font-bold text-xs rounded-xl shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <>
                  <WalletIcon size={14} />
                  <span>Connect Freighter Wallet</span>
                </>
              )}
            </button>
          </div>

          {!isFreighterInstalled && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs rounded-xl p-3 flex gap-2">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-amber-300">Freighter Extension Required</p>
                <p className="mt-0.5 text-white/50 leading-normal">
                  Freighter wallet is not detected. Make sure to install and enable the Freighter extension in your browser, then refresh this page.
                </p>
              </div>
            </div>
          )}

          {isWrongNetwork && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl p-3 flex gap-2">
              <AlertTriangle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-rose-300">Wrong Network</p>
                <p className="mt-0.5 text-white/50 leading-normal">
                  Please configure your Freighter extension network settings to Stellar **Testnet**.
                </p>
              </div>
            </div>
          )}
        </div>
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

