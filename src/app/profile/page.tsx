'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useWallet } from '@/context/WalletContext'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { 
  User as UserIcon, 
  Mail, 
  Wallet as WalletIcon, 
  Calendar, 
  Edit3, 
  Key, 
  LogOut, 
  Coins, 
  AlertTriangle, 
  Check, 
  Loader2, 
  Lock
} from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const { 
    user, 
    updateProfile, 
    logout, 
    isAuthenticated, 
    isLoading: isAuthLoading,
    error: authError 
  } = useAuth()

  const { 
    publicKey, 
    balance, 
    isNotFunded, 
    fundWithFriendbot, 
    isFunding,
    disconnect: disconnectWallet
  } = useWallet()

  // Profile forms state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [profilePic, setProfilePic] = useState('')
  const [editSuccess, setEditSuccess] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  // Password change form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [isChangingPw, setIsChangingPw] = useState(false)

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPwModal, setShowPwModal] = useState(false)

  // Sync profile data once user loads
  useEffect(() => {
    if (user) {
      setFullName(user.full_name)
      setEmail(user.email)
      setProfilePic(user.profile_picture || '')
    }
  }, [user])

  // Route protection redirect
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, isAuthLoading, router])

  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-black/50 text-sm gap-2.5">
        <Loader2 className="w-6 h-6 animate-spin text-black" />
        <span>Loading your profile workspace...</span>
      </div>
    )
  }

  // Handle Profile Update Submission
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setUpdateError(null)
    setEditSuccess(false)
    setIsUpdating(true)

    if (!fullName || !email) {
      setUpdateError('Name and email are required fields')
      setIsUpdating(false)
      return
    }

    const success = await updateProfile({ full_name: fullName, email })
    if (success) {
      setEditSuccess(true)
      setTimeout(() => {
        setEditSuccess(false)
        setShowEditModal(false)
      }, 1500)
    } else {
      setUpdateError(authError || 'Profile update failed')
    }
    setIsUpdating(false)
  }

  // Handle Password Change Submission
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(false)
    setIsChangingPw(true)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError('Please fill in all password fields')
      setIsChangingPw(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match')
      setIsChangingPw(false)
      return
    }

    const success = await updateProfile({ password: currentPassword, new_password: newPassword })
    if (success) {
      setPwSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => {
        setPwSuccess(false)
        setShowPwModal(false)
      }, 1500)
    } else {
      setPwError(authError || 'Password change failed')
    }
    setIsChangingPw(false)
  }

  // Truncate address helper
  const truncate = (str: string | null) => str ? `${str.slice(0, 10)}...${str.slice(-10)}` : 'Not connected'

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
    <div className="flex flex-col min-h-screen bg-white text-black selection:bg-black selection:text-white relative overflow-hidden">
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

      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 pt-32 pb-16 relative z-10">
        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          
          {/* Left Panel: Profile Identity Summary */}
          <div className="bg-black/95 border border-white/10 rounded-3xl p-6 flex flex-col items-center text-center shadow-2xl shadow-black/35">
            {/* Avatar Circle */}
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center border border-white/20 shadow-inner mb-4">
              <span className="text-3xl font-black text-white">
                {user.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            
            <h2 className="text-xl font-bold text-white tracking-tight">{user.full_name}</h2>
            <p className="text-sm text-white/45 mt-1 font-medium">{user.email}</p>

            <div className="w-full border-t border-white/10 my-5" />

            {/* Profile Fields Info */}
            <div className="w-full space-y-3.5 text-left text-xs font-semibold text-white/60">
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-white/40" />
                <div className="flex-1">
                  <p className="text-[10px] uppercase text-white/40 font-bold tracking-wider">Member Since</p>
                  <p className="text-white/80 mt-0.5">{new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Mail size={16} className="text-white/40" />
                <div className="flex-1">
                  <p className="text-[10px] uppercase text-white/40 font-bold tracking-wider">Email Verified</p>
                  <p className="text-emerald-400 mt-0.5">{user.email_verified ? 'Yes' : 'Verified via Wallet Connection'}</p>
                </div>
              </div>
            </div>

            <div className="w-full border-t border-white/10 my-5" />

            {/* Profile Action List */}
            <div className="w-full space-y-2.5">
              <button
                onClick={() => setShowEditModal(true)}
                className="w-full py-3 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl border border-white/5 hover:border-white/10 transition-all cursor-pointer"
              >
                <Edit3 size={14} />
                Edit Profile Info
              </button>

              <button
                onClick={() => setShowPwModal(true)}
                className="w-full py-3 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl border border-white/5 hover:border-white/10 transition-all cursor-pointer"
              >
                <Key size={14} />
                Change Password
              </button>

              <button
                onClick={logout}
                className="w-full py-3 flex items-center justify-center gap-2 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 font-bold text-xs rounded-xl border border-rose-500/10 hover:border-rose-500/20 transition-all cursor-pointer"
              >
                <LogOut size={14} />
                Log Out Session
              </button>
            </div>
          </div>

          {/* Right Panel: Stellar Wallet details & status */}
          <div className="md:col-span-2 space-y-6">
            {/* Wallet Integration Details */}
            <div className="bg-black/95 border border-white/10 rounded-3xl p-6 shadow-2xl shadow-black/35">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <WalletIcon className="text-white/60" />
                  <h3 className="font-bold text-lg text-white">Freighter Wallet Node</h3>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  Stellar Testnet
                </span>
              </div>

              <div className="space-y-4">
                {/* Linked Address */}
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block">Linked Public Key Address</span>
                  <span className="font-mono text-sm text-white/90 font-medium block mt-1 break-all select-all">
                    {user.wallet_address}
                  </span>
                </div>

                {/* Live Balance / Funding Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col justify-center">
                    <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Account Balance</span>
                    {isNotFunded ? (
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xl font-bold text-amber-500">Unfunded</span>
                        <span className="text-[10px] text-white/30">on Testnet</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1.5 mt-1.5">
                        <span className="text-2xl font-black text-white">{balance || '0.00'}</span>
                        <span className="text-xs text-white/40 font-bold">XLM</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col justify-center">
                    <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Session Status</span>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-sm font-semibold text-white/90">Authorized & Connected</span>
                    </div>
                  </div>
                </div>

                {/* Friendbot Integration */}
                {isNotFunded && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex gap-2.5">
                      <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                      <div className="text-xs leading-normal font-medium text-amber-200">
                        <p className="font-bold">Testnet Account Activation Required</p>
                        <p className="text-white/55 mt-0.5">This wallet address does not exist on the Stellar Testnet ledger. Fund it with 10,000 test XLM to register it.</p>
                      </div>
                    </div>
                    <button
                      onClick={fundWithFriendbot}
                      disabled={isFunding}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black font-semibold text-xs rounded-xl shadow-sm transition-all shrink-0 active:scale-98 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {isFunding ? (
                        <>
                          <Loader2 size={14} className="animate-spin text-black" />
                          <span>Funding...</span>
                        </>
                      ) : (
                        <>
                          <Coins size={14} />
                          <span>Fund Account</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      disconnectWallet()
                      logout()
                    }}
                    className="px-5 py-2.5 border border-rose-500/20 hover:border-rose-500/30 bg-rose-950/10 hover:bg-rose-950/20 text-rose-300 font-bold text-xs rounded-xl transition-all cursor-pointer active:scale-98"
                  >
                    Disconnect Wallet & Logout
                  </button>
                </div>

              </div>
            </div>

            {/* Platform Settings details card */}
            <div className="bg-black/95 border border-white/10 rounded-3xl p-6 shadow-2xl shadow-black/35">
              <h3 className="font-bold text-lg text-white mb-2">NovaPay Account Privileges</h3>
              <p className="text-xs text-white/50 leading-relaxed font-medium">
                Your NovaPay profile is authenticated and connected directly to the Stellar blockchain. You can now use the platform to receive global fund requests, make instant cross-border payments with near-zero exchange costs, and audit your transaction history directly on the Stellar test ledger.
              </p>
            </div>

          </div>

        </div>
      </main>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0F0F0F] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Edit Profile Info</h3>
            
            {updateError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl p-3 flex gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="leading-normal flex-1 font-medium">{updateError}</p>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-medium"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setUpdateError(null)
                    setShowEditModal(false)
                  }}
                  className="px-4 py-2 text-xs font-bold border border-white/10 hover:bg-white/5 rounded-lg text-white/70 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 bg-white text-black font-bold text-xs rounded-lg hover:bg-white/90 transition-all cursor-pointer flex items-center gap-1"
                >
                  {isUpdating ? (
                    <Loader2 size={12} className="animate-spin text-black" />
                  ) : editSuccess ? (
                    <Check size={12} className="text-emerald-600" />
                  ) : null}
                  <span>Save Profile</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0F0F0F] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Change Password</h3>
            
            {pwError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl p-3 flex gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="leading-normal flex-1 font-medium">{pwError}</p>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider pl-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-medium"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setPwError(null)
                    setShowPwModal(false)
                  }}
                  className="px-4 py-2 text-xs font-bold border border-white/10 hover:bg-white/5 rounded-lg text-white/70 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPw}
                  className="px-5 py-2 bg-white text-black font-bold text-xs rounded-lg hover:bg-white/90 transition-all cursor-pointer flex items-center gap-1"
                >
                  {isChangingPw ? (
                    <Loader2 size={12} className="animate-spin text-black" />
                  ) : pwSuccess ? (
                    <Check size={12} className="text-emerald-600" />
                  ) : null}
                  <span>Change Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
