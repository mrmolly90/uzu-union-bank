'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Globe, Zap, Lock } from 'lucide-react';

const cards = [
  {
    name: 'UZU Premium Visa',
    color: 'from-slate-800 to-slate-900',
    textColor: 'text-white',
    badge: 'Premium Visa',
    rewards: '5x points on travel & dining',
    features: ['$0 annual fee', 'Airport lounge access', 'Travel insurance', 'Concierge service', 'Chip & PIN technology', 'Contactless payments', 'Apple Pay / Google Pay'],
    border: 'border-blue-500/30',
    cardNumber: '4532 7819 0463 8817',
    cardHolder: 'UZU UNION PREMIUM',
    validThru: '12/28',
    cvv: '***',
    type: 'visa',
    atmLimit: '$5,000 daily ATM limit',
    onlineLimit: '$25,000 online purchase limit',
    contactless: 'Contactless / Apple Pay / Google Pay',
    creditLimit: '$25,000',
    apr: '0% intro APR for 12 months',
    annualFee: '$0',
    rewardsDetail: '5x travel & dining, 2x groceries, 1x everything else',
  },
  {
    name: 'UZU Business Mastercard',
    color: 'from-emerald-700 to-emerald-900',
    textColor: 'text-white',
    badge: 'Business Mastercard',
    rewards: '2% unlimited cash back',
    features: ['Employee cards', 'Expense categorization', 'Accounting integration', 'Higher limits', 'Chip & PIN technology', 'Contactless payments', 'Apple Pay / Google Pay'],
    border: 'border-emerald-500/30',
    cardNumber: '5493 2108 7766 4420',
    cardHolder: 'UZU UNION BUSINESS',
    validThru: '12/28',
    cvv: '***',
    type: 'mastercard',
    atmLimit: '$10,000 daily ATM limit',
    onlineLimit: '$50,000 online purchase limit',
    contactless: 'Contactless / Apple Pay / Google Pay',
    creditLimit: '$50,000',
    apr: '0% intro APR for 9 months',
    annualFee: '$0 first year, then $95',
    rewardsDetail: '2% unlimited cash back on all purchases',
  },
];

export function CardsSection() {
  const router = useRouter();

  return (
    <section id="cards" className="relative z-10 py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" aria-label="Card offerings">
      <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
        <h2 className="text-3xl lg:text-5xl font-extrabold text-white">
          Premium Cards. <span className="text-bybit-yellow">Zero Fraud Liability.</span>
        </h2>
        <p className="text-slate-400">
          Full Visa and Mastercard with chip & PIN technology, contactless payments, and global acceptance. Apply online instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {cards.map((card, i) => (
          <div
            key={i}
            className={`rounded-3xl overflow-hidden group bg-bybit-surface border ${card.border || 'border-bybit-border'} hover:border-bybit-yellow/50 transition-all duration-300 shadow-card-hover`}
          >
            {/* Card Preview - Full Card Design */}
            <div className={`bg-gradient-to-br ${card.color} p-6 sm:p-8 relative overflow-hidden`}>
              {/* Card chip */}
              <div className="absolute top-6 right-6">
                {card.type === 'visa' ? (
                  <div className="flex items-center gap-1">
                    <div className="w-10 h-7 rounded bg-blue-600/30 flex items-center justify-center">
                      <span className="text-blue-300 text-[8px] font-bold tracking-wider">VISA</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <div className="w-10 h-7 rounded bg-orange-500/30 flex items-center justify-center">
                      <span className="text-orange-300 text-[7px] font-bold tracking-wider">MC</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Chip icon */}
              <div className="mb-6">
                <div className="w-10 h-8 rounded-md bg-gradient-to-br from-yellow-300 to-amber-500 flex items-center justify-center">
                  <div className="w-8 h-6 rounded-sm border border-amber-700/40 flex items-center justify-center">
                    <div className="grid grid-cols-3 gap-0.5">
                      {[...Array(6)].map((_, j) => (
                        <div key={j} className="w-1 h-1 rounded-full bg-amber-700/40" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2.5 py-1 rounded-full bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider border border-white/20">
                    {card.badge}
                  </span>
                </div>
                <div className="space-y-1 mb-4">
                  <p className={`text-lg font-bold tracking-widest ${card.textColor} font-mono`}>{card.cardNumber}</p>
                  <div className="flex items-center gap-6">
                    <p className={`text-xs ${card.textColor} opacity-60`}>VALID THRU {card.validThru}</p>
                    <p className={`text-xs ${card.textColor} opacity-60`}>CVV {card.cvv}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-semibold ${card.textColor}`}>{card.cardHolder}</p>
                  <div className="flex gap-1">
                    <div className={`w-8 h-6 rounded ${card.textColor === 'text-bybit-bg' ? 'bg-bybit-bg/20' : 'bg-white/20'}`} />
                    <div className={`w-8 h-6 rounded ${card.textColor === 'text-bybit-bg' ? 'bg-bybit-bg/20' : 'bg-white/20'} -ml-3`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Card Details */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-bybit-yellow">
                <Zap size={16} />
                <span className="text-sm font-semibold">{card.rewards}</span>
              </div>

              <ul className="space-y-2.5">
                {card.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2.5 text-sm text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-bybit-yellow/60 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>

              {/* Card Limits & Details */}
              <div className="p-3 rounded-xl bg-bybit-bg/60 border border-bybit-border space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Lock size={12} className="text-bybit-yellow" />
                  <span>{card.atmLimit}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Globe size={12} className="text-bybit-yellow" />
                  <span>{card.onlineLimit}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Shield size={12} className="text-bybit-yellow" />
                  <span>{card.contactless}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-3 h-3 rounded-full bg-bybit-yellow/20 flex items-center justify-center text-[8px] text-bybit-yellow">$</span>
                  <span>Credit Limit: <span className="text-white font-semibold">{card.creditLimit}</span></span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-3 h-3 rounded-full bg-bybit-yellow/20 flex items-center justify-center text-[8px] text-bybit-yellow">%</span>
                  <span>APR: <span className="text-emerald-400 font-semibold">{card.apr}</span></span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-3 h-3 rounded-full bg-bybit-yellow/20 flex items-center justify-center text-[8px] text-bybit-yellow">$</span>
                  <span>Annual Fee: <span className="text-white font-semibold">{card.annualFee}</span></span>
                </div>
              </div>

              {/* Rewards Detail */}
              <div className="p-3 rounded-xl bg-bybit-yellow/5 border border-bybit-yellow/20">
                <p className="text-[10px] font-bold uppercase tracking-wider text-bybit-yellow mb-1 font-mono">Rewards</p>
                <p className="text-xs text-slate-300">{card.rewardsDetail}</p>
              </div>

              <button
                onClick={() => router.push('/register')}
                className="w-full py-3 rounded-xl bg-bybit-bg border border-bybit-border text-white font-semibold hover:bg-bybit-yellow hover:text-bybit-bg transition-all"
              >
                Apply Now &uarr;
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}