'use client';

import React from 'react';
import { ArrowRightLeft, Clock, Camera, Shield } from 'lucide-react';

const features = [
  {
    icon: ArrowRightLeft,
    title: 'Instant Transfers',
    description: 'Send money to any UZU member instantly. External transfers arrive in minutes, not days.',
  },
  {
    icon: Clock,
    title: '24/7 Account Access',
    description: 'Full banking control from your phone. Check balances, pay bills, and manage cards anytime.',
  },
  {
    icon: Camera,
    title: 'Mobile Check Deposit',
    description: 'Deposit checks in seconds. Just snap a photo and the funds are on their way.',
  },
  {
    icon: Shield,
    title: 'Bank-Grade Security',
    description: 'Biometric login, real-time fraud monitoring, and instant card freeze if your phone is lost.',
  },
];

export function MobileBanking() {
  return (
    <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" aria-label="Mobile banking">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left: Android Phone Mockup */}
        <div className="relative flex justify-center">
          <div className="relative w-[280px] sm:w-[320px]">
            {/* Android Phone Frame */}
            <div className="relative bg-bybit-surface rounded-[2.5rem] border-4 border-bybit-border p-3 shadow-2xl animate-float">
              {/* Top bar - Android style */}
              <div className="flex items-center justify-between px-2 pb-2 text-[10px] text-gray-400">
                <span className="font-semibold">10:41</span>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 9l4 4-4 4" />
                    <path d="M7 17h10l4-4-4-4H7" />
                  </svg>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="10" rx="2" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M12 4v16" />
                  </svg>
                </div>
              </div>
              {/* Camera notch - Android style */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-bybit-bg rounded-b-xl z-10 flex items-center justify-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-bybit-surface border border-bybit-border" />
              </div>
              <div className="bg-bybit-bg rounded-[2rem] overflow-hidden">
                <div className="bg-bybit-surface px-4 pt-6 pb-2 flex items-center justify-between text-[10px] text-gray-400">
                  <span className="font-semibold">UZU BANK</span>
                  <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-full bg-bybit-yellow/20 border border-bybit-yellow/30 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-bybit-yellow" />
                    </div>
                  </div>
                </div>
                <div className="px-4 pb-6 space-y-4">
                  <div>
                    <p className="text-[10px] text-gray-500">Total Balance</p>
                    <p className="text-xl font-bold text-white">$30,900.80</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-bybit-surface rounded-xl p-3">
                      <p className="text-[9px] text-gray-500">Checking</p>
                      <p className="text-sm font-bold text-white">$12,480</p>
                    </div>
                    <div className="bg-bybit-surface rounded-xl p-3 border border-bybit-yellow/20">
                      <p className="text-[9px] text-gray-500">Savings</p>
                      <p className="text-sm font-bold text-bybit-yellow">$18,420</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {['Send', 'Deposit', 'Pay', 'Cards'].map((action) => (
                      <div key={action} className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-full bg-bybit-surface border border-bybit-border flex items-center justify-center">
                          <div className="w-4 h-4 rounded-full bg-bybit-yellow/20" />
                        </div>
                        <span className="text-[9px] text-gray-400">{action}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Recent</p>
                    <div className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-[8px] font-bold">D</div>
                        <div>
                          <p className="text-[10px] text-white font-medium">Direct Deposit</p>
                          <p className="text-[8px] text-gray-500">Today</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-400">+$3,420</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Features */}
        <div className="space-y-8">
          <div className="space-y-4">
            <span className="text-xs font-mono text-bybit-yellow tracking-widest uppercase font-semibold">Mobile Security</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
              Your Bank, <span className="text-bybit-yellow">Always Protected</span>
            </h2>
            <p className="text-slate-400 text-sm sm:text-base max-w-lg">
              Full-service banking from anywhere with military-grade encryption. Biometric login, real-time fraud alerts, and instant card freeze — all at your fingertips.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {features.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <div key={i} className="p-5 space-y-3 rounded-2xl bg-bybit-surface border border-bybit-border hover:border-bybit-yellow/30 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-bybit-yellow/10 border border-bybit-yellow/30 flex items-center justify-center text-bybit-yellow">
                    <Icon size={20} />
                  </div>
                  <h3 className="text-sm font-bold text-white">{feat.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{feat.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}