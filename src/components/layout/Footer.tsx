'use client';

import React from 'react';

const footerLinks = [
  {
    title: 'Accounts',
    links: ['Checking Account', 'Savings Account', 'Joint Accounts', 'Business Banking'],
  },
  {
    title: 'Security',
    links: ['AES-256 Encryption', 'Biometric MFA', 'Fraud Protection', 'Privacy Policy'],
  },
  {
    title: 'Trust',
    links: ['FDIC Insurance', 'Security Audits', 'Compliance', 'Bug Bounty Program'],
  },
  {
    title: 'Company',
    links: ['About UZU UNION', 'Careers', 'Press', 'Contact Us'],
  },
];

export function Footer() {
  return (
    <footer className="relative z-10 bg-bybit-surface/80 border-t border-bybit-border pt-16 pb-8 text-gray-400 text-sm" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-12 border-b border-bybit-border">
          <div className="col-span-2 md:col-span-1 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-bybit-yellow flex items-center justify-center shadow-bybit-glow">
                <span className="text-bybit-bg font-extrabold text-sm">U</span>
              </div>
              <span className="text-base font-extrabold text-white">
                UZU <span className="text-bybit-yellow">UNION</span>
              </span>
            </div>
            <p className="text-xs leading-relaxed text-gray-500">
              Secure banking for everyone. AES-256 encryption, biometric MFA, and 24/7 fraud monitoring. Your financial security is our foundation.
            </p>
            <div className="flex gap-3 pt-2">
              {['X', 'LI', 'IG', 'FB'].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="w-8 h-8 rounded-lg bg-bybit-elevated border border-bybit-border flex items-center justify-center text-xs font-bold text-gray-400 hover:text-bybit-yellow hover:border-bybit-yellow/30 transition-colors"
                  aria-label={`Follow us on ${s}`}
                >
                  {s}
                </a>
              ))}
            </div>
          </div>
          {footerLinks.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-xs text-gray-500 hover:text-bybit-yellow transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8">
          <div className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} UZU UNION Bank N.A. All rights reserved. Member FDIC.
          </div>
          <div className="flex gap-6 text-xs">
            <a href="#" className="text-gray-500 hover:text-bybit-yellow transition-colors">Privacy Policy</a>
            <a href="#" className="text-gray-500 hover:text-bybit-yellow transition-colors">Terms of Service</a>
            <a href="#" className="text-gray-500 hover:text-bybit-yellow transition-colors">Accessibility</a>
            <a href="#" className="text-gray-500 hover:text-bybit-yellow transition-colors">Disclosures</a>
          </div>
        </div>
      </div>
    </footer>
  );
}