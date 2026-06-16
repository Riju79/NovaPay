'use client'

import React, { useState, useEffect } from 'react'
import Logo from './Logo'
import { Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ConnectWalletButton from './ConnectWalletButton'
import { useAuth } from '@/context/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [activePath, setActivePath] = useState('')

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
          {isAuthenticated && user ? (
            <button 
              onClick={() => router.push('/profile')}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-xs text-white">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-white/95 pr-1.5">{user.full_name.split(' ')[0]}</span>
            </button>
          ) : (
            <button 
              onClick={() => router.push('/login')}
              className="px-5 py-2.5 text-sm font-medium text-white border border-white/15 hover:border-white hover:bg-white/5 rounded-full transition-all duration-200 bg-transparent cursor-pointer"
            >
              Sign In / Login
            </button>
          )}
          <ConnectWalletButton />
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
              {isAuthenticated && user ? (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    router.push('/profile')
                  }}
                  className="w-full py-3 text-center text-sm font-semibold text-white bg-white/5 border border-white/10 rounded-full hover:border-white/20 hover:bg-white/10 transition-all cursor-pointer"
                >
                  Profile Dashboard ({user.full_name})
                </button>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    router.push('/login')
                  }}
                  className="w-full py-3 text-center text-sm font-medium text-white border border-white/15 rounded-full hover:border-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  Sign In / Login
                </button>
              )}
              <div className="w-full flex justify-center">
                <ConnectWalletButton />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
