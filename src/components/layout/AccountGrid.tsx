'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, TrendingUp, CheckCircle2, PiggyBank, Eye, EyeOff } from 'lucide-react';

const accounts = [
  {
    title: 'Savings Account',
    desc: 'Grow your money with competitive interest rates, automated savings tools, and zero minimum balance requirements.',
    icon: PiggyBank,
    badge: '5.25% APY',
    accountNumber: 'UZU-SAV-8842-****-2214',
    routingNumber: '021000021',
    balance: '$18,420.80',
    type: 'savings',
    interestRate: '5.25% APY',
    minBalance: '$0',
    monthlyFee: '$0',
    features: ['Daily Compound Interest', 'Automated Round-Ups', 'FDIC Insured up to $250K', 'No minimum balance', 'Free transfers to checking'],
  },
  {
    title: 'Checking Account',
    desc: 'Everyday banking with zero monthly fees, free online bill pay, and instant mobile check deposits.',
    icon: Wallet,
    badge: 'Premium Checking',
    accountNumber: 'UZU-CHK-3317-****-5598',
    routingNumber: '021000021',
    balance: '$12,480.00',
    type: 'checking',
    interestRate: '0.01% APY',
    minBalance: '$0',
    monthlyFee: '$0',
    features: ['$0 Monthly Fees', 'Instant P2P Transfers', 'Virtual & Physical Cards', '50K+ fee-free ATMs', 'Free checks & bill pay'],
  },
];

export function AccountGrid() {
  const router = useRouter();

  return (
    <section id="accounts" className="relative z-10 py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" aria-label="Account types">
      <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
        <h2 className="text-3xl lg:text-5xl font-extrabold text-white">
          Engineered for <span className="text-bybit-yellow">Absolute Security</span>
        </h2>
        <p className="text-slate-400">
          Every account uses password and bank-PIN sign-in. Your financial security is our top priority.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {accounts.map((acc, idx) => {
          const Icon = acc.icon;
          return (
            <div
              key={idx}
              className="p-8 rounded-3xl bg-bybit-surface border border-bybit-border hover:border-bybit-yellow/50 transition-all duration-300 shadow-card-hover group flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-bybit-yellow/10 border border-bybit-yellow/30 flex items-center justify-center text-bybit-yellow group-hover:scale-110 transition-transform">
                    <Icon className="w-7 h-7" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-bybit-bg border border-bybit-border text-bybit-yellow text-xs font-semibold">
                    {acc.badge}
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-white">{acc.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{acc.desc}</p>

                {/* Account Details */}
                <div className="p-4 rounded-xl bg-bybit-bg/60 border border-bybit-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Account Number</span>
                    <span className="text-sm font-mono font-bold text-white tracking-wider">{acc.accountNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Routing Number</span>
                    <span className="text-sm font-mono font-bold text-white">{acc.routingNumber}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-bybit-border">
                    <span className="text-xs text-slate-500">Available Balance</span>
                    <span className="text-lg font-bold text-bybit-yellow">{acc.balance}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Interest Rate</span>
                    <span className="text-sm font-semibold text-emerald-400">{acc.interestRate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Min Balance</span>
                    <span className="text-sm font-semibold text-white">{acc.minBalance}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Monthly Fee</span>
                    <span className="text-sm font-semibold text-emerald-400">{acc.monthlyFee}</span>
                  </div>
                </div>

                <ul className="space-y-3 pt-4 border-t border-bybit-border">
                  {acc.features.map((feat, fIdx) => (
                    <li key={fIdx} className="flex items-center gap-3 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-bybit-yellow flex-shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => router.push('/register')}
                className="mt-8 w-full py-3 rounded-xl bg-bybit-bg border border-bybit-border text-white font-semibold hover:bg-bybit-yellow hover:text-bybit-bg transition-all"
              >
                Open Account &uarr;
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}