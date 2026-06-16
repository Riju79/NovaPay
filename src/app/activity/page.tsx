'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useWallet } from '@/context/WalletContext'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { API_URL } from '@/config'
import {
  Clock,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Bell,
  AlertCircle,
  CheckCircle,
  Info,
  Loader2,
  X,
  RefreshCw,
  Eye
} from 'lucide-react'

interface DBTransaction {
  id: string
  sender_wallet: string
  recipient_wallet: string
  amount: number
  asset_type: string
  purpose: string
  tx_hash: string | null
  status: string
  created_at: string
}

interface Notification {
  id: string
  wallet_address: string
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
}

export default function ActivityPage() {
  const router = useRouter()
  const { user, token, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const { publicKey } = useWallet()

  // State
  const [transactions, setTransactions] = useState<DBTransaction[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters and UI states
  const [activeTab, setActiveTab] = useState<'all' | 'transactions' | 'notifications'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'sent' | 'received' | 'notifications'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'SUCCESS' | 'FAILED' | 'READ' | 'UNREAD'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest')

  // Selected item modal
  const [selectedTx, setSelectedTx] = useState<DBTransaction | null>(null)
  const [copiedText, setCopiedText] = useState<string | null>(null)

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isAuthLoading, router])

  // Fetch data
  const fetchData = async (showSpinner = true) => {
    if (!token) return
    if (showSpinner) setIsLoading(true)
    setError(null)
    try {
      // Fetch transactions and notifications in parallel
      const [txRes, notifRes] = await Promise.all([
        fetch(`${API_URL}/api/send-money/history`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/notifications`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      if (!txRes.ok || !notifRes.ok) {
        throw new Error('Failed to fetch activity records from server')
      }

      const txData = await txRes.json()
      const notifData = await notifRes.json()

      setTransactions(txData)
      setNotifications(notifData)
    } catch (err: any) {
      console.error('Error fetching activity data:', err)
      setError(err.message || 'An unexpected error occurred while loading your activity history.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchData(true)
    }
  }, [isAuthenticated, token, publicKey])

  // Refresh helper
  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchData(false)
  }

  // Notification Operations
  const handleMarkAsRead = async (id: string) => {
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, is_read: true } : n)
        )
      }
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  const handleDeleteNotification = async (id: string) => {
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id))
      }
    } catch (err) {
      console.error('Error deleting notification:', err)
    }
  }

  const handleClearAllNotifications = async () => {
    if (!token) return
    if (!confirm('Are you sure you want to delete all notifications? This action cannot be undone.')) return
    try {
      const res = await fetch(`${API_URL}/api/notifications`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        setNotifications([])
      }
    } catch (err) {
      console.error('Error clearing all notifications:', err)
    }
  }

  // Clipboard helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(text)
    setTimeout(() => setCopiedText(null), 2000)
  }

  // Address formatter
  const truncate = (str: string) => {
    if (!str) return ''
    return `${str.slice(0, 8)}...${str.slice(-8)}`
  }

  // Generate grid background identical to profile and send-money page
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
    ]

    let linesHtml = ''

    for (let i = 1; i <= 4; i++) {
      const coord = i * 96
      linesHtml += `<line x1="${coord}" y1="0" x2="${coord}" y2="384" stroke="black" stroke-opacity="0.18" stroke-width="1" />`
      linesHtml += `<line x1="0" y1="${coord}" x2="384" y2="${coord}" stroke="black" stroke-opacity="0.18" stroke-width="1" />`
    }

    activeCells.forEach(cell => {
      const startX = cell.col * 96
      const startY = cell.row * 96
      const lineCount = 11
      const paddingX = 14
      const startYOffset = 16
      const gap = 6

      linesHtml += `<g stroke="black" stroke-opacity="0.22" stroke-width="1.8" stroke-linecap="round">`
      for (let l = 0; l < lineCount; l++) {
        const y = startY + startYOffset + (l * gap)
        const isIndented = (cell.seed + l) % 3 === 0 && l > 1 && l < lineCount - 2
        const indent = isIndented ? 12 : 0
        const left = startX + paddingX + indent
        const lengthFactor = Math.abs(Math.sin(cell.seed * 1.5 + l * 2.3))
        const maxLength = 96 - (paddingX * 2) - indent
        const lineLength = 15 + lengthFactor * (maxLength - 15)
        const right = left + lineLength
        linesHtml += `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" />`
      }
      linesHtml += `</g>`
    })

    return `<svg xmlns="http://www.w3.org/2000/svg" width="384" height="384" viewBox="0 0 384 384">${linesHtml}</svg>`
  }

  const gridBackground = `url("data:image/svg+xml,${encodeURIComponent(generateGridSvg())}")`

  // Process and Filter Activities
  const filteredActivities = useMemo(() => {
    const items: Array<
      | { itemType: 'transaction'; data: DBTransaction; timestamp: number }
      | { itemType: 'notification'; data: Notification; timestamp: number }
    > = []

    // 1. Add Transactions if matches activeTab
    if (activeTab === 'all' || activeTab === 'transactions') {
      transactions.forEach(tx => {
        const isSender = tx.sender_wallet === publicKey
        const matchesQuery =
          tx.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.sender_wallet.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.recipient_wallet.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (tx.tx_hash && tx.tx_hash.toLowerCase().includes(searchQuery.toLowerCase()))

        const matchesType =
          typeFilter === 'all' ||
          (typeFilter === 'sent' && isSender) ||
          (typeFilter === 'received' && !isSender)

        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'SUCCESS' && tx.status === 'SUCCESS') ||
          (statusFilter === 'FAILED' && tx.status === 'FAILED')

        if (matchesQuery && matchesType && matchesStatus) {
          items.push({
            itemType: 'transaction',
            data: tx,
            timestamp: new Date(tx.created_at).getTime()
          })
        }
      })
    }

    // 2. Add Notifications if matches activeTab
    if (activeTab === 'all' || activeTab === 'notifications') {
      notifications.forEach(n => {
        const matchesQuery =
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.message.toLowerCase().includes(searchQuery.toLowerCase())

        const matchesType = typeFilter === 'all' || typeFilter === 'notifications'

        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'READ' && n.is_read) ||
          (statusFilter === 'UNREAD' && !n.is_read)

        if (matchesQuery && matchesType && matchesStatus) {
          items.push({
            itemType: 'notification',
            data: n,
            timestamp: new Date(n.created_at).getTime()
          })
        }
      })
    }

    // 3. Sort items
    return items.sort((a, b) => {
      if (sortBy === 'newest') {
        return b.timestamp - a.timestamp
      } else {
        return a.timestamp - b.timestamp
      }
    })
  }, [transactions, notifications, activeTab, searchQuery, typeFilter, statusFilter, sortBy, publicKey])

  // Count helper for unread notifications
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.is_read).length
  }, [notifications])

  // Loading skeleton screen
  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-black/50 text-sm gap-2.5">
        <Loader2 className="w-6 h-6 animate-spin text-black" />
        <span>Syncing activity workspace...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-white text-black selection:bg-black selection:text-white relative overflow-hidden">
      {/* Top Black Fading Radial Glow */}
      <div
        className="absolute top-0 left-0 w-full h-[550px] pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.45), transparent)',
          filter: 'blur(60px)',
          zIndex: 0,
        }}
      />

      {/* Background SVG Grid Pattern */}
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
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight font-sans">Activity Log</h1>
            <p className="text-sm text-black/50 mt-1 font-medium font-sans">
              Audit ledger payment routes and view real-time system alerts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold border border-black/10 hover:bg-black/5 rounded-xl transition-all cursor-pointer bg-white"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              <span>Refresh Feed</span>
            </button>
            {activeTab === 'notifications' && notifications.length > 0 && (
              <button
                onClick={handleClearAllNotifications}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/25 hover:bg-rose-500/20 rounded-xl transition-all cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Clear All Alerts</span>
              </button>
            )}
          </div>
        </div>

        {/* Overview Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-black/95 border border-white/10 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider block">Wallet Address</span>
            <span className="font-mono text-xs font-bold text-white/95 mt-2 block select-all">
              {publicKey ? truncate(publicKey) : 'Not connected'}
            </span>
          </div>

          <div className="bg-black/95 border border-white/10 rounded-2xl p-5 text-white shadow-xl">
            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider block">Total Transactions</span>
            <span className="text-xl font-black text-white mt-1 block">{transactions.length} Logged</span>
          </div>

          <div className="bg-black/95 border border-white/10 rounded-2xl p-5 text-white shadow-xl flex justify-between items-center">
            <div>
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider block">Unread Alerts</span>
              <span className="text-xl font-black text-white mt-1 block">{unreadCount} Pending</span>
            </div>
            {unreadCount > 0 && (
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
            )}
          </div>
        </div>

        {/* Tabs and Filtering UI */}
        <div className="bg-black/95 border border-white/10 rounded-3xl p-6 shadow-2xl text-white mb-8">
          <div className="flex flex-col gap-6">
            {/* Tab Swapping */}
            <div className="flex border-b border-white/10 pb-1 gap-5">
              <button
                onClick={() => {
                  setActiveTab('all')
                  setTypeFilter('all')
                  setStatusFilter('all')
                }}
                className={`pb-3 text-sm font-bold tracking-wide transition-all border-b-2 cursor-pointer relative ${
                  activeTab === 'all'
                    ? 'border-white text-white'
                    : 'border-transparent text-white/40 hover:text-white/70'
                }`}
              >
                All Feed
              </button>
              <button
                onClick={() => {
                  setActiveTab('transactions')
                  setTypeFilter('all')
                  setStatusFilter('all')
                }}
                className={`pb-3 text-sm font-bold tracking-wide transition-all border-b-2 cursor-pointer ${
                  activeTab === 'transactions'
                    ? 'border-white text-white'
                    : 'border-transparent text-white/40 hover:text-white/70'
                }`}
              >
                Transactions ({transactions.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab('notifications')
                  setTypeFilter('all')
                  setStatusFilter('all')
                }}
                className={`pb-3 text-sm font-bold tracking-wide transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'notifications'
                    ? 'border-white text-white'
                    : 'border-transparent text-white/40 hover:text-white/70'
                }`}
              >
                <span>Alerts ({notifications.length})</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-500 text-black font-black">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Inputs & Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Search input */}
              <div className="md:col-span-5 relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  placeholder="Search by wallet, purpose, message or hash..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all font-sans"
                />
              </div>

              {/* Type Filter */}
              <div className="md:col-span-2.5">
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value as any)}
                  className="w-full appearance-none px-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-[#0F0F0F] text-white">All Event Types</option>
                  {activeTab !== 'notifications' && (
                    <>
                      <option value="sent" className="bg-[#0F0F0F] text-white">Sent Payments</option>
                      <option value="received" className="bg-[#0F0F0F] text-white">Received Payments</option>
                    </>
                  )}
                  {activeTab !== 'transactions' && (
                    <option value="notifications" className="bg-[#0F0F0F] text-white">System Alerts</option>
                  )}
                </select>
              </div>

              {/* Status Filter */}
              <div className="md:col-span-2.5">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="w-full appearance-none px-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-[#0F0F0F] text-white">All Statuses</option>
                  {activeTab !== 'notifications' && (
                    <>
                      <option value="SUCCESS" className="bg-[#0F0F0F] text-white">Successful</option>
                      <option value="FAILED" className="bg-[#0F0F0F] text-white">Failed</option>
                    </>
                  )}
                  {activeTab !== 'transactions' && (
                    <>
                      <option value="UNREAD" className="bg-[#0F0F0F] text-white">Unread Alerts</option>
                      <option value="READ" className="bg-[#0F0F0F] text-white">Read Alerts</option>
                    </>
                  )}
                </select>
              </div>

              {/* Sort filter */}
              <div className="md:col-span-2">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="w-full appearance-none px-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="newest" className="bg-[#0F0F0F] text-white">Newest First</option>
                  <option value="oldest" className="bg-[#0F0F0F] text-white">Oldest First</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Main List Area */}
        <div className="bg-black/95 border border-white/10 rounded-3xl p-6 shadow-2xl text-white">
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center text-white/45 text-xs gap-3">
              <Loader2 className="w-7 h-7 animate-spin" />
              <span>Syncing your historical activity dashboard...</span>
            </div>
          ) : error ? (
            <div className="py-16 text-center">
              <AlertCircle size={32} className="text-rose-400 mx-auto mb-3" />
              <h3 className="text-white font-bold text-sm">Failed to Load Activity</h3>
              <p className="text-white/40 text-xs mt-1 max-w-sm mx-auto leading-relaxed">{error}</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="py-20 text-center text-white/45 text-xs font-semibold">
              No matching activity records found. Try modifying your search filters.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredActivities.map(activity => {
                if (activity.itemType === 'transaction') {
                  const tx = activity.data
                  const isSender = tx.sender_wallet === publicKey
                  const counterparty = isSender ? tx.recipient_wallet : tx.sender_wallet

                  return (
                    <div
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-white/10 rounded-2xl transition-all duration-200 cursor-pointer"
                    >
                      {/* Left: Direction Icon & Address Info */}
                      <div className="flex items-start gap-3.5">
                        <div className={`p-2.5 rounded-xl shrink-0 border mt-0.5 ${
                          isSender
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        }`}>
                          {isSender ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white/95">
                              {isSender ? 'Sent Remittance' : 'Received Funds'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-[6px] text-[9px] font-black uppercase tracking-wide ${
                              tx.status === 'SUCCESS'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                                : tx.status === 'FAILED'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/10'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/10'
                            }`}>
                              {tx.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-white/45 font-medium leading-relaxed font-mono">
                            {isSender ? 'To: ' : 'From: '} {truncate(counterparty)}
                          </p>
                          <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wider">
                            Purpose: {tx.purpose}
                          </p>
                        </div>
                      </div>

                      {/* Right: Date, Amount & Info Action */}
                      <div className="flex sm:flex-col justify-between items-end gap-1 shrink-0 self-end sm:self-center">
                        <span className="font-mono text-sm font-black text-white/90">
                          {isSender ? '-' : '+'}{tx.amount} <span className="text-xs text-white/40">XLM</span>
                        </span>
                        <div className="flex items-center gap-2 text-right">
                          <span className="text-[10px] text-white/40 font-medium font-sans">
                            {new Date(tx.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          <span className="text-[10px] text-white/30 group-hover:text-white/60 transition-colors uppercase font-bold tracking-wider hidden sm:block">
                            Details →
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                } else {
                  // Notification card
                  const n = activity.data
                  return (
                    <div
                      key={n.id}
                      className={`flex gap-4 p-4 border rounded-2xl transition-all duration-200 relative overflow-hidden ${
                        n.is_read
                          ? 'bg-white/[0.005] border-white/5 opacity-65 hover:opacity-85'
                          : 'bg-white/[0.02] border-white/10 hover:border-white/15'
                      }`}
                    >
                      {/* Left Alert type icon */}
                      <div className={`p-2.5 rounded-xl shrink-0 border self-start ${
                        n.type === 'SUCCESS'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : n.type === 'ERROR'
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                      }`}>
                        {n.type === 'SUCCESS' ? (
                          <CheckCircle size={18} />
                        ) : n.type === 'ERROR' ? (
                          <AlertCircle size={18} />
                        ) : (
                          <Info size={18} />
                        )}
                      </div>

                      {/* Middle description content */}
                      <div className="flex-1 space-y-1.5 pr-14">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white/95">{n.title}</span>
                          {!n.is_read && (
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                          )}
                        </div>
                        <p className="text-[11px] text-white/50 leading-relaxed font-semibold">
                          {n.message}
                        </p>
                        <span className="text-[10px] text-white/30 font-medium block">
                          {new Date(n.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      {/* Right actions overlay */}
                      <div className="absolute right-4 top-4 flex items-center gap-1.5">
                        {!n.is_read && (
                          <button
                            onClick={() => handleMarkAsRead(n.id)}
                            title="Mark as Read"
                            className="p-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl transition-all cursor-pointer border border-white/5"
                          >
                            <Check size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteNotification(n.id)}
                          title="Delete Alert"
                          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl transition-all cursor-pointer border border-rose-500/10"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )
                }
              })}
            </div>
          )}
        </div>
      </main>

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0F0F0F] border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl text-white relative">
            <button
              onClick={() => setSelectedTx(null)}
              className="absolute right-4 top-4 p-2 hover:bg-white/5 text-white/45 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="flex flex-col items-center space-y-5">
              {/* Icon Indicator */}
              <div className={`w-12 h-12 rounded-full border flex items-center justify-center shadow-lg ${
                selectedTx.sender_wallet === publicKey
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}>
                {selectedTx.sender_wallet === publicKey ? (
                  <ArrowUpRight size={22} strokeWidth={2.5} />
                ) : (
                  <ArrowDownLeft size={22} strokeWidth={2.5} />
                )}
              </div>

              {/* Header Details */}
              <div className="text-center">
                <h3 className="font-extrabold text-lg tracking-tight uppercase">
                  {selectedTx.sender_wallet === publicKey ? 'Remittance Sent' : 'Remittance Received'}
                </h3>
                <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-[9px] font-bold border mt-2 ${
                  selectedTx.status === 'SUCCESS'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                  {selectedTx.status === 'SUCCESS' ? 'Settled on Testnet' : 'Failed / Rejected'}
                </span>
              </div>

              {/* Receipt Parameters */}
              <div className="w-full bg-white/[0.02] border border-white/5 rounded-2xl p-4.5 space-y-4 text-xs font-semibold">
                <div className="flex justify-between items-baseline gap-4">
                  <span className="text-white/40">Amount</span>
                  <span className="font-mono text-white/95 font-black text-sm">{selectedTx.amount} XLM</span>
                </div>

                <div className="flex justify-between items-baseline gap-4 border-t border-white/5 pt-3">
                  <span className="text-white/40">Date & Time</span>
                  <span className="text-white/90 font-medium">
                    {new Date(selectedTx.created_at).toLocaleString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </span>
                </div>

                <div className="flex justify-between items-baseline gap-4 border-t border-white/5 pt-3">
                  <span className="text-white/40">Purpose</span>
                  <span className="text-white/90">{selectedTx.purpose}</span>
                </div>

                <div className="flex justify-between items-start gap-4 border-t border-white/5 pt-3">
                  <span className="text-white/40">Sender Wallet</span>
                  <span className="font-mono text-[10px] text-white/70 text-right break-all max-w-[200px] select-all">
                    {selectedTx.sender_wallet}
                  </span>
                </div>

                <div className="flex justify-between items-start gap-4 border-t border-white/5 pt-3">
                  <span className="text-white/40">Recipient Wallet</span>
                  <span className="font-mono text-[10px] text-white/70 text-right break-all max-w-[200px] select-all">
                    {selectedTx.recipient_wallet}
                  </span>
                </div>

                {selectedTx.tx_hash && (
                  <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
                    <span className="text-white/40">Stellar Transaction Hash</span>
                    <div className="flex items-center gap-2 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2 w-full">
                      <span className="font-mono text-[9px] text-white/75 truncate select-all flex-1">
                        {selectedTx.tx_hash}
                      </span>
                      <button
                        onClick={() => handleCopy(selectedTx.tx_hash || '')}
                        className="p-1 hover:bg-white/15 text-white/45 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Copy Hash"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${selectedTx.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-white/15 text-white/45 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Explore Ledger"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    {copiedText === selectedTx.tx_hash && (
                      <span className="text-[9px] text-emerald-400 font-bold self-end pr-1 animate-pulse">
                        ✓ Copied to clipboard
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedTx(null)}
                className="w-full py-2.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-white/95 transition-all cursor-pointer active:scale-98"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
