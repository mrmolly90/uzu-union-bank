'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ArrowUpRight, Shield, Lock, TrendingUp } from 'lucide-react';

export function Hero() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'checking' | 'savings'>('checking');

  return (
    <section className="relative z-10 pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center min-h-[90vh]" aria-label="Hero">
      
      {/* ═══ LEFT: Copy, Tickers & CTAs ═══ */}
      <div className="lg:col-span-7 space-y-8">
        {/* Trust Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bybit-surface border border-bybit-border text-bybit-yellow text-xs font-semibold tracking-wide uppercase shadow-bybit-glow">
          <span className="w-2 h-2 rounded-full bg-bybit-yellow animate-pulse" />
          AES-256 Encrypted &bull; Biometric MFA &bull; 24/7 Fraud Monitoring
        </div>

        <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-white leading-none">
          YOUR MONEY. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-bybit-yellow via-yellow-200 to-amber-500 drop-shadow-[0_0_12px_rgba(247,166,0,0.4)]">
            PROTECTED.
          </span> <br />
          BANK WITH TRUST.
        </h1>

        <p className="text-slate-400 text-lg max-w-xl leading-relaxed">
          Experience digital banking engineered for global performance, with password and bank-PIN sign-in.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <Button variant="primary" size="lg" onClick={() => router.push('/register')}>
            Open Free Account <ArrowUpRight size={18} />
          </Button>
          <Button variant="secondary" size="lg" onClick={() => router.push('/login')}>
            View Security Features
          </Button>
        </div>

        {/* Security Trust Bar */}
        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-bybit-border">
          <div>
            <p className="text-xs text-slate-400">Encryption</p>
            <p className="text-lg font-bold text-white">AES-256</p>
            <p className="text-[10px] text-emerald-400">Military Grade</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Authentication</p>
            <p className="text-lg font-bold text-emerald-400">3-Factor <span className="text-xs">MFA</span></p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Fraud Detection</p>
            <p className="text-lg font-bold text-bybit-yellow">99.9%</p>
            <p className="text-[10px] text-emerald-400">AI-Powered 24/7</p>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT: Security Trust Panel ═══ */}
      <div className="lg:col-span-5">
        <div className="relative p-6 sm:p-8 rounded-3xl bg-bybit-surface/90 border border-bybit-border backdrop-blur-2xl shadow-card-hover space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-bybit-yellow/10 border border-bybit-yellow/30 flex items-center justify-center text-bybit-yellow font-bold">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="text-white font-bold">SECURITY CENTER</h3>
                <p className="text-xs text-slate-400">Trust & Protection Hub</p>
              </div>
            </div>
            <Lock className="w-5 h-5 text-bybit-yellow" />
          </div>

          {/* Security Status */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-bybit-elevated to-bybit-bg border border-bybit-border space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider">
                Security Status
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse mr-1" />
                All Systems Secure
              </span>
            </div>
            <div className="text-4xl font-extrabold text-white tracking-tight">
              100% Protected
            </div>
            <div className="pt-2 border-t border-bybit-border flex justify-between text-xs text-slate-400">
              <span>AES-256-GCM &bull; TLS 1.3</span>
              <span className="text-bybit-yellow font-medium">HSM-Secured Node</span>
            </div>
          </div>

          {/* Security Layers Feed */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Security Layers</p>
            <div className="flex items-center justify-between p-3 rounded-xl bg-bybit-bg border border-bybit-border/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold">
                  <Shield size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">End-to-End Encryption</p>
                  <p className="text-xs text-slate-400">AES-256-GCM &bull; Data at Rest & In Transit</p>
                </div>
              </div>
              <span className="text-emerald-400 font-bold text-xs">Active</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-bybit-bg border border-bybit-border/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-bybit-yellow/10 flex items-center justify-center text-bybit-yellow font-bold">
                  <Lock size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Biometric MFA</p>
                  <p className="text-xs text-slate-400">Fingerprint &bull; Face ID &bull; Hardware Keys</p>
                </div>
              </div>
              <span className="text-emerald-400 font-bold text-xs">Active</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}