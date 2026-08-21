'use client'

import React, { useState, useEffect } from 'react'
import Logo from './Logo'
import { Menu, X, Wallet } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

import { useMidnightWallet } from '@/context/MidnightWalletContext'

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const [activePath, setActivePath] = useState('')
  const { wallet, isConnected, openModal, connect } = useMidnightWallet()

  const handleWalletButtonClick = () => {
    if (isConnected && wallet) {
      openModal()
    } else {
      connect('1am')
    }
  }

  const truncateAddress = (addr: string) => {
    if (!addr || addr.length <= 12) return addr
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`
  }

  // Sync active path with route changes
  useEffect(() => {
    if (pathname === '/') {
      setActivePath(window.location.hash ? `/${window.location.hash}` : '/')
    } else {
      setActivePath(pathname)
    }
  }, [pathname])

  // Sync active path with hash changes
  useEffect(() => {
    const handleHashChange = () => {
      setActivePath(window.location.hash ? `/${window.location.hash}` : '/')
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const handleHomeClick = (e: React.MouseEvent) => {
    if (pathname === '/') {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setActivePath('/')
    }
  }

  const handleLinkClick = (href: string) => {
    setActivePath(href)
  }

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true)
      } else {
        setIsScrolled(false)
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Send Request', href: '/request-money' },
    { name: 'Escrow', href: '/escrow' },
    { name: 'Recurring', href: '/recurring' },
    { name: 'Payment Methods', href: '/payment-methods' },
    { name: 'Activity', href: '/activity' },
  ]

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/5 ${
        isScrolled ? 'py-4 shadow-lg shadow-black/20' : 'py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Left: Logo and Desktop Nav Links */}
        <div className="flex items-center gap-10">
          <Link href="/" onClick={handleHomeClick} className="focus:outline-none" aria-label="NovaPay Home">
            <Logo inverted={true} />
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => {
              const active = link.href === '/' 
                ? activePath === '/' 
                : activePath === link.href || activePath.startsWith(link.href)
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={(e) => {
                    handleLinkClick(link.href)
                    if (link.name === 'Home') {
                      handleHomeClick(e)
                    }
                  }}
                  className={`text-sm font-semibold transition-all duration-300 cursor-pointer select-none ${
                    active
                      ? 'text-white'
                      : 'text-white/60 hover:text-white/95'
                  }`}
                >
                  {link.name}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right: Buttons (Desktop) */}
        <div className="hidden md:flex items-center gap-4">
          <button
            type="button"
            onClick={handleWalletButtonClick}
            className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-white/90 text-black font-bold text-xs rounded-full shadow-md transition-all active:scale-95 cursor-pointer font-mono"
          >
            <Wallet size={14} />
            <span>{isConnected && wallet ? truncateAddress(wallet.address) : 'Connect Wallet'}</span>
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 text-white/80 hover:text-white focus:outline-none cursor-pointer"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 bg-[#0A0A0A] border-b border-white/5 shadow-2xl flex flex-col px-6 py-6 gap-6 md:hidden"
          >
            <nav className="flex flex-col gap-4">
              {navLinks.map((link) => {
                const active = link.href === '/' 
                  ? activePath === '/' 
                  : activePath === link.href || activePath.startsWith(link.href)
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={(e) => {
                      handleLinkClick(link.href)
                      setMobileMenuOpen(false)
                      if (link.name === 'Home') {
                        handleHomeClick(e)
                      }
                    }}
                    className={`text-base font-semibold transition-all duration-300 cursor-pointer select-none ${
                      active
                        ? 'text-white'
                        : 'text-white/60 hover:text-white/95'
                    }`}
                  >
                    {link.name}
                  </Link>
                )
              })}
            </nav>
            <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleWalletButtonClick()
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-white/90 text-black font-bold text-sm rounded-xl cursor-pointer font-mono"
              >
                <Wallet size={16} />
                <span>{isConnected && wallet ? truncateAddress(wallet.address) : 'Connect Wallet'}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
