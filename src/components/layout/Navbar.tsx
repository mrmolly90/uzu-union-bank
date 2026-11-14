'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Menu, X, TrendingUp } from 'lucide-react';

const navItems = [
  { label: 'Personal', href: '#accounts' },
  { label: 'Business', href: '#business' },
  { label: 'Cards', href: '#cards' },
  { label: 'Markets', href: '#markets' },
  { label: 'About', href: '#about' },
];

export function Navbar() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-bybit-bg/80 backdrop-blur-md border-b border-bybit-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-bybit-yellow flex items-center justify-center shadow-bybit-glow relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{backgroundSize: '200% 100%'}} />
              <span className="text-bybit-bg font-extrabold text-sm lg:text-base relative z-10">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 lg:w-6 lg:h-6">
                  <path d="M3 10L12 3L21 10V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V10Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill="#0A0A0B"/>
                  <text x="12" y="13" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#F7D44A">$</text>
                </svg>
              </span>
            </div>
            <div>
              <span className="text-base lg:text-lg font-extrabold tracking-tight text-white">
                UZU <span className="text-bybit-yellow">UNION</span>
              </span>
              <span className="block text-[9px] lg:text-[10px] uppercase tracking-widest text-gray-500 font-mono">
                Digital Banking
              </span>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Primary navigation">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-bybit-yellow transition-colors rounded-lg hover:bg-bybit-yellow/5 relative group"
              >
                {item.label}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-bybit-yellow rounded-full group-hover:w-3/4 transition-all duration-300" />
              </a>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-4">
            {/* Security Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bybit-surface border border-bybit-border text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-semibold">AES-256</span>
              <span className="text-gray-500">|</span>
              <span className="text-gray-400">FDIC Insured</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/login')}>
              Log In
            </Button>
            <Button variant="primary" size="md" onClick={() => router.push('/register')}>
              Get Started
            </Button>
          </div>

          {/* Mobile Toggle */}
          <button
            className="lg:hidden p-2 text-gray-400 hover:text-bybit-yellow transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-bybit-border bg-bybit-bg/95 backdrop-blur-md">
          <div className="px-4 py-4 space-y-1">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="block px-4 py-3 text-sm font-medium text-gray-300 hover:text-bybit-yellow hover:bg-bybit-yellow/5 rounded-xl transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <div className="pt-4 space-y-3">
              <Button variant="secondary" className="w-full" onClick={() => { router.push('/login'); setMobileOpen(false); }}>
                Log In
              </Button>
              <Button variant="primary" className="w-full" onClick={() => { router.push('/register'); setMobileOpen(false); }}>
                Get Started
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}