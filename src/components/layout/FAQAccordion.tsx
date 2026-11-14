'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    q: 'How is my data encrypted?',
    a: 'We use AES-256-GCM encryption for all data at rest and TLS 1.3 for data in transit — the same standards used by governments and militaries worldwide. Your financial data is never stored in plain text.',
  },
  {
    q: 'What authentication methods do you support?',
    a: 'We support multi-factor authentication including biometric (fingerprint, Face ID), TOTP authenticator apps, SMS codes, and hardware security keys (FIDO2/WebAuthn). You can enable multiple methods for layered protection.',
  },
  {
    q: 'How does fraud monitoring work?',
    a: 'Our AI-powered system analyzes every transaction in real-time, learning your spending patterns to detect anomalies. Suspicious activity triggers instant push notifications, and you can freeze your cards immediately from the app.',
  },
  {
    q: 'Is my account insured?',
    a: 'Yes. Deposits are FDIC insured up to $250,000 per depositor. Additionally, we maintain a HSM-backed security infrastructure with multi-signature authorization for all high-value transactions.',
  },
  {
    q: 'What happens if my device is lost or stolen?',
    a: 'You can instantly freeze all accounts and cards from any other device via our web portal. Our 24/7 support team can also assist with device de-authorization and account recovery with identity verification.',
  },
  {
    q: 'How do you protect against phishing?',
    a: 'We never ask for your password, PIN, or 2FA codes via email, phone, or SMS. Our platform includes anti-phishing codes, session monitoring, and rate-limited login attempts to prevent brute-force attacks.',
  },
];

export function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto" aria-label="Frequently asked questions">
      <div className="text-center space-y-4 mb-14">
        <span className="text-xs font-mono text-bybit-yellow tracking-widest uppercase font-semibold">FAQ</span>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
          Questions? We&apos;ve Got <span className="text-bybit-yellow">Answers</span>
        </h2>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={i}
              className="rounded-2xl bg-bybit-surface border border-bybit-border overflow-hidden transition-all duration-300"
            >
              <button
                className="w-full flex items-center justify-between px-6 py-5 text-left text-white font-medium hover:bg-bybit-elevated transition-colors"
                onClick={() => toggle(i)}
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${i}`}
              >
                <span className="text-sm sm:text-base pr-4">{faq.q}</span>
                <ChevronDown
                  size={18}
                  className={`text-bybit-yellow shrink-0 transition-transform duration-300 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                id={`faq-answer-${i}`}
                role="region"
                className={`overflow-hidden transition-all duration-300 ${
                  isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="px-6 pb-5 text-sm text-slate-400 leading-relaxed">
                  {faq.a}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}