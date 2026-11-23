'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/store/auth';
import { useSnapshotStore } from '@/store/snapshot';
import { COUNTRIES, CURRENCY_SYMBOLS, getCurrencyByCountryCode, getCountryName, formatLocalAmount, getCountryLocale, isEuropeanCountry } from '@/lib/countries';
import type { AccountBalance } from '@/types';
import { formatIbanDisplay as ibanFull, formatIbanShort as ibanShort, convertCurrency } from '@/lib/format';
import {
  ArrowLeft, Send, Globe, Shield, ArrowRightLeft,
  Banknote, Building2, ChevronRight, Check,
  AlertCircle, Info, Loader2, Copy, ExternalLink,
  Clock, Landmark, FileText, Phone, Mail,
  HelpCircle, CheckCircle2, X, Wallet, PiggyBank, ArrowRight,
} from 'lucide-react';

const uniqueCurrencies = COUNTRIES.filter((c, i, a) => a.findIndex((x) => x.currency === c.currency) === i);

// Single source of truth (src/lib/format.ts): last 4 digits, legacy-safe.
const formatIbanShort = (num: string) => ibanShort(num);

export default function TransferPage() {
  const router = useRouter();
  const { isAuthenticated, hydrated, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  const userCurrency = getCurrencyByCountryCode(user?.countryCode || 'US');
  const [step, setStep] = useState(1);
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [selectedAccountType, setSelectedAccountType] = useState<'checking' | 'savings'>('checking');
  const [form, setForm] = useState({
    fromCurrency: userCurrency,
    toCurrency: 'EUR',
    amount: '',
    beneficiaryName: '',
    beneficiaryAddress: '',
    iban: '',
    swift: '',
    bankName: '',
    reference: '',
    purpose: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receiptRef, setReceiptRef] = useState('');
  const [submitError, setSubmitError] = useState('');

  // DB Snapshot — reflects live transferPaused status from admin
  const snapshot = useSnapshotStore(s => s.snapshot);
  const transferPaused = snapshot?.user?.transferPaused ?? false;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) router.push('/login');
    fetchAccounts();
    // Take a DB snapshot to verify user store data for wire transfer
    // Snapshot is the SOURCE OF TRUTH for balances — reflects admin funding/debit instantly
    const { tokens } = useAuthStore.getState();
    if (tokens?.accessToken) {
      useSnapshotStore.getState().fetchSnapshot(tokens.accessToken)
        .then(snap => {
          // Use snapshot accounts as primary source (verified DB balances)
          if (snap?.accounts) setAccounts(snap.accounts);
        })
        .catch(err => console.warn('[Transfer] Snapshot fetch (non-fatal):', err));
    }
  }, [isAuthenticated, hydrated, router]);

  const fetchAccounts = async () => {
    try {
      const { tokens } = useAuthStore.getState();
      if (!tokens?.accessToken) return;
      // First try snapshot for verified DB balances
      const snap = useSnapshotStore.getState().snapshot;
      if (snap?.accounts) {
        setAccounts(snap.accounts);
        return;
      }
      // Fallback to API
      const res = await fetch('/api/accounts', { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch (err) { console.error('Fetch accounts error:', err); }
  };

  if (!mounted || !isAuthenticated) return null;

  // Account type is authoritative. New accounts carry plain 16-digit numbers
  // with no CHK/SAV marker, so filtering on the string alone emptied both
  // columns and broke the whole transfer flow. `includes` stays as a fallback
  // for legacy rows still stored as UZU-CHK-…/UZU-SAV-….
  const checkingAccounts = accounts.filter(a => a.accountType === 'CHECKING' || (a.accountNumber && a.accountNumber.includes('CHK')));
  const savingsAccounts = accounts.filter(a => a.accountType === 'SAVINGS' || (a.accountNumber && a.accountNumber.includes('SAV')));
  const totalChecking = checkingAccounts.reduce((s, a) => s + Number(a.balance), 0);
  const totalSavings = savingsAccounts.reduce((s, a) => s + Number(a.balance), 0);
  const primaryChecking = checkingAccounts.find(a => a.currency === form.fromCurrency) || checkingAccounts[0];
  const primarySavings = savingsAccounts.find(a => a.currency === form.fromCurrency) || savingsAccounts[0];
  const getCurrencySymbol = (currency: string) => CURRENCY_SYMBOLS[currency] || '$';
  const formatAmount = (amount: number, currency: string) => {
    const locale = getCountryLocale(user?.countryCode || 'US');
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    } catch {
      return `${getCurrencySymbol(currency)}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  };

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const estimatedRate = convertCurrency(1, form.fromCurrency, form.toCurrency);
  const estimatedAmount = form.amount ? (parseFloat(form.amount) * estimatedRate).toFixed(2) : '0.00';
  const fee = form.amount ? Math.max(3, parseFloat(form.amount) * 0.001).toFixed(2) : '0.00';
  const sourceAccounts = selectedAccountType === 'checking' ? checkingAccounts : savingsAccounts;
  const sourceAccount = sourceAccounts.find(a => a.currency === form.fromCurrency) || sourceAccounts[0];
  const totalDebit = (Number(form.amount) || 0) + Number(fee);
  const hasSufficientFunds = !!sourceAccount && Number(sourceAccount.balance) >= totalDebit;

  const handleSubmit = async () => {
    setSubmitError('');
    setLoading(true);
    try {
      const { tokens } = useAuthStore.getState();
      if (!tokens?.accessToken) throw new Error('Not authenticated');

      if (!sourceAccount) throw new Error('No source account found');
      if (!hasSufficientFunds) throw new Error('Insufficient funds to cover the transfer and fee.');

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({
          sourceAccountId: sourceAccount.id,
          destinationBankSwift: form.swift,
          destinationBankName: form.bankName,
          destinationIban: form.iban,
          sourceAmount: parseFloat(form.amount),
          destinationCurrency: form.toCurrency,
          fee: parseFloat(fee),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Transfer failed');
      }

      setReceiptRef(`UZU-WIRE-${Date.now().toString(36).toUpperCase()}`);
      setSuccess(true);
      fetchAccounts();
      // Take a fresh DB snapshot after successful transfer to verify updated balances
      // This ensures the receipt and balance display reflect the confirmed debit
      const { tokens: freshTokens } = useAuthStore.getState();
      if (freshTokens?.accessToken) {
        const freshSnap = await useSnapshotStore.getState().fetchSnapshot(freshTokens.accessToken)
          .catch(err => console.warn('[Transfer] Post-transfer snapshot (non-fatal):', err));
        if (freshSnap?.accounts) setAccounts(freshSnap.accounts);
      }
    } catch (err: any) {
      console.error('Transfer error:', err);
      setSubmitError(err.message || 'Transfer failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-bybit-bg flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-8">
          {/* Success Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={40} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Wire Transfer Initiated!</h2>
            <p className="text-sm text-gray-400">Your transfer has been submitted for processing via SWIFT GPI network.</p>
          </div>

          {/* Receipt */}
          <div className="bg-bybit-elevated/50 rounded-xl border border-bybit-border overflow-hidden mb-6">
            <div className="bg-gradient-to-r from-bybit-yellow/10 to-amber-500/10 p-4 border-b border-bybit-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-mono">UZU DIGITAL UNION</p>
                  <p className="text-[10px] text-gray-600">Wire Transfer Receipt</p>
                </div>
                <FileText size={24} className="text-bybit-yellow" />
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Receipt #</span><span className="text-white font-mono text-xs">{receiptRef}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Date</span><span className="text-white">{new Date().toLocaleString()}</span></div>
              <div className="border-t border-bybit-border my-2" />
              <div className="flex justify-between text-sm"><span className="text-gray-500">Amount Sent</span><span className="text-white font-bold">{getCurrencySymbol(form.fromCurrency)}{parseFloat(form.amount).toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Amount Received</span><span className="text-emerald-400 font-bold">{getCurrencySymbol(form.toCurrency)}{parseFloat(estimatedAmount).toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Exchange Rate</span><span className="text-white">1 {form.fromCurrency} = {estimatedRate} {form.toCurrency}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Fee</span><span className="text-white">${fee}</span></div>
              <div className="border-t border-bybit-border my-2" />
              <div className="flex justify-between text-sm"><span className="text-gray-500">Beneficiary</span><span className="text-white font-medium">{form.beneficiaryName}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Bank</span><span className="text-white font-medium text-xs">{form.bankName || form.swift}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">SWIFT</span><span className="text-white font-mono text-xs">{form.swift}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">IBAN</span><span className="text-white font-mono text-xs">{form.iban}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Reference</span><span className="text-white font-mono text-xs">{form.reference || receiptRef}</span></div>
              <div className="border-t border-bybit-border my-2" />
              <div className="flex justify-between text-sm"><span className="text-gray-500">Status</span><Badge variant="confirmed">Processing</Badge></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Network</span><span className="text-white text-xs">SWIFT GPI • ISO 20022</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Est. Settlement</span><span className="text-emerald-400 text-xs">10-30 minutes</span></div>
            </div>
            <div className="p-3 bg-bybit-bg/50 border-t border-bybit-border text-center">
              <p className="text-[8px] text-gray-600 font-mono">Digitally signed • End-to-end encrypted • SWIFT GPI tracked</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => router.push('/dashboard')} className="p-3 rounded-xl bg-bybit-elevated border border-bybit-border text-gray-400 hover:text-bybit-yellow hover:border-bybit-yellow/50 transition-all">
              <ArrowLeft size={18} />
            </button>
            <button onClick={() => { setSuccess(false); setStep(1); setForm({ ...form, amount: '' }); }}
              className="flex-1 px-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-gray-300 font-semibold text-sm hover:border-bybit-yellow/50 transition-all">
              New Transfer
            </button>
            <button onClick={() => router.push('/dashboard')}
              className="flex-1 px-4 py-3 rounded-xl bg-bybit-yellow text-bybit-bg font-semibold text-sm hover:brightness-110 transition-all">
              Dashboard
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bybit-bg">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.push('/dashboard')} className="p-2.5 rounded-xl bg-bybit-elevated border border-bybit-border text-gray-400 hover:text-bybit-yellow hover:border-bybit-yellow/50 transition-all">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Wire Transfer</h1>
            <p className="text-xs text-gray-500">Send money to 200+ countries in 60+ currencies • {getCountryName(user?.countryCode || 'US')} ({userCurrency})</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bybit-elevated/50 border border-bybit-border/60">
            <Globe size={14} className="text-bybit-yellow" />
            <span className="text-[10px] text-gray-400">SWIFT GPI</span>
          </div>
        </div>

        {/* Transfer Paused Warning — from DB snapshot */}
        {transferPaused && (
          <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-300">Transfers Paused</p>
              <p className="text-xs text-red-200/70 mt-1">Your wire transfer capability has been paused by admin. Please contact support for assistance.</p>
            </div>
          </div>
        )}

        {/* Progress Steps */}
        <div className="flex items-center gap-2 mb-6">
          {[
            { n: 1, label: 'Amount & Currency' },
            { n: 2, label: 'Beneficiary' },
            { n: 3, label: 'Review & Confirm' },
          ].map(s => (
            <div key={s.n} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step >= s.n ? 'bg-bybit-yellow text-bybit-bg' : 'bg-bybit-elevated text-gray-500'}`}>
                {step > s.n ? <Check size={14} /> : s.n}
              </div>
              <span className={`text-[10px] hidden sm:block ${step >= s.n ? 'text-bybit-yellow' : 'text-gray-500'}`}>{s.label}</span>
              {s.n < 3 && <div className={`w-8 sm:w-16 h-0.5 ${step > s.n ? 'bg-bybit-yellow' : 'bg-bybit-border'}`} />}
            </div>
          ))}
          {/* Currency Badge */}
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bybit-elevated/50 border border-bybit-border/60">
            <Globe size={14} className="text-bybit-yellow" />
            <span className="text-[10px] text-gray-400">{getCurrencySymbol(form.fromCurrency)}{form.fromCurrency} → {getCurrencySymbol(form.toCurrency)}{form.toCurrency}</span>
          </div>
        </div>

        <Card className="p-6">
          {/* Step 1: Source account, amount, and currency */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-white">Transfer Details</h2>

              {/* From Account — Professional Selection */}
              <div className="space-y-3">
                <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">From Account</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setSelectedAccountType('checking')}
                    className={`p-4 rounded-xl border text-left transition-all ${selectedAccountType === 'checking' ? 'bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/30' : 'bg-bybit-elevated/50 border-bybit-border hover:border-blue-500/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400"><Wallet size={14} /></div>
                      <div>
                        <p className="text-sm font-semibold text-white">Checking</p>
                        <p className="text-[9px] text-gray-500 font-mono">{ibanFull(primaryChecking?.accountNumber || '')}</p>
                      </div>
                      {selectedAccountType === 'checking' && <Check size={14} className="text-blue-400 ml-auto" />}
                    </div>
                    <p className="text-sm font-bold text-white">{formatAmount(Number(primaryChecking?.balance || 0), primaryChecking?.currency || 'USD')}</p>
                    <p className="text-[9px] text-gray-500">{checkingAccounts.length} {checkingAccounts.length === 1 ? 'currency' : 'currencies'}</p>
                  </button>
                  <button onClick={() => setSelectedAccountType('savings')}
                    className={`p-4 rounded-xl border text-left transition-all ${selectedAccountType === 'savings' ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30' : 'bg-bybit-elevated/50 border-bybit-border hover:border-emerald-500/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400"><PiggyBank size={14} /></div>
                      <div>
                        <p className="text-sm font-semibold text-white">Savings</p>
                        <p className="text-[9px] text-gray-500 font-mono">{ibanFull(primarySavings?.accountNumber || '')}</p>
                      </div>
                      {selectedAccountType === 'savings' && <Check size={14} className="text-emerald-400 ml-auto" />}
                    </div>
                    <p className="text-sm font-bold text-bybit-yellow">{formatAmount(Number(primarySavings?.balance || 0), primarySavings?.currency || 'USD')}</p>
                    <p className="text-[9px] text-gray-500">{savingsAccounts.length} {savingsAccounts.length === 1 ? 'currency' : 'currencies'}</p>
                  </button>
                </div>
              </div>

              {/* Currency Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">From Currency</label>
                  <select value={form.fromCurrency} onChange={e => updateField('fromCurrency', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-white text-sm focus:outline-none focus:border-bybit-yellow">
                    {(selectedAccountType === 'checking' ? checkingAccounts : savingsAccounts).map(acc => (
                      <option key={acc.currency} value={acc.currency}>{getCurrencySymbol(acc.currency)} {acc.currency}</option>
                    ))}
                    {selectedAccountType === 'checking' && checkingAccounts.length === 0 && uniqueCurrencies.slice(0, 5).map(c => (
                      <option key={c.currency} value={c.currency}>{c.flag} {getCurrencySymbol(c.currency)} {c.currency}</option>
                    ))}
                    {selectedAccountType === 'savings' && savingsAccounts.length === 0 && uniqueCurrencies.slice(0, 5).map(c => (
                      <option key={c.currency} value={c.currency}>{c.flag} {getCurrencySymbol(c.currency)} {c.currency}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">To Currency</label>
                  <select value={form.toCurrency} onChange={e => updateField('toCurrency', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-white text-sm focus:outline-none focus:border-bybit-yellow">
                    {uniqueCurrencies.map(c => <option key={c.currency} value={c.currency}>{c.flag} {getCurrencySymbol(c.currency)} {c.currency} — {c.currencyName}</option>)}
                  </select>
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-3">
                <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Amount to Send</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-bybit-yellow/10 border border-bybit-yellow/20 z-10">
                    <span className="text-sm font-bold text-bybit-yellow">{CURRENCY_SYMBOLS[form.fromCurrency]}</span>
                    <span className="text-[10px] font-medium text-gray-400">{form.fromCurrency}</span>
                  </div>
                  <input type="number" value={form.amount} onChange={e => updateField('amount', e.target.value)} placeholder="0.00"
                    className="w-full pl-[5.5rem] pr-4 py-3.5 rounded-xl bg-bybit-elevated border border-bybit-border text-white text-xl font-bold tracking-tight focus:outline-none focus:border-bybit-yellow focus:ring-1 focus:ring-bybit-yellow/20 transition-all placeholder:text-gray-600" />
                </div>
              </div>

              {/* Exchange Rate Preview */}
              {form.amount && parseFloat(form.amount) > 0 && (
                <div className="p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Exchange Rate</span><span className="text-white font-mono">1 {form.fromCurrency} = {estimatedRate} {form.toCurrency}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">You Receive</span><span className="text-emerald-400 font-bold">{CURRENCY_SYMBOLS[form.toCurrency]}{parseFloat(estimatedAmount).toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Transfer Fee (0.1%)</span><span className="text-white">{getCurrencySymbol(form.fromCurrency)}{fee}</span></div>
                  <div className="flex justify-between text-sm pt-2 border-t border-bybit-border"><span className="text-gray-500">Total Debit</span><span className="text-white font-bold">{getCurrencySymbol(form.fromCurrency)}{(parseFloat(form.amount) + parseFloat(fee)).toLocaleString()}</span></div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2">
                <Info size={14} className="text-blue-400 mt-0.5 shrink-0" />
                <p className="text-[10px] text-blue-300">SWIFT GPI transfers typically settle within 10-30 minutes. Rates are locked for 30 seconds during your transaction.</p>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => router.push('/dashboard')} className="p-3 rounded-xl bg-bybit-elevated border border-bybit-border text-gray-400 hover:text-bybit-yellow hover:border-bybit-yellow/50 transition-all">
                  <ArrowLeft size={18} />
                </button>
                <button onClick={() => setStep(2)} disabled={!form.amount || parseFloat(form.amount) <= 0 || !hasSufficientFunds}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-bybit-yellow text-bybit-bg font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-bybit-glow">
                  Continue to Beneficiary <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Beneficiary details */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-white">Beneficiary Details</h2>

              <div className="space-y-3">
                <label className="text-xs text-gray-400 uppercase tracking-wider">Beneficiary Full Name</label>
                <input type="text" value={form.beneficiaryName} onChange={e => updateField('beneficiaryName', e.target.value)} placeholder="Full legal name as it appears on bank account"
                  className="w-full px-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-white text-sm focus:outline-none focus:border-bybit-yellow" />
              </div>
              <div className="space-y-3">
                <label className="text-xs text-gray-400 uppercase tracking-wider">Beneficiary Address</label>
                <input type="text" value={form.beneficiaryAddress} onChange={e => updateField('beneficiaryAddress', e.target.value)} placeholder="Street, City, Country"
                  className="w-full px-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-white text-sm focus:outline-none focus:border-bybit-yellow" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-xs text-gray-400 uppercase tracking-wider">IBAN</label>
                  <input type="text" value={form.iban} onChange={e => updateField('iban', e.target.value)} placeholder="GB33BUKB20201555555555"
                    className="w-full px-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-white text-sm font-mono focus:outline-none focus:border-bybit-yellow" />
                </div>
                <div className="space-y-3">
                  <label className="text-xs text-gray-400 uppercase tracking-wider">SWIFT / BIC Code</label>
                  <input type="text" value={form.swift} onChange={e => updateField('swift', e.target.value)} placeholder="BARCGB22"
                    className="w-full px-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-white text-sm font-mono focus:outline-none focus:border-bybit-yellow" />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-xs text-gray-400 uppercase tracking-wider">Destination Bank Name</label>
                <input type="text" value={form.bankName} onChange={e => updateField('bankName', e.target.value)} placeholder="Bank name"
                  className="w-full px-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-white text-sm focus:outline-none focus:border-bybit-yellow" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-xs text-gray-400 uppercase tracking-wider">Reference (Optional)</label>
                  <input type="text" value={form.reference} onChange={e => updateField('reference', e.target.value)} placeholder="Invoice #"
                    className="w-full px-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-white text-sm focus:outline-none focus:border-bybit-yellow" />
                </div>
                <div className="space-y-3">
                  <label className="text-xs text-gray-400 uppercase tracking-wider">Purpose (Optional)</label>
                  <input type="text" value={form.purpose} onChange={e => updateField('purpose', e.target.value)} placeholder="Payment purpose"
                    className="w-full px-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-white text-sm focus:outline-none focus:border-bybit-yellow" />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 px-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-gray-300 font-semibold text-sm hover:border-bybit-yellow/50 transition-all">Back to Amount</button>
                <button onClick={() => setStep(3)} disabled={!form.beneficiaryName || !form.iban || !form.swift}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-bybit-yellow text-bybit-bg font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-bybit-glow">
                  Review Transfer <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Confirm */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-white">Review & Confirm Wire Transfer</h2>

              <div className="bg-gradient-to-br from-bybit-yellow/5 to-amber-500/5 rounded-xl p-5 border border-bybit-yellow/20">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-gray-400">You Send</p>
                    <p className="text-2xl font-bold text-white">{formatAmount(parseFloat(form.amount), form.fromCurrency)}</p>
                  </div>
                  <ArrowRight size={24} className="text-bybit-yellow" />
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Recipient Receives</p>
                    <p className="text-2xl font-bold text-emerald-400">{formatAmount(parseFloat(estimatedAmount), form.toCurrency)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                  <div className="p-2 rounded-lg bg-bybit-bg/50"><span className="text-gray-500">Rate</span><p className="text-white font-semibold">1 {form.fromCurrency} = {estimatedRate.toFixed(4)} {form.toCurrency}</p></div>
                  <div className="p-2 rounded-lg bg-bybit-bg/50"><span className="text-gray-500">Fee</span><p className="text-white font-semibold">{formatAmount(Number(fee), form.fromCurrency)}</p></div>
                  <div className="p-2 rounded-lg bg-bybit-bg/50"><span className="text-gray-500">Delivery</span><p className="text-emerald-400 font-semibold">10-30 min</p></div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white">Beneficiary</h3>
                <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                  <p className="text-sm font-semibold text-white">{form.beneficiaryName}</p>
                  <p className="text-xs text-gray-400 mt-1">{form.beneficiaryAddress || 'Address not provided'}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="text-[10px] font-mono text-gray-400 bg-bybit-bg/50 px-2 py-0.5 rounded">{form.iban}</code>
                    <code className="text-[10px] font-mono text-gray-400 bg-bybit-bg/50 px-2 py-0.5 rounded">{form.swift}</code>
                  </div>
                  {form.bankName && (
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gray-500">
                      <Building2 size={12} className="text-bybit-yellow" />
                      <span>{form.bankName}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                <p className="text-[10px] text-amber-300">Please verify all details carefully. SWIFT transfers cannot be reversed once initiated. Ensure the beneficiary IBAN and SWIFT code are correct.</p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => router.push('/dashboard')} className="p-3 rounded-xl bg-bybit-elevated border border-bybit-border text-gray-400 hover:text-bybit-yellow hover:border-bybit-yellow/50 transition-all">
                  <ArrowLeft size={18} />
                </button>
                <button onClick={() => setStep(2)} className="flex-1 px-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-gray-300 font-semibold text-sm hover:border-bybit-yellow/50 transition-all">Edit Beneficiary</button>
                <button onClick={handleSubmit} disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-bybit-yellow text-bybit-bg font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 shadow-bybit-glow">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : <><Send size={16} /> Confirm & Send Wire</>}
                </button>
              </div>
            </div>
          )}

          {step === 3 && submitError && (
            <div role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{submitError}</div>
          )}
        </Card>

        {/* Trust Footer */}
        <div className="mt-4 p-3 rounded-xl bg-bybit-elevated/30 border border-bybit-border">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-2 text-gray-500">
              <Shield size={12} className="text-emerald-400" />
              <span>End-to-end encrypted • ISO 20022 compliant</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <HelpCircle size={12} className="text-bybit-yellow" />
              <span>24/7 Support</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}