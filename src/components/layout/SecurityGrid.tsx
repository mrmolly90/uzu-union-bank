'use client';

import React from 'react';
import { Lock, Eye, Fingerprint, FileCheck } from 'lucide-react';

const steps = [
  {
    icon: Lock,
    title: 'End-to-End Encryption',
    description: 'All your data is encrypted with AES-256 — the same standard used by governments and militaries worldwide.',
    stat: 'AES-256',
    statLabel: 'Encryption',
  },
  {
    icon: Eye,
    title: 'Real-Time Fraud Alerts',
    description: 'AI-powered monitoring scans every transaction 24/7. Get instant push notifications for any suspicious activity.',
    stat: '99.9%',
    statLabel: 'Detection Rate',
  },
  {
    icon: Fingerprint,
    title: 'Biometric MFA',
    description: 'Multi-factor authentication with fingerprint, Face ID, and hardware security keys. Your identity, protected.',
    stat: '3-Factor',
    statLabel: 'Authentication',
  },
  {
    icon: FileCheck,
    title: 'FDIC Insurance',
    description: 'Deposits insured up to $250,000 per depositor by the FDIC. Your money is safe with us.',
    stat: '$250K',
    statLabel: 'FDIC Insured',
  },
];

export function SecurityGrid() {
  return (
    <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" aria-label="Security features">
      <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
        <h2 className="text-3xl lg:text-5xl font-extrabold text-white">
          Military-Grade <span className="text-bybit-yellow">Protection</span>
        </h2>
        <p className="text-slate-400">
          We use the same encryption standards and security infrastructure trusted by governments and the world&apos;s largest financial institutions. Your money, your data, your identity — all protected.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={i} className="p-6 space-y-5 rounded-2xl bg-bybit-surface border border-bybit-border hover:border-bybit-yellow/50 transition-all duration-300 shadow-card-hover group relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-bybit-yellow/0 via-bybit-yellow/50 to-bybit-yellow/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="w-12 h-12 rounded-xl bg-bybit-yellow/10 border border-bybit-yellow/30 flex items-center justify-center text-bybit-yellow group-hover:scale-110 transition-transform">
                <Icon size={24} />
              </div>

              <div>
                <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{step.description}</p>
              </div>

              <div className="pt-4 border-t border-bybit-border">
                <div className="text-2xl font-bold text-bybit-yellow">{step.stat}</div>
                <div className="text-xs text-gray-500">{step.statLabel}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}