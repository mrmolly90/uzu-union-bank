'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/store/auth';
import { useRatesStore } from '@/store/rates';
import { useSnapshotStore } from '@/store/snapshot';
import { COUNTRIES, CURRENCY_SYMBOLS, getCountryName, getCurrencyByCountryCode, formatLocalAmount, getCountryLocale, isEuropeanCountry } from '@/lib/countries';
import { formatIbanDisplay as ibanFull, formatIbanShort as ibanShort, convertCurrency, formatConvertedAmount } from '@/lib/format';
import type { AccountBalance, TransactionRecord } from '@/types';
import {
  ArrowUpRight, ArrowDownLeft, Send, Download, Plus,
  Wallet, PiggyBank, TrendingUp, CreditCard,
  Bell, Settings, LogOut, Menu, X, Eye, EyeOff,
  LayoutDashboard, ArrowLeftRight, Clock, FileText,
  AlertTriangle, User, HelpCircle, ChevronRight,
  DollarSign, BarChart3, Shield, Smartphone, Lock,
  Fingerprint, FileCheck, Globe, Bitcoin, RefreshCw,
  Copy, Check, ExternalLink, History,
  Building2, Banknote, Percent, ArrowRight,
  Search, Filter, ChevronDown, Star, Gift,
  Phone, Mail, MessageCircle, MapPin, Receipt,
  Home, CreditCard as CreditCardIcon, BookOpen,
  Briefcase, TrendingUp as TrendingUpIcon,
  Sparkles, Zap, Activity, ArrowLeft, Info, CheckCircle2, AlertCircle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AccountStatement {
  id: string; period: string; generated: string; type: 'monthly' | 'quarterly' | 'annual'; size: string; url: string;
}

interface Notification {
  id: string; title: string; message: string; type: string; read: boolean; createdAt: string;
}

// ─── Real Crypto Market Data ────────────────────────────────────────────────

interface CryptoAsset {
  id: string;
  name: string;
  symbol: string;
  price: number;
  currency: string;
  change24h: number;
  marketCap: number;
  volume24h: number;
}

const accountStatements: AccountStatement[] = [
  { id: '1', period: 'October 2026', generated: 'Nov 1, 2026', type: 'monthly', size: '2.4 MB', url: '#' },
  { id: '2', period: 'September 2026', generated: 'Oct 1, 2026', type: 'monthly', size: '2.1 MB', url: '#' },
  { id: '3', period: 'Q3 2026', generated: 'Oct 1, 2026', type: 'quarterly', size: '6.8 MB', url: '#' },
  { id: '4', period: 'August 2026', generated: 'Sep 1, 2026', type: 'monthly', size: '1.9 MB', url: '#' },
  { id: '5', period: 'July 2026', generated: 'Aug 1, 2026', type: 'monthly', size: '2.3 MB', url: '#' },
  { id: '6', period: 'FY 2025', generated: 'Jan 15, 2026', type: 'annual', size: '18.2 MB', url: '#' },
];

// ─── Sidebar Items ──────────────────────────────────────────────────────────

const sidebarItems = [
  { icon: LayoutDashboard, label: 'Dashboard', desc: 'Account overview & balances' },
  { icon: Wallet, label: 'Accounts', desc: 'Checking, Savings & Multi-currency' },
  { icon: Eye, label: 'Balances', desc: 'Verify checking & savings balances' },
  { icon: ArrowLeftRight, label: 'Domestic Transfer', desc: 'Between checking & savings', modal: 'DomesticTransfer' },
  { icon: Send, label: 'Wire Transfer', desc: 'International SWIFT transfers', action: 'navigate', path: '/transfer' },
  { icon: Bitcoin, label: 'Crypto Wallet', desc: 'Digital asset portfolio' },
  { icon: Clock, label: 'History', desc: 'Transaction history & receipts' },
  { icon: FileText, label: 'Statements', desc: 'Account statements & reports' },
  { icon: BarChart3, label: 'Exchange Rates', desc: 'Live FX rates (60+ currencies)' },
  { icon: AlertTriangle, label: 'Report Issues', desc: 'Contact support team' },
  { icon: Settings, label: 'Settings', desc: 'Account & currency preferences' },
];

const countryCurrencyInfo = COUNTRIES.map(c => ({ ...c, symbol: CURRENCY_SYMBOLS[c.currency] || '$' }));

// ─── Main Dashboard ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, hydrated, clearAuth } = useAuthStore();
  const { rates, setRates } = useRatesStore();
  const snapshot = useSnapshotStore(s => s.snapshot);
  const lastFetched = useSnapshotStore(s => s.lastFetched);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // UI State
  const [activeSidebar, setActiveSidebar] = useState('Dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [activeAccount, setActiveAccount] = useState<string>(() => {
    // Read user from store at mount time — will be updated on hydration
    const { user } = useAuthStore.getState();
    return user ? getCurrencyByCountryCode(user.countryCode) : 'USD';
  });

  // Keep activeAccount in sync with hydrated user's home currency (prevents USD flash)
  useEffect(() => {
    if (hydrated && user) {
      const home = getCurrencyByCountryCode(user.countryCode);
      setActiveAccount(prev => {
        // Only update if current value is the stale USD default or doesn't match user's country
        return (prev === 'USD' && home !== 'USD') || prev !== home ? home : prev;
      });
    }
  }, [hydrated, user]);
  const [copied, setCopied] = useState<string | null>(null);

  // Data State
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cryptoAddresses, setCryptoAddresses] = useState<any[]>([]);
  const [cryptoAssets, setCryptoAssets] = useState<CryptoAsset[]>([]);
  const [cryptoPricesLoading, setCryptoPricesLoading] = useState(false);
  const [cryptoPricesError, setCryptoPricesError] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<TransactionRecord | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AccountBalance | null>(null);
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoAsset | null>(null);
  const [selectedAccountType, setSelectedAccountType] = useState<'checking' | 'savings'>('checking');
  const [domesticFrom, setDomesticFrom] = useState<'checking' | 'savings'>('checking');
  const [domesticAmount, setDomesticAmount] = useState('');
  const [domesticLoading, setDomesticLoading] = useState(false);
  const [domesticSuccess, setDomesticSuccess] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>(user?.countryCode || 'US');
  const [countrySearch, setCountrySearch] = useState('');
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [receiptTx, setReceiptTx] = useState<TransactionRecord | null>(null);

  // Crypto Deposit State
  const [cryptoDepositStep, setCryptoDepositStep] = useState<'address' | 'complete' | 'receipt'>('address');
  const [cryptoDepositAmount, setCryptoDepositAmount] = useState('');
  const [cryptoDepositTxHash, setCryptoDepositTxHash] = useState('');
  const [cryptoDepositLoading, setCryptoDepositLoading] = useState(false);
  const [cryptoDepositError, setCryptoDepositError] = useState('');
  const [cryptoDepositReceipt, setCryptoDepositReceipt] = useState<any>(null);
  const [cryptoDeposits, setCryptoDeposits] = useState<any[]>([]);

  // ─── Fetch Data ───────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const { tokens } = useAuthStore.getState();
      if (!tokens?.accessToken) return;
      const headers = { Authorization: `Bearer ${tokens.accessToken}` };

      // Fetch DB snapshot — this is the PRIMARY source of truth for balances.
      // Falls back to /api/accounts if snapshot is unavailable.
      const snapshotResult = await useSnapshotStore.getState().fetchSnapshot(tokens.accessToken)
        .catch(err => { console.warn('[Dashboard] Snapshot fetch (non-fatal):', err); return null; });

      // Use snapshot accounts as primary source, fallback to API
      if (snapshotResult?.accounts) {
        setAccounts(snapshotResult.accounts);
        const countryCurrency = getCurrencyByCountryCode(user?.countryCode || 'US');
        const matchingAccount = snapshotResult.accounts.find((a: any) => a.currency === countryCurrency);
        if (matchingAccount) setActiveAccount(countryCurrency);
        else if (snapshotResult.accounts.length > 0) setActiveAccount(snapshotResult.accounts[0].currency);
      }

      // Fetch other data in parallel
      const [accountsRes, txRes, ratesRes, notifRes, cryptoRes] = await Promise.all([
        fetch('/api/accounts', { headers }),
        fetch('/api/transactions', { headers }),
        fetch('/api/rates'),
        fetch('/api/notifications', { headers }),
        fetch('/api/crypto/addresses'),
      ]);

      // Fallback: if snapshot failed, use API accounts
      if (!snapshotResult?.accounts && accountsRes.ok) {
        const data = await accountsRes.json();
        setAccounts(data);
        const countryCurrency = getCurrencyByCountryCode(user?.countryCode || 'US');
        const matchingAccount = data.find((a: any) => a.currency === countryCurrency);
        if (matchingAccount) setActiveAccount(countryCurrency);
        else if (data.length > 0) setActiveAccount(data[0].currency);
      }

      if (txRes.ok) { const data = await txRes.json(); setTransactions(data); }
      if (ratesRes.ok) { const data = await ratesRes.json(); setRates(data); }
      if (notifRes.ok) { const data = await notifRes.json(); setNotifications(data); setUnreadCount(data.filter((n: any) => !n.read).length); }
      if (cryptoRes.ok) { const data = await cryptoRes.json(); setCryptoAddresses(data); }
    } catch (err) { console.error('Fetch error:', err); }
    finally { setLoading(false); }
  }, [setRates]); // <-- intentionally excludes activeAccount to avoid infinite loop with setActiveAccount inside

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    const fetchCryptoPrices = async () => {
      setCryptoPricesLoading(true);
      try {
        const response = await fetch(`/api/crypto/market?currency=${encodeURIComponent(activeAccount)}`);
        if (!response.ok) throw new Error('Market quotes are temporarily unavailable.');
        const data = await response.json();
        if (!cancelled) {
          setCryptoAssets(data);
          setCryptoPricesError('');
        }
      } catch {
        if (!cancelled) {
          setCryptoAssets([]);
          setCryptoPricesError('Live market quotes are temporarily unavailable.');
        }
      } finally {
        if (!cancelled) setCryptoPricesLoading(false);
      }
    };

    fetchCryptoPrices();
    const interval = setInterval(fetchCryptoPrices, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeAccount, mounted]);

  useEffect(() => {
    if (!hydrated) return; // Wait for Zustand to hydrate from localStorage
    if (!isAuthenticated) { router.push('/login'); return; }
    fetchData();
    // Auto-refresh snapshot every 30s so funding/debit reflects instantly
    const interval = setInterval(() => {
      const { tokens } = useAuthStore.getState();
      if (tokens?.accessToken) {
        useSnapshotStore.getState().fetchSnapshot(tokens.accessToken).catch(() => {});
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, hydrated, router, fetchData]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  // User's home currency from their country code — only after hydration
  const homeCurrency = hydrated && user ? getCurrencyByCountryCode(user.countryCode) : (user ? getCurrencyByCountryCode(user.countryCode) : 'USD');

  // Find the user's home currency accounts — prefer home currency, fallback to any
  // Use accountType field exclusively (new accounts have plain 16-digit numbers)
  const findHomeAccount = (type: string) => {
    const byType = accounts.filter(a => a.accountType === type);
    // Prefer the account in the user's home currency
    const home = byType.find(a => a.currency === homeCurrency);
    return home || byType[0] || null;
  };
  const primaryChecking = findHomeAccount('CHECKING');
  const primarySavings = findHomeAccount('SAVINGS');
  const checkingAccounts = primaryChecking ? [primaryChecking] : [];
  const savingsAccounts = primarySavings ? [primarySavings] : [];

  // Total portfolio in user's home currency
  const totalBalance = accounts.reduce((s, a) => s + convertCurrency(Number(a.balance), a.currency, homeCurrency), 0);
  const totalChecking = primaryChecking ? Number(primaryChecking.balance) : 0;
  const totalSavings = primarySavings ? Number(primarySavings.balance) : 0;

  // Show loading state until hydration + accounts are ready — prevents USD flash
  const ready = hydrated && !loading && accounts.length > 0;

  const filteredTransactions = showAllTransactions ? transactions : transactions.slice(0, 6);

  const getCurrencySymbol = (currency: string) => CURRENCY_SYMBOLS[currency] || '$';
  const formatAmount = (amount: number, currency: string) => {
    const locale = getCountryLocale(user?.countryCode || 'US');
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    } catch {
      return `${getCurrencySymbol(currency)}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  };
  const formatMarketValue = (amount: number, currency: string) => {
    if (!Number.isFinite(amount) || amount <= 0) return '—';
    try {
      return new Intl.NumberFormat(getCountryLocale(user?.countryCode || 'US'), {
        style: 'currency', currency, notation: 'compact', maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${getCurrencySymbol(currency)}${amount.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })}`;
    }
  };
  const formatConverted = (amount: number, fromCurrency: string) => formatConvertedAmount(amount, fromCurrency, homeCurrency);

  // IBAN boxes show exactly 16 digits for BOTH checking and savings.
  const maskAccount = (num: string) => ibanShort(num);
  const formatIbanDisplay = (num: string) => ibanFull(num);
  const formatIbanShort = (num: string) => ibanShort(num);

  // Crypto logo SVGs as inline components — all coins from CoinGecko market
  const CryptoLogo = ({ symbol, size = 32 }: { symbol: string; size?: number }) => {
    const logos: Record<string, JSX.Element> = {
      BTC: (
        <svg viewBox="0 0 32 32" width={size} height={size}>
          <circle cx="16" cy="16" r="16" fill="#F7931A"/>
          <path d="M22.5 16.5c.3-2-.8-3.2-2.2-3.9l.5-1.8-1.3-.3-.4 1.6c-.3-.1-.7-.2-1-.3l.4-1.6-1.3-.3-.5 1.8c-.3-.1-.6-.1-.9-.2l.5-1.8-1.3-.3-.5 1.8-1.1-.3-1.8-.5-.3 1.2 1 .3c.5.1.7.4.6.7l-.6 2.4c0 .1.1.1.1.1l-.1-.1-.9 3.5c-.1.2-.3.3-.7.2l-1-.3-.5 1.4 1.8.5 1.1.3.5 2 .3 1.3 1.3.3.5-1.8c.4.1.7.2 1 .3l-.5 1.8 1.3.3.5-1.8c2 .4 3.5.2 4.1-1.6.5-1.5 0-2.4-1-3 .7-.2 1.2-.6 1.4-1.4zm-2.5 3.5c-.4 1.4-2.8.6-3.6.5l.6-2.6c.8.2 3.4.6 3 2.1zm.4-3.8c-.3 1.3-2.4.6-3 .5l.5-2.3c.6.1 2.8.4 2.5 1.8z" fill="white"/>
        </svg>
      ),
      ETH: (
        <svg viewBox="0 0 32 32" width={size} height={size}>
          <circle cx="16" cy="16" r="16" fill="#627EEA"/>
          <path d="M16 4l-.1.4v11.5l.1.1 6.5-3.8L16 4z" fill="white" opacity="0.8"/>
          <path d="M16 4l-6.5 8.2L16 16V4z" fill="white"/>
          <path d="M16 21.5l.1.1v6.3L22.5 18 16 21.5z" fill="white" opacity="0.8"/>
          <path d="M16 27.9v-6.4L9.5 18 16 27.9z" fill="white"/>
          <path d="M16 20l6.5-3.8L16 16v4z" fill="white" opacity="0.6"/>
          <path d="M9.5 16.2L16 20v-4l-6.5-1.8v2z" fill="white" opacity="0.6"/>
        </svg>
      ),
      USDC: (
        <svg viewBox="0 0 32 32" width={size} height={size}>
          <circle cx="16" cy="16" r="16" fill="#2775CA"/>
          <path d="M16 4C9.4 4 4 9.4 4 16s5.4 12 12 12 12-5.4 12-12S22.6 4 16 4zm3.5 17.5c-.5.5-1.2.7-2 .7h-1v2h-1.5v-2h-3v-1.5h5c.5 0 .9-.2 1.2-.5.3-.3.5-.7.5-1.2s-.2-.9-.5-1.2c-.3-.3-.7-.5-1.2-.5h-2c-1.1 0-2-.4-2.7-1.1-.7-.7-1.1-1.6-1.1-2.7s.4-2 1.1-2.7c.7-.7 1.6-1.1 2.7-1.1h1v-2h1.5v2h3v1.5h-5c-.5 0-.9.2-1.2.5-.3.3-.5.7-.5 1.2s.2.9.5 1.2c.3.3.7.5 1.2.5h2c1.1 0 2 .4 2.7 1.1.7.7 1.1 1.6 1.1 2.7s-.4 2-1.1 2.7z" fill="white"/>
        </svg>
      ),
      USDT: (
        <svg viewBox="0 0 32 32" width={size} height={size}>
          <circle cx="16" cy="16" r="16" fill="#26A17B"/>
          <path d="M17.9 17.6c-.1.1-.5.1-1.9.1-1.4 0-1.8 0-1.9-.1-3.7-.2-6.5-.9-6.5-1.8s2.8-1.6 6.5-1.8v2.9c.1.1.5.1 1.9.1 1.4 0 1.8 0 1.9-.1v-2.9c3.7.2 6.5.9 6.5 1.8s-2.8 1.6-6.5 1.8zm0-4.7v-2.6h5.1V7.5H9v2.8h5.1v2.6c-4.1.2-7.2 1.1-7.2 2.1s3.1 1.9 7.2 2.1v7.5h2.8v-7.5c4.1-.2 7.2-1.1 7.2-2.1s-3.1-1.9-7.2-2.1z" fill="white"/>
        </svg>
      ),
      SOL: (
        <svg viewBox="0 0 32 32" width={size} height={size}>
          <circle cx="16" cy="16" r="16" fill="url(#solGradient)"/>
          <defs>
            <linearGradient id="solGradient" x1="0" y1="0" x2="32" y2="32">
              <stop offset="0%" stopColor="#9945FF"/>
              <stop offset="100%" stopColor="#14F195"/>
            </linearGradient>
          </defs>
          <path d="M10.5 20.5c.2-.2.5-.4.8-.4h11.4c.5 0 .7.6.4.9l-2.6 2.6c-.2.2-.5.4-.8.4H8.3c-.5 0-.7-.6-.4-.9l2.6-2.6zm0-12.6c.2-.2.5-.4.8-.4h11.4c.5 0 .7.6.4.9l-2.6 2.6c-.2.2-.5.4-.8.4H8.3c-.5 0-.7-.6-.4-.9l2.6-2.6zm-2.2 6.3c.2-.2.5-.4.8-.4h11.4c.5 0 .7.6.4.9l-2.6 2.6c-.2.2-.5.4-.8.4H6.1c-.5 0-.7-.6-.4-.9l2.6-2.6z" fill="white"/>
        </svg>
      ),
      BNB: (
        <svg viewBox="0 0 32 32" width={size} height={size}>
          <circle cx="16" cy="16" r="16" fill="#F0B90B"/>
          <path d="M16 4l4 4-4 4-4-4 4-4zm8 8l4 4-4 4-4-4 4-4zm-16 0l4 4-4 4-4-4 4-4zm8 8l4 4-4 4-4-4 4-4zm-4-4l4-4 4 4-4 4-4-4z" fill="white"/>
        </svg>
      ),
      XRP: (
        <svg viewBox="0 0 32 32" width={size} height={size}>
          <circle cx="16" cy="16" r="16" fill="#23292F"/>
          <path d="M8 10h4l6 8 6-8h4l-8 10.5L8 10z" fill="white"/>
        </svg>
      ),
      ADA: (
        <svg viewBox="0 0 32 32" width={size} height={size}>
          <circle cx="16" cy="16" r="16" fill="#0033AD"/>
          <path d="M16 4l2 4-2 4-2-4 2-4zm0 16l2 4-2 4-2-4 2-4zm-8-8l2 4-2 4-2-4 2-4zm16 0l2 4-2 4-2-4 2-4zm-8 0l2 4-2 4-2-4 2-4z" fill="white" opacity="0.8"/>
        </svg>
      ),
      DOGE: (
        <svg viewBox="0 0 32 32" width={size} height={size}>
          <circle cx="16" cy="16" r="16" fill="#C2A633"/>
          <path d="M12 8h5c3 0 6 2 6 6s-3 6-6 6h-5V8zm2 2v8h3c2 0 4-2 4-4s-2-4-4-4h-3z" fill="white"/>
        </svg>
      ),
      DOT: (
        <svg viewBox="0 0 32 32" width={size} height={size}>
          <circle cx="16" cy="16" r="16" fill="#E6007A"/>
          <circle cx="16" cy="8" r="3" fill="white"/>
          <circle cx="24" cy="20" r="3" fill="white"/>
          <circle cx="8" cy="20" r="3" fill="white"/>
          <path d="M16 11l6 7-3 2-3-5-3 5-3-2 6-7z" fill="white" opacity="0.6"/>
        </svg>
      ),
      AVAX: (
        <svg viewBox="0 0 32 32" width={size} height={size}>
          <circle cx="16" cy="16" r="16" fill="#E84142"/>
          <path d="M16 4l10 20H6L16 4z" fill="white"/>
        </svg>
      ),
      LINK: (
        <svg viewBox="0 0 32 32" width={size} height={size}>
          <circle cx="16" cy="16" r="16" fill="#2A5ADA"/>
          <path d="M16 4l8 5v10l-8 5-8-5V9l8-5zm0 3l-5 3v6l5 3 5-3V10l-5-3z" fill="white"/>
        </svg>
      ),
      UNI: (
        <svg viewBox="0 0 32 32" width={size} height={size}>
          <circle cx="16" cy="16" r="16" fill="#FF007A"/>
          <path d="M16 4c-4 0-8 2-10 6-2 4-2 8 0 12 2 4 6 6 10 6s8-2 10-6c2-4 2-8 0-12-2-4-6-6-10-6zm0 4c2 0 4 1 5 3 1 2 1 4 0 6-1 2-3 3-5 3s-4-1-5-3c-1-2-1-4 0-6 1-2 3-3 5-3z" fill="white"/>
        </svg>
      ),
      MATIC: (
        <svg viewBox="0 0 32 32" width={size} height={size}>
          <circle cx="16" cy="16" r="16" fill="#8247E5"/>
          <path d="M16 4l10 6v12l-10 6-10-6V10l10-6zm0 4l-6 4v8l6 4 6-4v-8l-6-4z" fill="white"/>
        </svg>
      ),
      ATOM: (
        <svg viewBox="0 0 32 32" width={size} height={size}>
          <circle cx="16" cy="16" r="16" fill="#2E3148"/>
          <circle cx="16" cy="16" r="5" fill="none" stroke="white" strokeWidth="2"/>
          <path d="M16 4l4 8-4 8-4-8 4-8z" fill="white" opacity="0.6"/>
          <path d="M4 16l8-4 8 4-8 4-8-4z" fill="white" opacity="0.6"/>
          <path d="M24 16l-8-4-8 4 8 4 8-4z" fill="white" opacity="0.6"/>
        </svg>
      ),
    };
    // For coins without a custom SVG, show a colored circle with the first letter
    if (!logos[symbol]) {
      const colors: Record<string, string> = {
        LTC: '#345D9D', XLM: '#14B4E4', XMR: '#FF6600', EOS: '#4433DD',
        TRX: '#EF0027', XTZ: '#2C7DF7', VET: '#158BFF', FIL: '#0090FF',
        THETA: '#2AB8E6', AAVE: '#B6509E', MKR: '#1AAB9B', COMP: '#00D395',
        SUSHI: '#FA52A0', CRO: '#002D74', NEAR: '#000000', HBAR: '#282828',
        ALGO: '#000000', ICP: '#3B00B9', FET: '#000000', RNDR: '#000000',
        IMX: '#000000', GALA: '#000000', MANA: '#FF2D55', SAND: '#00ACEE',
        AXS: '#000000', FLOW: '#00EF8B', ENJ: '#7866D5', BAT: '#FF5000',
        ZEC: '#F4B728', DASH: '#008CE4', NEO: '#58BF00', MIOTA: '#242424',
        WAVES: '#0055FF', ONT: '#32A7BE', QTUM: '#2E9AD0', ZIL: '#49C1BF',
        SC: '#00FF00', ZRX: '#302C2C', LRC: '#000000', YFI: '#006AE3',
        CRV: '#000000', BAL: '#000000', '1INCH': '#000000', CAKE: '#D1884F',
        GRT: '#6747ED', AR: '#222222', CVX: '#000000', FTM: '#1969FF',
        ONE: '#00AEE9', EGLD: '#000000', CELO: '#35D07F', KSM: '#000000',
        BCH: '#8DC351', ETC: '#33FF99',
      };
      const bg = colors[symbol] || '#6366f1';
      return (
        <div className="flex items-center justify-center rounded-full" style={{ width: size, height: size, backgroundColor: bg }}>
          <span className="text-white font-bold" style={{ fontSize: size * 0.4 }}>{symbol.charAt(0)}</span>
        </div>
      );
    }
    return logos[symbol];
  };

  const copyToClipboard = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 2000); } catch {}
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = { SETTLED: 'confirmed', CLEARED: 'confirmed', MULTISIG_PENDING: 'pending', INITIATED: 'pending', HASHED: 'pending', FAILED: 'error' };
    return map[status] || 'default';
  };

  const getCountryFlag = (code: string) => COUNTRIES.find(c => c.code === code)?.flag || '🌐';

  // ─── Domestic Transfer Handler ──────────────────────────────────────────
  const handleDomesticTransfer = async () => {
    if (!domesticAmount || parseFloat(domesticAmount) <= 0) return;
    setDomesticLoading(true);
    setDomesticSuccess('');
    try {
      const { tokens } = useAuthStore.getState();
      if (!tokens?.accessToken) throw new Error('Not authenticated');

      // Use the FULL accounts array (not filtered checkingAccounts/savingsAccounts)
      // to find accounts matching the selected type and home currency
      const homeCurrency = getCurrencyByCountryCode(user?.countryCode || 'US');
      const fromAccounts = accounts.filter(a => a.accountType === (domesticFrom === 'checking' ? 'CHECKING' : 'SAVINGS'));
      const toAccounts = accounts.filter(a => a.accountType === (domesticFrom === 'checking' ? 'SAVINGS' : 'CHECKING'));

      // Find accounts matching user's home currency first
      const sourceAccount = fromAccounts.find(a => a.currency === homeCurrency) || fromAccounts[0];
      const destAccount = toAccounts.find(a => a.currency === homeCurrency) || toAccounts[0];

      if (!sourceAccount || !destAccount) throw new Error('Account not found. Make sure you have both Checking and Savings accounts.');
      if (Number(sourceAccount.balance) < parseFloat(domesticAmount)) throw new Error('Insufficient funds in your ' + (domesticFrom === 'checking' ? 'Checking' : 'Savings') + ' account.');

      const res = await fetch('/api/transactions/domestic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({
          sourceAccountId: sourceAccount.id,
          destinationAccountId: destAccount.id,
          amount: parseFloat(domesticAmount),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Transfer failed');
      }

      const data = await res.json();

      setDomesticSuccess(`Successfully transferred ${getCurrencySymbol(homeCurrency)}${parseFloat(domesticAmount).toLocaleString()} from ${domesticFrom === 'checking' ? 'Checking' : 'Savings'} to ${domesticFrom === 'checking' ? 'Savings' : 'Checking'}`);
      setDomesticAmount('');
      // Use inline snapshot data from mutation response — updates balance in milliseconds
      if (data.snapshot?.accounts) setAccounts(data.snapshot.accounts);
    } catch (err: any) {
      console.error('Domestic transfer error:', err);
      alert(err.message || 'Transfer failed. Please try again.');
    } finally {
      setDomesticLoading(false);
    }
  };

  const markNotificationsRead = async () => {
    const { tokens } = useAuthStore.getState();
    if (!tokens?.accessToken) return;
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.accessToken}` }, body: JSON.stringify({}) });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  // Wait for hydration + data — prevents USD flash on reload
  if (!mounted || !hydrated || loading) {
    return <div className="min-h-screen bg-bybit-bg flex items-center justify-center"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-bybit-bg">
      {/* ═══ Animated Background ═══ */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-grid-yellow opacity-30" />
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-bybit-yellow/3 rounded-full blur-[150px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-500/3 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
        {/* Floating particles */}
        <div className="absolute top-1/3 left-1/3 w-1 h-1 bg-bybit-yellow/20 rounded-full animate-float" />
        <div className="absolute top-2/3 right-1/3 w-1.5 h-1.5 bg-bybit-yellow/15 rounded-full animate-float-delayed" />
        <div className="absolute top-1/2 left-2/3 w-1 h-1 bg-emerald-400/20 rounded-full animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/4 right-1/4 w-2 h-2 bg-bybit-yellow/10 rounded-full animate-float-delayed" />
        {/* Wire transfer animation lines */}
        <svg className="absolute inset-0 w-full h-full opacity-5" viewBox="0 0 1000 800" xmlns="http://www.w3.org/2000/svg">
          <path d="M100,400 Q300,200 500,400 T900,400" stroke="#F7A600" strokeWidth="1" fill="none" className="animate-dash">
            <animate attributeName="stroke-dashoffset" from="2000" to="0" dur="8s" repeatCount="indefinite" />
          </path>
          <path d="M200,600 Q400,400 600,600 T800,300" stroke="#00C853" strokeWidth="0.5" fill="none" className="animate-dash">
            <animate attributeName="stroke-dashoffset" from="2000" to="0" dur="12s" repeatCount="indefinite" />
          </path>
        </svg>
      </div>

      {/* ═══ Sidebar ═══ */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-bybit-surface/95 backdrop-blur-xl border-r border-bybit-border transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-bybit-yellow flex items-center justify-center shadow-bybit-glow">
                <span className="text-bybit-bg font-extrabold text-sm">
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                    <path d="M3 10L12 3L21 10V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V10Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill="#0A0A0B"/>
                  </svg>
                </span>
              </div>
              <div>
                <span className="text-base font-extrabold text-white">UZU <span className="text-bybit-yellow">UNION</span></span>
                <p className="text-[8px] text-gray-600 font-mono">60+ Currencies • SWIFT GPI</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-bybit-yellow hover:bg-bybit-elevated transition-all"><X size={18} /></button>
          </div>

          <nav className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 scrollbar-thin">
            {sidebarItems.map((item) => (
              <button key={item.label} onClick={() => { if ((item as any).action === 'navigate') { router.push((item as any).path); setSidebarOpen(false); return; } setActiveSidebar(item.label); setModalOpen((item as any).modal || item.label); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeSidebar === item.label ? 'bg-bybit-yellow/10 text-bybit-yellow border border-bybit-yellow/30 shadow-bybit-glow' : 'text-gray-400 hover:text-white hover:bg-bybit-elevated'}`}>
                <item.icon size={18} />
                <div className="text-left"><span>{item.label}</span><p className="text-[10px] text-gray-500 font-normal">{item.desc}</p></div>
              </button>
            ))}
          </nav>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-bybit-border space-y-3 bg-bybit-surface/95">
          <button onClick={() => router.push('/profile')} className="flex items-center gap-3 text-sm text-gray-400 hover:text-bybit-yellow transition-colors w-full">
            <User size={18} /> My Profile
          </button>
          <button onClick={() => { clearAuth(); router.push('/'); }} className="flex items-center gap-3 text-sm text-gray-400 hover:text-red-400 transition-colors w-full">
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setSidebarOpen(false)} />}

      {/* ═══ Main Content ═══ */}
      <div className="relative z-10">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-bybit-bg/80 backdrop-blur-xl border-b border-bybit-border">
          <div className="flex items-center justify-between px-4 sm:px-6 h-16">
            <div className="flex items-center gap-4">
              <button className="p-2 rounded-xl text-gray-400 hover:text-bybit-yellow hover:bg-bybit-elevated transition-all" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold text-white">{activeSidebar}</h1>
                {/* DB Snapshot Verification Badge — shows live DB state is current */}
                {snapshot && (
                  <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20" title={`DB verified at ${lastFetched ? new Date(lastFetched).toLocaleTimeString() : 'N/A'}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] text-emerald-300 font-mono">DB Synced</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Notifications */}
              <div className="relative">
                <button onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markNotificationsRead(); }} className="p-2 rounded-xl bg-bybit-surface border border-bybit-border text-gray-400 hover:text-bybit-yellow transition-colors relative">
                  <Bell size={18} />
                  {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-bybit-yellow text-bybit-bg text-[8px] font-bold flex items-center justify-center animate-pulse">{unreadCount}</span>}
                </button>
                {showNotifications && (
                  <>
                    {/* Mobile overlay backdrop */}
                    <div className="fixed inset-0 bg-black/60 z-40 sm:hidden" onClick={() => setShowNotifications(false)} />
                    {/* Notification panel — full-width bottom sheet on mobile, dropdown on desktop */}
                    <div className="fixed bottom-0 left-0 right-0 sm:absolute sm:right-0 sm:top-12 sm:left-auto sm:w-80 bg-bybit-surface border-t sm:border border-bybit-border rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden z-50 max-h-[70vh] sm:max-h-none">
                      <div className="p-3 border-b border-bybit-border flex items-center justify-between sticky top-0 bg-bybit-surface z-10">
                        <span className="text-xs font-semibold text-white">Notifications</span>
                        <button onClick={() => setShowNotifications(false)} className="text-gray-500 hover:text-white"><X size={14} /></button>
                      </div>
                      <div className="overflow-y-auto max-h-[calc(70vh-48px)] sm:max-h-72">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-xs text-gray-500">No notifications yet</div>
                        ) : notifications.slice(0, 10).map(n => (
                          <div key={n.id} className={`p-3 border-b border-bybit-border/50 ${n.read ? '' : 'bg-bybit-yellow/5'}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-white">{n.title}</span>
                              <span className={`text-[8px] px-1.5 py-0.5 rounded ${n.type === 'CREDIT' ? 'bg-emerald-500/10 text-emerald-400' : n.type === 'DEBIT' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>{n.type}</span>
                            </div>
                            <p className="text-[10px] text-gray-400">{n.message}</p>
                            <p className="text-[8px] text-gray-600 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => { setModalOpen('Settings'); setActiveSidebar('Settings'); }} className="p-2 rounded-xl bg-bybit-surface border border-bybit-border text-gray-400 hover:text-bybit-yellow transition-colors"><Settings size={18} /></button>
              <div className="flex items-center gap-3 pl-3 border-l border-bybit-border">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-medium text-white">{user?.fullName || 'User'}</p>
                  <p className="text-[10px] text-gray-500">{getCountryFlag(user?.countryCode || 'US')} {getCountryName(user?.countryCode || 'US')} • {getCurrencySymbol(activeAccount)}{activeAccount}</p>
                </div>
                {/* Account Balances Button — shows checking & savings */}
                <button
                  onClick={() => { setModalOpen('Balances'); setActiveSidebar('Balances'); }}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bybit-surface border border-bybit-border hover:border-bybit-yellow/50 transition-all group"
                  title="View Balances"
                >
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10">
                      <Wallet size={10} className="text-blue-400" />
                      <span className="text-blue-300 font-semibold">{getCurrencySymbol(primaryChecking?.currency || homeCurrency)}{totalChecking.toLocaleString('en-US', {minimumFractionDigits:0})}</span>
                    </div>
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10">
                      <PiggyBank size={10} className="text-emerald-400" />
                      <span className="text-emerald-300 font-semibold">{getCurrencySymbol(primarySavings?.currency || homeCurrency)}{totalSavings.toLocaleString('en-US', {minimumFractionDigits:0})}</span>
                    </div>
                  </div>
                </button>
                <button onClick={() => router.push('/profile')} className="w-9 h-9 rounded-full bg-gradient-to-br from-bybit-yellow to-amber-500 flex items-center justify-center text-bybit-bg text-sm font-bold shadow-bybit-glow cursor-pointer hover:scale-105 transition-transform">
                  {(user?.fullName || 'UZ').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ═══ Dashboard Content ═══ */}
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          {/* ═══ Currency Ticker Bar ═══ */}
          <div className="overflow-hidden mb-2">
            <div className="flex gap-4 animate-scroll-left whitespace-nowrap">
              {[...countryCurrencyInfo, ...countryCurrencyInfo].map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-[10px] text-gray-500 font-mono bg-bybit-bg/50 px-2 py-1 rounded-full border border-bybit-border/50">
                  <span>{c.flag}</span>
                  <span>{c.currency}</span>
                  <span className="text-gray-600">{c.symbol}</span>
                </span>
              ))}
            </div>
          </div>

          {/* ═══ Total Balance — Professional with Checking & Savings Breakdown ═══ */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-bybit-surface via-bybit-surface to-bybit-yellow/5 border border-bybit-border/60 p-4 sm:p-6">
            <div className="absolute top-0 right-0 w-48 h-48 bg-bybit-yellow/5 rounded-full blur-[80px]" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-bybit-yellow to-amber-500 flex items-center justify-center shadow-bybit-glow">
                    <Wallet size={18} className="text-bybit-bg" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total Balance</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl sm:text-3xl font-extrabold text-white">
                        {showBalance ? formatAmount(totalBalance, homeCurrency) : '••••••'}
                      </span>
                      <button onClick={() => setShowBalance(!showBalance)} className="p-1 rounded-lg text-gray-500 hover:text-bybit-yellow hover:bg-bybit-elevated transition-all">
                        {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <p className="text-[9px] text-gray-600 mt-0.5">
                      {getCountryFlag(user?.countryCode || 'US')} {getCountryName(user?.countryCode || 'US')} • {getCurrencySymbol(homeCurrency)}{homeCurrency}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 border-t border-bybit-border/60 pt-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                    <Wallet size={12} className="text-blue-400" /> Checking
                    <span className="text-gray-700">·</span>
                    <span>{checkingAccounts.length} account{checkingAccounts.length !== 1 ? 's' : ''}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-semibold text-white">
                    {showBalance ? formatAmount(totalChecking, homeCurrency) : '••••••'}
                  </p>
                </div>
                <div className="h-8 w-px bg-bybit-border/60" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                    <PiggyBank size={12} className="text-emerald-400" /> Savings
                    <span className="text-gray-700">·</span>
                    <span>{savingsAccounts.length} account{savingsAccounts.length !== 1 ? 's' : ''}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-semibold text-emerald-300">
                    {showBalance ? formatAmount(totalSavings, homeCurrency) : '••••••'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Account Balances — Checking & Savings ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Checking Account — Professional Bank Card */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-bybit-surface to-blue-900/20 rounded-2xl border border-blue-500/20 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-400/5 rounded-full blur-[40px]" />
                <svg className="absolute inset-0 w-full h-full opacity-5" viewBox="0 0 400 200">
                  <path d="M0,100 Q100,50 200,100 T400,100" stroke="#3B82F6" strokeWidth="0.5" fill="none">
                    <animate attributeName="stroke-dashoffset" from="1000" to="0" dur="6s" repeatCount="indefinite" />
                  </path>
                </svg>
              </div>
              <div className="relative p-6 sm:p-8">
                {/* Card Header with Logo */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30">
                      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                        <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M2 10h20" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M8 14h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-base font-bold text-white">Checking Account</p>
                      <p className="text-[10px] text-gray-500 font-mono">UZU • Premium Banking</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="confirmed">Active</Badge>
                    <button onClick={() => router.push('/dashboard')} className="p-1.5 rounded-lg bg-bybit-bg/50 border border-bybit-border/50 text-gray-400 hover:text-bybit-yellow hover:border-bybit-yellow/50 transition-all">
                      <ArrowLeft size={14} />
                    </button>
                  </div>
                </div>

{/* Balance — Professional */}
                <div className="mb-4">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Available Balance</p>
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                      {showBalance ? formatAmount(Number(primaryChecking?.balance || 0), primaryChecking?.currency || homeCurrency) : '••••••'}
                    </h2>
                    {primaryChecking?.currency !== activeAccount && (
                      <span className="text-[9px] text-gray-500 font-mono bg-bybit-bg/50 px-2 py-0.5 rounded">
                        {getCurrencySymbol(primaryChecking?.currency || '')}{Number(primaryChecking?.balance || 0).toLocaleString('en-US', {minimumFractionDigits:0})} {primaryChecking?.currency}
                      </span>
                    )}
                  </div>
                </div>

                {/* IBAN Display */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex-1 px-3 py-2 rounded-lg bg-bybit-bg/60 border border-bybit-border/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] text-gray-600 uppercase tracking-wider font-mono">IBAN</span>
                      <button onClick={() => copyToClipboard(primaryChecking?.accountNumber || '', 'chk')} className="p-0.5 rounded text-gray-500 hover:text-bybit-yellow">
                        {copied === 'chk' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                    <p className="text-sm font-mono font-bold text-white tracking-wider mt-0.5">
                      {showBalance ? formatIbanDisplay(primaryChecking?.accountNumber || '') : formatIbanShort(primaryChecking?.accountNumber || '')}
                    </p>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-4 gap-2 text-[10px]">
                  <div className="p-2 rounded-lg bg-bybit-bg/40 border border-bybit-border/30">
                    <span className="text-gray-600">Routing</span>
                    <p className="text-white font-mono mt-0.5 text-[11px]">0210000</p>
                  </div>
                  <div className="p-2 rounded-lg bg-bybit-bg/40 border border-bybit-border/30">
                    <span className="text-gray-600">SWIFT</span>
                    <p className="text-white font-mono mt-0.5 text-[11px]">UZUUS33</p>
                  </div>
                  <div className="p-2 rounded-lg bg-bybit-bg/40 border border-bybit-border/30">
                    <span className="text-gray-600">Type</span>
                    <p className="text-blue-400 font-semibold mt-0.5 text-[11px]">Checking</p>
                  </div>
                  <div className="p-2 rounded-lg bg-bybit-bg/40 border border-bybit-border/30">
                    <span className="text-gray-600">Status</span>
                    <p className="text-emerald-400 font-semibold mt-0.5 text-[11px]">Active</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Savings Account — Professional Bank Card */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 via-bybit-surface to-emerald-900/20 rounded-2xl border border-emerald-500/20 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-400/5 rounded-full blur-[40px]" />
                <svg className="absolute inset-0 w-full h-full opacity-5" viewBox="0 0 400 200">
                  <path d="M0,100 Q100,50 200,100 T400,100" stroke="#00C853" strokeWidth="0.5" fill="none">
                    <animate attributeName="stroke-dashoffset" from="1000" to="0" dur="6s" repeatCount="indefinite" />
                  </path>
                </svg>
              </div>
              <div className="relative p-6 sm:p-8">
                {/* Card Header with Savings Logo */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                        <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                        <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-base font-bold text-white">Savings Account</p>
                      <p className="text-[10px] text-gray-500 font-mono">UZU • Premium Banking</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="confirmed">Active</Badge>
                    <button onClick={() => router.push('/dashboard')} className="p-1.5 rounded-lg bg-bybit-bg/50 border border-bybit-border/50 text-gray-400 hover:text-bybit-yellow hover:border-bybit-yellow/50 transition-all">
                      <ArrowLeft size={14} />
                    </button>
                  </div>
                </div>

                {/* Balance — Professional */}
                <div className="mb-4">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Available Balance</p>
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl sm:text-4xl font-bold text-bybit-yellow tracking-tight">
                      {showBalance ? formatAmount(Number(primarySavings?.balance || 0), primarySavings?.currency || homeCurrency) : '••••••'}
                    </h2>
                    {primarySavings?.currency && primarySavings.currency !== (primarySavings?.currency || homeCurrency) && (
                      <span className="text-[9px] text-gray-500 font-mono bg-bybit-bg/50 px-2 py-0.5 rounded">
                        {getCurrencySymbol(primarySavings?.currency || '')}{Number(primarySavings?.balance || 0).toLocaleString('en-US', {minimumFractionDigits:0})} {primarySavings?.currency}
                      </span>
                    )}
                  </div>
                </div>

                {/* IBAN Display */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex-1 px-3 py-2 rounded-lg bg-bybit-bg/60 border border-bybit-border/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] text-gray-600 uppercase tracking-wider font-mono">IBAN</span>
                      <button onClick={() => copyToClipboard(primarySavings?.accountNumber || '', 'sav')} className="p-0.5 rounded text-gray-500 hover:text-bybit-yellow">
                        {copied === 'sav' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                    <p className="text-sm font-mono font-bold text-white tracking-wider mt-0.5">
                      {showBalance ? formatIbanDisplay(primarySavings?.accountNumber || '') : formatIbanShort(primarySavings?.accountNumber || '')}
                    </p>
                  </div>
                </div>

                {/* Details Grid — same layout as checking */}
                <div className="grid grid-cols-4 gap-2 text-[10px]">
                  <div className="p-2 rounded-lg bg-bybit-bg/40 border border-bybit-border/30">
                    <span className="text-gray-600">Routing</span>
                    <p className="text-white font-mono mt-0.5 text-[11px]">0210000</p>
                  </div>
                  <div className="p-2 rounded-lg bg-bybit-bg/40 border border-bybit-border/30">
                    <span className="text-gray-600">SWIFT</span>
                    <p className="text-white font-mono mt-0.5 text-[11px]">UZUUS33</p>
                  </div>
                  <div className="p-2 rounded-lg bg-bybit-bg/40 border border-bybit-border/30">
                    <span className="text-gray-600">Type</span>
                    <p className="text-emerald-400 font-semibold mt-0.5 text-[11px]">Savings</p>
                  </div>
                  <div className="p-2 rounded-lg bg-bybit-bg/40 border border-bybit-border/30">
                    <span className="text-gray-600">Status</span>
                    <p className="text-emerald-400 font-semibold mt-0.5 text-[11px]">Active</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Quick Stats Row ═══ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 cursor-pointer hover:border-bybit-yellow/50 transition-all relative overflow-hidden group" onClick={() => { setModalOpen('Accounts'); setActiveSidebar('Accounts'); }}>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400"><Wallet size={16} /></div>
                <div><p className="text-[10px] text-gray-500">Checking</p><p className="text-sm font-bold text-white">{getCurrencySymbol(primaryChecking?.currency || homeCurrency)}{totalChecking.toLocaleString('en-US', {minimumFractionDigits:2})}</p></div>
              </div>
            </Card>
            <Card className="p-4 cursor-pointer hover:border-bybit-yellow/50 transition-all relative overflow-hidden group" onClick={() => { setModalOpen('Accounts'); setActiveSidebar('Accounts'); }}>
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400"><PiggyBank size={16} /></div>
                <div><p className="text-[10px] text-gray-500">Savings</p><p className="text-sm font-bold text-bybit-yellow">{getCurrencySymbol(primarySavings?.currency || homeCurrency)}{totalSavings.toLocaleString('en-US', {minimumFractionDigits:2})}</p></div>
              </div>
            </Card>
            <Card className="p-4 cursor-pointer hover:border-bybit-yellow/50 transition-all relative overflow-hidden group" onClick={() => { setModalOpen('Crypto Wallet'); setActiveSidebar('Crypto Wallet'); }}>
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400"><Bitcoin size={16} /></div>
                <div><p className="text-[10px] text-gray-500">Crypto markets</p><p className="text-sm font-bold text-white">{cryptoPricesError ? 'Unavailable' : `${cryptoAssets.length} live quotes`}</p></div>
              </div>
            </Card>
            <Card className="p-4 cursor-pointer hover:border-bybit-yellow/50 transition-all relative overflow-hidden group" onClick={() => { setModalOpen('Exchange Rates'); setActiveSidebar('Exchange Rates'); }}>
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400"><BarChart3 size={16} /></div>
                <div><p className="text-[10px] text-gray-500">Exchange</p><p className="text-sm font-bold text-white">60+ Pairs</p></div>
              </div>
            </Card>
          </div>

          {/* ═══ Multi-Currency Portfolio Grid ═══ */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Multi-Currency Portfolio</h3>
              <button onClick={() => { setModalOpen('Accounts'); setActiveSidebar('Accounts'); }} className="text-sm text-bybit-yellow hover:underline flex items-center gap-1">View All <ChevronRight size={14} /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {accounts.slice(0, 12).map((acc) => (
                <Card key={acc.id} className="p-4 cursor-pointer hover:border-bybit-yellow/50 transition-all relative overflow-hidden group" onClick={() => { setSelectedAccount(acc); setModalOpen('AccountDetail'); }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-bybit-yellow/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold">{getCurrencySymbol(acc.currency)}</span>
                      <span className="text-[10px] font-mono text-gray-500">{acc.currency}</span>
                    </div>
                    <p className="text-sm font-bold text-white truncate">{showBalance ? formatAmount(Number(acc.balance), acc.currency) : '••••••'}</p>
                    <p className="text-[10px] text-gray-500 mt-1 font-mono truncate">{maskAccount(acc.accountNumber || '')}</p>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full mt-1 inline-block ${(acc.accountType === 'CHECKING' || acc.accountNumber?.includes('CHK')) ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {(acc.accountType === 'CHECKING' || acc.accountNumber?.includes('CHK')) ? 'Checking' : 'Savings'}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* ═══ Recent Transactions ═══ */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Recent Transactions</h3>
              <button onClick={() => { setModalOpen('History'); setActiveSidebar('History'); }} className="text-sm text-bybit-yellow hover:underline flex items-center gap-1">View All <ChevronRight size={14} /></button>
            </div>
            <div className="space-y-1">
              {filteredTransactions.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No transactions yet.</p>
              ) : filteredTransactions.map((tx) => (
                <div key={tx.id} onClick={() => { setSelectedTx(tx); setModalOpen('TransactionDetail'); }}
                  className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-bybit-elevated transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${tx.sourceCurrency === tx.destinationCurrency ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {tx.sourceCurrency === tx.destinationCurrency ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{tx.sourceCurrency === tx.destinationCurrency ? 'Deposit' : 'Wire Transfer'}</p>
                      <p className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • <span className="font-mono">{tx.destinationBankSwift}</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${tx.sourceCurrency === tx.destinationCurrency ? 'text-emerald-400' : 'text-red-400'}`}>
                        {tx.sourceCurrency === tx.destinationCurrency ? '+' : '-'}{formatAmount(Number(tx.sourceAmount), tx.sourceCurrency)}
                      </p>
                      <Badge variant={getStatusBadge(tx.status) as any} className="mt-1">{tx.status.replace('_', ' ')}</Badge>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setReceiptTx(tx); setModalOpen('Receipt'); }}
                      className="p-2 rounded-lg bg-bybit-elevated border border-bybit-border text-gray-500 hover:text-bybit-yellow hover:border-bybit-yellow/50 opacity-0 group-hover:opacity-100 transition-all">
                      <Receipt size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         MODALS
         ═══════════════════════════════════════════════════════════════════════ */}

      {/* ─── Accounts Modal ─── */}
      <Modal open={modalOpen === 'Accounts'} onClose={() => setModalOpen(null)} title="All Accounts">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">Manage your checking and savings accounts across 60+ currencies.</p>
            <button onClick={() => { setModalOpen(null); setActiveSidebar('Dashboard'); }} className="p-2 rounded-lg bg-bybit-elevated border border-bybit-border text-gray-400 hover:text-bybit-yellow transition-all">
              <ArrowLeft size={16} />
            </button>
          </div>

          {/* Checking & Savings Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div onClick={() => { if (primaryChecking) setSelectedAccount(primaryChecking); setModalOpen('AccountDetail'); }} className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 hover:border-blue-500/40 cursor-pointer transition-all">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                  <Wallet size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Checking</p>
                  <p className="text-[9px] text-gray-500 font-mono">{formatIbanShort(primaryChecking?.accountNumber || '')}</p>
                </div>
              </div>
              <p className="text-lg font-bold text-white">{getCurrencySymbol(primaryChecking?.currency || homeCurrency)}{totalChecking.toLocaleString('en-US', {minimumFractionDigits:2})}</p>
              <p className="text-[9px] text-gray-500">{primaryChecking?.currency || homeCurrency} Account</p>
            </div>
            <div onClick={() => { if (primarySavings) setSelectedAccount(primarySavings); setModalOpen('AccountDetail'); }} className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40 cursor-pointer transition-all">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                  <PiggyBank size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Savings</p>
                  <p className="text-[9px] text-gray-500 font-mono">{formatIbanShort(primarySavings?.accountNumber || '')}</p>
                </div>
              </div>
              <p className="text-lg font-bold text-bybit-yellow">{getCurrencySymbol(primarySavings?.currency || homeCurrency)}{totalSavings.toLocaleString('en-US', {minimumFractionDigits:2})}</p>
              <p className="text-[9px] text-gray-500">{primarySavings?.currency || homeCurrency} Account</p>
            </div>
          </div>

          {/* Domestic Transfer Button */}
          <button onClick={() => setModalOpen('DomesticTransfer')} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-bybit-border hover:border-bybit-yellow/50 text-white font-semibold text-sm transition-all">
            <ArrowLeftRight size={16} className="text-bybit-yellow" /> Transfer Between Accounts
          </button>

          {/* All Accounts List */}
          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {accounts.map((acc) => (
              <div key={acc.id} onClick={() => { setSelectedAccount(acc); setModalOpen('AccountDetail'); }}
                className="flex items-center justify-between p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border hover:border-bybit-yellow/50 cursor-pointer transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-bybit-yellow/10 flex items-center justify-center text-bybit-yellow text-base font-bold">{getCurrencySymbol(acc.currency)}</div>
                  <div>
                    <p className="text-sm font-semibold text-white">{acc.currency} — <span className="text-xs text-gray-400">{(acc.accountType === 'CHECKING' || acc.accountNumber?.includes('CHK')) ? 'Checking' : 'Savings'}</span></p>
                    <p className="text-[10px] font-mono text-gray-500">{maskAccount(acc.accountNumber || '')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{formatAmount(Number(acc.balance), acc.currency)}</p>
                  <p className="text-[10px] text-gray-500">Available</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* ─── Balances Modal — Verify Checking & Savings ─── */}
      <Modal open={modalOpen === 'Balances'} onClose={() => setModalOpen(null)} title="Account Balances" className="max-w-lg">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">Real-time balances for your checking and savings accounts.</p>
            <button onClick={() => { setModalOpen(null); setActiveSidebar('Dashboard'); }} className="p-2 rounded-lg bg-bybit-elevated border border-bybit-border text-gray-400 hover:text-bybit-yellow transition-all">
              <ArrowLeft size={16} />
            </button>
          </div>

          {/* Total Portfolio Value */}
          <div className="bg-gradient-to-br from-bybit-yellow/10 to-amber-500/10 rounded-xl p-5 border border-bybit-yellow/20 text-center">
            <p className="text-xs text-gray-400 mb-1">Total Portfolio Balance</p>
            <p className="text-3xl font-extrabold text-white">
              {showBalance ? formatAmount(totalBalance, homeCurrency) : '••••••'}
            </p>
            <p className="text-[9px] text-gray-600 mt-0.5">{getCurrencySymbol(homeCurrency)}{homeCurrency} • {getCountryName(user?.countryCode || 'US')}</p>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="mt-2 inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-bybit-yellow transition-colors"
            >
              {showBalance ? <EyeOff size={12} /> : <Eye size={12} />}
              {showBalance ? 'Hide' : 'Show'} balances
            </button>
          </div>

          {/* Checking Account Card */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600/15 via-bybit-surface to-blue-900/15 border border-blue-500/20 p-5">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-[50px]" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <Wallet size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Checking Account</p>
                    <p className="text-[9px] text-gray-500 font-mono">{formatIbanShort(primaryChecking?.accountNumber || '')}</p>
                  </div>
                </div>
                <Badge variant="confirmed">Active</Badge>
              </div>

              <div className="mb-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Available Balance</p>
                <p className="text-2xl font-bold text-white">
                  {showBalance ? formatAmount(Number(primaryChecking?.balance || 0), primaryChecking?.currency || homeCurrency) : '••••••'}
                </p>
                <p className="text-[8px] text-gray-600 mt-0.5">
                  {primaryChecking?.currency || homeCurrency} Account
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div className="p-2 rounded-lg bg-bybit-bg/40 border border-bybit-border/30">
                  <span className="text-gray-600">Accounts</span>
                  <p className="text-white font-semibold mt-0.5">{checkingAccounts.length}</p>
                </div>
                <div className="p-2 rounded-lg bg-bybit-bg/40 border border-bybit-border/30">
                  <span className="text-gray-600">Routing</span>
                  <p className="text-white font-mono mt-0.5 text-[9px]">0210000</p>
                </div>
                <div className="p-2 rounded-lg bg-bybit-bg/40 border border-bybit-border/30">
                  <span className="text-gray-600">SWIFT</span>
                  <p className="text-white font-mono mt-0.5 text-[9px]">UZUUS33</p>
                </div>
              </div>
            </div>
          </div>

          {/* Savings Account Card */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600/15 via-bybit-surface to-emerald-900/15 border border-emerald-500/20 p-5">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-[50px]" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <PiggyBank size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Savings Account</p>
                    <p className="text-[9px] text-gray-500 font-mono">{formatIbanShort(primarySavings?.accountNumber || '')}</p>
                  </div>
                </div>
                <Badge variant="confirmed">Active</Badge>
              </div>

              <div className="mb-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Available Balance</p>
                <p className="text-2xl font-bold text-bybit-yellow">
                  {showBalance ? formatAmount(Number(primarySavings?.balance || 0), primarySavings?.currency || homeCurrency) : '••••••'}
                </p>
                <p className="text-[8px] text-gray-600 mt-0.5">
                  {primarySavings?.currency || homeCurrency} Account
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div className="p-2 rounded-lg bg-bybit-bg/40 border border-bybit-border/30">
                  <span className="text-gray-600">Interest</span>
                  <p className="text-emerald-400 font-semibold mt-0.5">Active</p>
                </div>
                <div className="p-2 rounded-lg bg-bybit-bg/40 border border-bybit-border/30">
                  <span className="text-gray-600">Opened</span>
                  <p className="text-white font-mono mt-0.5">2026</p>
                </div>
                <div className="p-2 rounded-lg bg-bybit-bg/40 border border-bybit-border/30">
                  <span className="text-gray-600">Fee</span>
                  <p className="text-emerald-400 font-semibold mt-0.5">$0</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setModalOpen('DomesticTransfer'); }}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-bybit-border hover:border-bybit-yellow/50 text-white font-semibold text-sm transition-all"
            >
              <ArrowLeftRight size={16} className="text-bybit-yellow" />
              Transfer Between Accounts
            </button>
            <button
              onClick={() => router.push('/transfer')}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border hover:border-bybit-yellow/50 text-white font-semibold text-sm transition-all"
            >
              <Send size={16} className="text-bybit-yellow" />
              Send Wire Transfer
            </button>
          </div>

          {/* All Accounts Breakdown */}
          <div>
            <h4 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-3">All Accounts Breakdown</h4>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-bybit-yellow/10 flex items-center justify-center text-bybit-yellow text-sm font-bold">
                      {getCurrencySymbol(acc.currency)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{acc.currency}</p>
                      <p className="text-[9px] text-gray-500 font-mono">
                        {(acc.accountType === 'CHECKING' || acc.accountNumber?.includes('CHK')) ? 'Checking' : 'Savings'} • {maskAccount(acc.accountNumber || '')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">
                      {showBalance ? formatAmount(Number(acc.balance), acc.currency) : '••••••'}
                    </p>
                    <p className="text-[9px] text-gray-500">Available</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
            <div className="flex items-start gap-2">
              <Shield size={14} className="text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-gray-500">All balances are updated in real-time. FDIC insured up to $250,000 per depositor.</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* ─── Domestic Transfer Modal — Uses snapshot for verified balances ─── */}
      <Modal open={modalOpen === 'DomesticTransfer'} onClose={() => setModalOpen(null)} title="Transfer Between Accounts" className="max-w-md">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <button onClick={() => setModalOpen('Accounts')} className="flex items-center gap-2 text-sm text-gray-400 hover:text-bybit-yellow transition-colors">
              <ArrowLeft size={16} /> Accounts
            </button>
            <button onClick={() => { setModalOpen(null); setActiveSidebar('Dashboard'); }} className="p-2 rounded-lg bg-bybit-elevated border border-bybit-border text-gray-400 hover:text-bybit-yellow transition-all">
              <ArrowLeft size={16} />
            </button>
          </div>

          {/* From Account — uses snapshot accounts for verified balances */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">From Account</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`p-3 rounded-xl border text-left transition-all ${domesticFrom === 'checking' ? 'bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/30' : 'bg-bybit-elevated/50 border-bybit-border hover:border-blue-500/30'}`}
                onClick={() => setDomesticFrom('checking')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                    <Wallet size={12} className="text-white" />
                  </div>
                  <p className="text-xs font-bold text-white">Checking</p>
                  {domesticFrom === 'checking' && <Check size={12} className="text-blue-400" />}
                </div>
                <p className="text-xs font-bold text-white">{getCurrencySymbol(primaryChecking?.currency || homeCurrency)}{Number(primaryChecking?.balance || 0).toLocaleString('en-US', {minimumFractionDigits:2})}</p>
              </button>
              <button
                className={`p-3 rounded-xl border text-left transition-all ${domesticFrom === 'savings' ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30' : 'bg-bybit-elevated/50 border-bybit-border hover:border-emerald-500/30'}`}
                onClick={() => setDomesticFrom('savings')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                    <PiggyBank size={12} className="text-white" />
                  </div>
                  <p className="text-xs font-bold text-white">Savings</p>
                  {domesticFrom === 'savings' && <Check size={12} className="text-emerald-400" />}
                </div>
                <p className="text-xs font-bold text-bybit-yellow">{getCurrencySymbol(primarySavings?.currency || homeCurrency)}{totalSavings.toLocaleString('en-US', {minimumFractionDigits:2})}</p>
              </button>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="w-10 h-10 rounded-full bg-bybit-elevated border border-bybit-border flex items-center justify-center">
              <ArrowDownLeft size={18} className="text-bybit-yellow" />
            </div>
          </div>

          {/* To Account */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">To Account</label>
            <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${domesticFrom === 'checking' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {domesticFrom === 'checking' ? <PiggyBank size={14} /> : <Wallet size={14} />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{domesticFrom === 'checking' ? 'Savings Account' : 'Checking Account'}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{formatIbanShort(domesticFrom === 'checking' ? primarySavings?.accountNumber || '' : primaryChecking?.accountNumber || '')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Amount ({homeCurrency})</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{getCurrencySymbol(homeCurrency)}</span>
              <input
                type="number"
                value={domesticAmount}
                onChange={e => setDomesticAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-white text-lg font-bold focus:outline-none focus:border-bybit-yellow"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleDomesticTransfer}
            disabled={!domesticAmount || parseFloat(domesticAmount) <= 0 || domesticLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-bybit-yellow text-bybit-bg font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 shadow-bybit-glow"
          >
            {domesticLoading ? (
              <><div className="w-4 h-4 border-2 border-bybit-bg border-t-transparent rounded-full animate-spin" /> Processing…</>
            ) : (
              <><Send size={16} /> Transfer {getCurrencySymbol(homeCurrency)}{parseFloat(domesticAmount || '0').toLocaleString()} to {domesticFrom === 'checking' ? 'Savings' : 'Checking'}</>
            )}
          </button>

          {domesticSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <p className="text-xs text-emerald-300">{domesticSuccess}</p>
            </div>
          )}

          <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
            <div className="flex items-start gap-2">
              <Shield size={14} className="text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-gray-500">Instant transfer between your UZU accounts. No fees. No limits.</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* ─── Account Detail Modal ─── */}
      <Modal open={modalOpen === 'AccountDetail'} onClose={() => setModalOpen(null)} title={selectedAccount ? `${selectedAccount.currency} Account` : 'Account'}>
        {selectedAccount && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <button onClick={() => setModalOpen('Accounts')} className="flex items-center gap-2 text-sm text-gray-400 hover:text-bybit-yellow transition-colors">
                <ArrowLeft size={16} /> All Accounts
              </button>
              <button onClick={() => { setModalOpen(null); setActiveSidebar('Dashboard'); }} className="p-2 rounded-lg bg-bybit-elevated border border-bybit-border text-gray-400 hover:text-bybit-yellow transition-all">
                <ArrowLeft size={16} />
              </button>
            </div>
            <div className="bg-gradient-to-br from-bybit-yellow/10 to-amber-500/10 rounded-xl p-5 border border-bybit-yellow/20 text-center">
              <p className="text-xs text-gray-400 mb-1">{(selectedAccount.accountType === 'CHECKING' || selectedAccount.accountNumber?.includes('CHK')) ? 'Checking Account' : 'Savings Account'}</p>
              <p className="text-3xl font-bold text-white">{formatAmount(Number(selectedAccount.balance), selectedAccount.currency)}</p>
              <p className="text-xs text-gray-400 mt-1">Current Balance</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                <p className="text-[10px] text-gray-500 uppercase">Account Number</p>
                <div className="flex items-center gap-1 mt-1">
                  <code className="text-xs font-mono text-white">{maskAccount(selectedAccount.accountNumber || '')}</code>
                  <button onClick={() => copyToClipboard(selectedAccount.accountNumber || '', `det-${selectedAccount.id}`)} className="p-0.5 rounded text-gray-500 hover:text-bybit-yellow">
                    {copied === `det-${selectedAccount.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                <p className="text-[10px] text-gray-500 uppercase">Currency</p>
                <p className="text-sm font-semibold text-white mt-1">{selectedAccount.currency}</p>
              </div>
              <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                <p className="text-[10px] text-gray-500 uppercase">Ledger Balance</p>
                <p className="text-sm font-semibold text-white mt-1">{formatAmount(Number(selectedAccount.ledgerLockedBalance), selectedAccount.currency)}</p>
              </div>
              <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                <p className="text-[10px] text-gray-500 uppercase">Available</p>
                <p className="text-sm font-semibold text-emerald-400 mt-1">{formatAmount(Number(selectedAccount.balance) - Number(selectedAccount.ledgerLockedBalance), selectedAccount.currency)}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Transfer Redirect ─── */}
      {modalOpen === 'Transfer' && (() => { router.push('/transfer'); return null; })()}

      {/* ─── Crypto Wallet Modal — Live Quotes + Snapshot Addresses ─── */}
      <Modal open={modalOpen === 'Crypto Wallet'} onClose={() => setModalOpen(null)} title="Crypto Wallet" className="max-w-2xl">
        <div className="space-y-5">
          {/* Market Summary */}
          <div className="flex items-center justify-between">
            <div className="bg-gradient-to-br from-amber-500/10 via-bybit-surface to-orange-500/10 rounded-xl p-5 border border-amber-500/20 flex-1">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Crypto Market</p>
                <div className="flex items-center gap-2">
                  {cryptoPricesError ? <Badge variant="error">Offline</Badge> : <Badge variant="live">Live Quotes</Badge>}
                  <span className="text-[8px] text-gray-600">Prices in {activeAccount}</span>
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{cryptoAssets.length} assets</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-400">Deposit addresses from DB snapshot</span>
                <span className="text-xs text-gray-600">•</span>
                <span className="text-xs text-gray-400">Quotes refresh every minute</span>
              </div>
            </div>
            <button onClick={() => { setModalOpen(null); setActiveSidebar('Dashboard'); }} className="p-2.5 rounded-xl bg-bybit-elevated border border-bybit-border text-gray-400 hover:text-bybit-yellow hover:border-bybit-yellow/50 transition-all ml-3 self-start">
              <ArrowLeft size={18} />
            </button>
          </div>

          {/* Market Ticker */}
          <div className="overflow-hidden rounded-xl bg-bybit-elevated/30 border border-bybit-border/50 p-2">
            <div className="flex gap-3 animate-scroll-left whitespace-nowrap">
              {[...cryptoAssets, ...cryptoAssets].map((asset, i) => {
                return (
                  <span key={`${asset.symbol}-${i}`} className="inline-flex items-center gap-1.5 text-[10px] font-mono bg-bybit-bg/50 px-2 py-1 rounded-full border border-bybit-border/50">
                    <span className="font-bold text-white">{asset.symbol}</span>
                    <span className="text-gray-400">{formatAmount(asset.price, activeAccount)}</span>
                    <span className={asset.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}>{asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Crypto Assets with Real Market Data — Click to Deposit */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {cryptoAssets.length === 0 ? (
              <div className="text-center py-8">
                <Bitcoin size={32} className="text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">{cryptoPricesLoading ? 'Loading live market quotes…' : cryptoPricesError || 'No market quotes available.'}</p>
              </div>
            ) : cryptoAssets.map(asset => {
              // Check if snapshot has a deposit address for this asset
              const snapAddresses = snapshot?.cryptoAddresses || [];
              const hasAddress = snapAddresses.some((a: any) => a.symbol === asset.symbol);
              return (
                <div key={asset.id} onClick={() => { setSelectedCrypto(asset); setModalOpen('CryptoDeposit'); }}
                  className="flex items-center justify-between p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border hover:border-bybit-yellow/50 cursor-pointer transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                      <CryptoLogo symbol={asset.symbol} size={36} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{asset.name}</p>
                      <p className="text-xs text-gray-500">{asset.symbol} · {asset.currency}</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{formatAmount(asset.price, activeAccount)}</p>
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className={`text-[10px] ${asset.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
                        </span>
                        <span className="text-[8px] text-gray-600">Cap {formatMarketValue(asset.marketCap, activeAccount)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {hasAddress && <Badge variant="live">Deposit</Badge>}
                      <div className="p-1.5 rounded-lg bg-bybit-yellow/10 text-bybit-yellow opacity-0 group-hover:opacity-100 transition-all">
                        <Download size={14} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Crypto to Banking Transfer Box — Compact */}
          <div className="rounded-xl bg-gradient-to-r from-blue-500/5 to-emerald-500/5 border border-blue-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ArrowLeftRight size={14} className="text-bybit-yellow" />
                <span className="text-xs font-semibold text-white">Crypto → Banking</span>
              </div>
              <Badge variant="confirmed">Auto-convert</Badge>
            </div>
            <p className="text-[10px] text-gray-500">
              Deposited crypto is automatically converted to <span className="text-bybit-yellow font-medium">{getCurrencySymbol(activeAccount)}{activeAccount}</span> and credited to your Checking Account. Conversion completes 10–30 min after network confirmation.
            </p>
          </div>

          {/* Market Disclaimer */}
          <div className="p-3 rounded-xl bg-bybit-elevated/30 border border-bybit-border/50">
            <div className="flex items-start gap-2">
              <Info size={12} className="text-gray-500 mt-0.5 shrink-0" />
              <p className="text-[9px] text-gray-600">Live quotes supplied by CoinGecko in {activeAccount}. Click any coin above to view the deposit address and send funds.</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* ─── Crypto Deposit Modal — Professional with Real Market Price ─── */}
      <Modal open={modalOpen === 'CryptoDeposit'} onClose={() => { setModalOpen(null); setCryptoDepositStep('address'); setCryptoDepositAmount(''); setCryptoDepositTxHash(''); setCryptoDepositError(''); }} title={`Deposit ${selectedCrypto?.symbol || ''}`} className="max-w-lg">
        {selectedCrypto && (() => {
          // Use snapshot crypto addresses for live DB reflection when admin adds/changes them
          const snapshotAddresses = snapshot?.cryptoAddresses || [];
          const addr = snapshotAddresses.find((a: any) => a.symbol === selectedCrypto.symbol)
            || cryptoAddresses.find((a: any) => a.symbol === selectedCrypto.symbol);
          const address = addr?.address || '';
          const price = selectedCrypto.price;
          const change = selectedCrypto.change24h;
          return (
          <div className="space-y-5">
            {/* Return Arrow */}
            <div className="flex items-center justify-between">
              <button onClick={() => { setModalOpen('Crypto Wallet'); setCryptoDepositStep('address'); setCryptoDepositAmount(''); setCryptoDepositTxHash(''); setCryptoDepositError(''); }} className="flex items-center gap-2 text-sm text-gray-400 hover:text-bybit-yellow transition-colors">
                <ArrowLeft size={16} /> Back to Wallet
              </button>
              <button onClick={() => { setModalOpen(null); setActiveSidebar('Dashboard'); setCryptoDepositStep('address'); setCryptoDepositAmount(''); setCryptoDepositTxHash(''); setCryptoDepositError(''); }} className="p-2 rounded-lg bg-bybit-elevated border border-bybit-border text-gray-400 hover:text-bybit-yellow transition-all">
                <ArrowLeft size={16} />
              </button>
            </div>

            {/* Crypto Logo & Real Market Price */}
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <CryptoLogo symbol={selectedCrypto.symbol} size={56} />
              </div>
              <p className="text-xl font-bold text-white">{selectedCrypto.name}</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-sm text-gray-400">Market price</span>
                <span className="text-gray-600">·</span>
                <span className="text-sm font-semibold text-white">{formatAmount(price, activeAccount)}</span>
              </div>
              {/* Live Price Ticker */}
              <div className="flex items-center justify-center gap-3 mt-2">
                <div className="px-3 py-1 rounded-full bg-bybit-elevated/50 border border-bybit-border/50">
                  <span className="text-xs font-mono">
                    <span className="text-gray-500">1 {selectedCrypto.symbol} = </span>
                    <span className="text-white font-bold">{formatAmount(price, activeAccount)}</span>
                  </span>
                </div>
                <span className={`text-xs font-semibold ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {change >= 0 ? '▲' : '▼'} {Math.abs(change)}% 24h
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-[9px] text-gray-600">Market Cap: {formatMarketValue(selectedCrypto.marketCap, activeAccount)}</span>
                <span className="text-[9px] text-gray-600">•</span>
                <span className="text-[9px] text-gray-600">24h Volume: {formatMarketValue(selectedCrypto.volume24h, activeAccount)}</span>
              </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 justify-center">
              {['address', 'complete', 'receipt'].map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${cryptoDepositStep === s ? 'bg-bybit-yellow text-bybit-bg' : i < ['address', 'complete', 'receipt'].indexOf(cryptoDepositStep) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-bybit-elevated text-gray-500'}`}>
                    {i < ['address', 'complete', 'receipt'].indexOf(cryptoDepositStep) ? <Check size={10} /> : i + 1}
                  </div>
                  <span className={`text-[9px] ${cryptoDepositStep === s ? 'text-bybit-yellow' : 'text-gray-500'}`}>{s === 'address' ? 'Address' : s === 'complete' ? 'Verify' : 'Receipt'}</span>
                  {i < 2 && <div className={`w-6 h-0.5 ${i < ['address', 'complete', 'receipt'].indexOf(cryptoDepositStep) ? 'bg-emerald-500/50' : 'bg-bybit-border'}`} />}
                </div>
              ))}
            </div>

            {/* Step 1: Deposit Address */}
            {cryptoDepositStep === 'address' && (
              <>
                {/* Deposit Address — from Admin-Managed API */}
                <div className="p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Deposit Address</p>
                    {addr && <Badge variant="confirmed">{addr.network}</Badge>}
                  </div>
                  {address ? (
                    <>
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-bybit-bg/60 border border-bybit-border/60">
                        <code className="flex-1 text-xs font-mono text-white break-all">{address}</code>
                        <button onClick={() => copyToClipboard(address, 'crypto-deposit')}
                          className="p-2 rounded-lg bg-bybit-yellow/10 text-bybit-yellow hover:bg-bybit-yellow/20 transition-all shrink-0">
                          {copied === 'crypto-deposit' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                        </button>
                      </div>
                      {addr && <p className="text-[9px] text-gray-500 mt-1">Managed by UZU Admin • Updated {new Date(addr.updatedAt).toLocaleDateString()}</p>}
                    </>
                  ) : (
                    <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 text-center">
                      <p className="text-xs text-amber-400">No deposit address configured yet</p>
                      <p className="text-[9px] text-amber-300/60 mt-1">Contact support or check back later</p>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-500 mt-2">Send only {selectedCrypto.symbol} to this address. Sending other tokens may result in permanent loss.</p>
                </div>

                {/* Deposit Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                    <p className="text-[10px] text-gray-500 uppercase">Network</p>
                    <p className="text-sm font-semibold text-white mt-1">{addr?.network || (selectedCrypto.symbol === 'BTC' ? 'Bitcoin' : selectedCrypto.symbol === 'ETH' ? 'Ethereum' : selectedCrypto.symbol === 'SOL' ? 'Solana' : selectedCrypto.symbol === 'BNB' ? 'BSC' : 'Ethereum')}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                    <p className="text-[10px] text-gray-500 uppercase">Min Deposit</p>
                    <p className="text-sm font-semibold text-white mt-1">{addr?.minDeposit || (selectedCrypto.symbol === 'BTC' ? '0.001 BTC' : selectedCrypto.symbol === 'ETH' ? '0.01 ETH' : selectedCrypto.symbol === 'SOL' ? '0.1 SOL' : selectedCrypto.symbol === 'BNB' ? '0.05 BNB' : '10 USDC')}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                    <p className="text-[10px] text-gray-500 uppercase">Est. Arrival</p>
                    <p className="text-sm font-semibold text-emerald-400 mt-1">
                      {selectedCrypto.symbol === 'BTC' ? '~30 min' : selectedCrypto.symbol === 'SOL' ? '~10 sec' : selectedCrypto.symbol === 'XRP' ? '~5 sec' : '~5 min'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                    <p className="text-[10px] text-gray-500 uppercase">Fee</p>
                    <p className="text-sm font-semibold text-white mt-1">Free (on-chain fees apply)</p>
                  </div>
                </div>

                {/* Deposit to Account — Choose Checking or Savings */}
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Deposit to</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2">
                      <Wallet size={14} className="text-blue-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold text-blue-300">Checking Account</p>
                        <p className="text-[9px] text-blue-200/70 mt-0.5">Auto-converted to {getCurrencySymbol(activeAccount)}{activeAccount}</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2">
                      <PiggyBank size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold text-emerald-300">Savings Account</p>
                        <p className="text-[9px] text-emerald-200/70 mt-0.5">Auto-converted to {getCurrencySymbol(activeAccount)}{activeAccount}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Complete Deposit Button — after user copies address and sends */}
                {address && (
                  <button onClick={() => setCryptoDepositStep('complete')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-bybit-yellow text-bybit-bg font-bold text-sm hover:brightness-110 transition-all shadow-bybit-glow">
                    <CheckCircle2 size={16} /> I've Sent the Deposit — Complete
                  </button>
                )}
              </>
            )}

            {/* Step 2: Verify Deposit — user enters amount and tx hash */}
            {cryptoDepositStep === 'complete' && (
              <>
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-300">Verify Your Deposit</p>
                      <p className="text-[10px] text-amber-200/70 mt-1">Enter the amount you sent and the blockchain transaction hash to verify your deposit. Admin will review and credit your account.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Deposit Amount ({selectedCrypto.symbol})</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">{selectedCrypto.symbol}</span>
                      <input
                        type="number"
                        value={cryptoDepositAmount}
                        onChange={e => setCryptoDepositAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-14 pr-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-white text-lg font-bold focus:outline-none focus:border-bybit-yellow"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Blockchain Transaction Hash</label>
                    <input
                      type="text"
                      value={cryptoDepositTxHash}
                      onChange={e => setCryptoDepositTxHash(e.target.value)}
                      placeholder="0x... or txid..."
                      className="w-full px-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-white text-sm font-mono focus:outline-none focus:border-bybit-yellow"
                    />
                    <p className="text-[9px] text-gray-600">Paste the transaction hash from your wallet or blockchain explorer</p>
                  </div>

                  {cryptoDepositError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <p className="text-xs text-red-300">{cryptoDepositError}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => setCryptoDepositStep('address')}
                      className="flex-1 px-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-gray-300 font-semibold text-sm hover:border-bybit-yellow/50 transition-all">
                      Back
                    </button>
                    <button
                      onClick={async () => {
                        if (!cryptoDepositAmount || parseFloat(cryptoDepositAmount) <= 0) {
                          setCryptoDepositError('Please enter a valid deposit amount.');
                          return;
                        }
                        if (!cryptoDepositTxHash || cryptoDepositTxHash.length < 10) {
                          setCryptoDepositError('Please enter a valid transaction hash (at least 10 characters).');
                          return;
                        }
                        setCryptoDepositLoading(true);
                        setCryptoDepositError('');
                        try {
                          const { tokens } = useAuthStore.getState();
                          if (!tokens?.accessToken) throw new Error('Not authenticated');
                          const res = await fetch('/api/crypto/deposits', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.accessToken}` },
                            body: JSON.stringify({
                              symbol: selectedCrypto.symbol,
                              amount: cryptoDepositAmount,
                              blockchainTxHash: cryptoDepositTxHash,
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || 'Failed to submit deposit');
                          setCryptoDepositReceipt(data.deposit);
                          setCryptoDepositStep('receipt');
                        } catch (err: any) {
                          setCryptoDepositError(err.message || 'Failed to submit deposit');
                        } finally {
                          setCryptoDepositLoading(false);
                        }
                      }}
                      disabled={cryptoDepositLoading || !cryptoDepositAmount || !cryptoDepositTxHash}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-bybit-yellow text-bybit-bg font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 shadow-bybit-glow"
                    >
                      {cryptoDepositLoading ? (
                        <><div className="w-4 h-4 border-2 border-bybit-bg border-t-transparent rounded-full animate-spin" /> Submitting…</>
                      ) : (
                        <><CheckCircle2 size={16} /> Submit for Verification</>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Deposit Receipt */}
            {cryptoDepositStep === 'receipt' && cryptoDepositReceipt && (
              <>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={40} className="text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Deposit Submitted!</h3>
                  <p className="text-sm text-gray-400">Your {cryptoDepositReceipt.symbol} deposit is pending admin verification.</p>
                </div>

                <div className="bg-bybit-elevated/50 rounded-xl border border-bybit-border overflow-hidden">
                  <div className="bg-gradient-to-r from-bybit-yellow/10 to-amber-500/10 p-4 border-b border-bybit-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 font-mono">UZU DIGITAL UNION</p>
                        <p className="text-[10px] text-gray-600">Crypto Deposit Receipt</p>
                      </div>
                      <FileText size={24} className="text-bybit-yellow" />
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Asset</span><span className="text-white font-bold">{cryptoDepositReceipt.symbol}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Amount</span><span className="text-white font-bold">{cryptoDepositReceipt.amount} {cryptoDepositReceipt.symbol}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Transaction Hash</span><span className="text-white font-mono text-[10px]">{cryptoDepositReceipt.blockchainTxHash.slice(0, 20)}...</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Date</span><span className="text-white">{new Date(cryptoDepositReceipt.createdAt).toLocaleString()}</span></div>
                    <div className="border-t border-bybit-border my-2" />
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Status</span><Badge variant="pending">Pending Verification</Badge></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Deposit ID</span><span className="text-white font-mono text-[10px]">{cryptoDepositReceipt.id.slice(0, 12)}</span></div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                  <Info size={14} className="text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-amber-300">Admin will review your deposit and credit your account once confirmed on the blockchain. This typically takes 10-30 minutes.</p>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => { setModalOpen('Crypto Wallet'); setCryptoDepositStep('address'); setCryptoDepositAmount(''); setCryptoDepositTxHash(''); setCryptoDepositError(''); }}
                    className="flex-1 px-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-gray-300 font-semibold text-sm hover:border-bybit-yellow/50 transition-all">
                    Back to Wallet
                  </button>
                  <button onClick={() => { setModalOpen(null); setActiveSidebar('Dashboard'); setCryptoDepositStep('address'); setCryptoDepositAmount(''); setCryptoDepositTxHash(''); setCryptoDepositError(''); }}
                    className="flex-1 px-4 py-3 rounded-xl bg-bybit-yellow text-bybit-bg font-bold text-sm hover:brightness-110 transition-all shadow-bybit-glow">
                    Dashboard
                  </button>
                </div>
              </>
            )}
          </div>
          );
        })()}
      </Modal>

      {/* ─── Crypto Detail Modal — Real Market Data ─── */}
      <Modal open={modalOpen === 'CryptoDetail'} onClose={() => setModalOpen(null)} title={selectedCrypto?.name || 'Asset'} className="max-w-md">
        {selectedCrypto && (() => {
          const price = selectedCrypto.price;
          const change = selectedCrypto.change24h;
          return (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <button onClick={() => setModalOpen('Crypto Wallet')} className="flex items-center gap-2 text-sm text-gray-400 hover:text-bybit-yellow transition-colors">
                <ArrowLeft size={16} /> Back
              </button>
              <button onClick={() => { setModalOpen(null); setActiveSidebar('Dashboard'); }} className="p-2 rounded-lg bg-bybit-elevated border border-bybit-border text-gray-400 hover:text-bybit-yellow transition-all">
                <ArrowLeft size={16} />
              </button>
            </div>
            <div className="bg-gradient-to-br from-amber-500/10 via-bybit-surface to-orange-500/10 rounded-xl p-5 border border-amber-500/20 text-center">
              <div className="flex justify-center mb-3">
                <CryptoLogo symbol={selectedCrypto.symbol} size={48} />
              </div>
              <p className="text-2xl font-bold text-white">{formatAmount(price, activeAccount)}</p>
              <p className="text-sm text-gray-400 mt-1">1 {selectedCrypto.symbol}</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-xs text-gray-500">24-hour market movement</span>
                <span className={`text-xs font-semibold ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {change >= 0 ? '▲' : '▼'} {Math.abs(change)}%
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                <p className="text-[10px] text-gray-500 uppercase">Market Cap</p>
                <p className="text-sm font-semibold text-white mt-1">{formatMarketValue(selectedCrypto.marketCap, activeAccount)}</p>
              </div>
              <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                <p className="text-[10px] text-gray-500 uppercase">24h Volume</p>
                <p className="text-sm font-semibold text-white mt-1">{formatMarketValue(selectedCrypto.volume24h, activeAccount)}</p>
              </div>
              <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                <p className="text-[10px] text-gray-500 uppercase">Network</p>
                <p className="text-sm font-semibold text-white mt-1">{selectedCrypto.symbol === 'BTC' ? 'Bitcoin' : selectedCrypto.symbol === 'ETH' ? 'Ethereum' : selectedCrypto.symbol === 'SOL' ? 'Solana' : selectedCrypto.symbol === 'BNB' ? 'BSC' : 'Ethereum'}</p>
              </div>
              <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                <p className="text-[10px] text-gray-500 uppercase">24h Change</p>
                <p className={`text-sm font-semibold mt-1 ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{change >= 0 ? '+' : ''}{change}%</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setSelectedCrypto(selectedCrypto); setModalOpen('CryptoDeposit'); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-bybit-yellow text-bybit-bg font-semibold text-sm hover:brightness-110 transition-all shadow-bybit-glow"><Download size={16} /> Deposit</button>
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-bybit-elevated border border-bybit-border text-gray-300 font-semibold text-sm hover:border-bybit-yellow/50 transition-all"><Send size={16} /> Send</button>
            </div>
          </div>
          );
        })()}
      </Modal>

      {/* ─── History Modal ─── */}
      <Modal open={modalOpen === 'History'} onClose={() => setModalOpen(null)} title="Transaction History">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="text" placeholder="Search transactions..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bybit-elevated border border-bybit-border text-white text-sm focus:outline-none focus:border-bybit-yellow" />
            </div>
            <button className="p-2.5 rounded-xl bg-bybit-elevated border border-bybit-border text-gray-400 hover:text-bybit-yellow transition-colors"><Filter size={16} /></button>
          </div>
          <div className="max-h-96 overflow-y-auto space-y-1 pr-1">
            {transactions.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No transaction receipts yet.</p>
            ) : transactions.map((tx) => (
              <div key={tx.id} onClick={() => { setSelectedTx(tx); setModalOpen('TransactionDetail'); }}
                className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-bybit-elevated transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.sourceCurrency === tx.destinationCurrency ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {tx.sourceCurrency === tx.destinationCurrency ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{tx.sourceCurrency === tx.destinationCurrency ? 'Deposit' : 'Wire Transfer'}</p>
                    <p className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${tx.sourceCurrency === tx.destinationCurrency ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tx.sourceCurrency === tx.destinationCurrency ? '+' : '-'}{formatAmount(Number(tx.sourceAmount), tx.sourceCurrency)}
                    </p>
                    <Badge variant={getStatusBadge(tx.status) as any} className="mt-1">{tx.status.replace('_', ' ')}</Badge>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setReceiptTx(tx); setModalOpen('Receipt'); }}
                    className="p-1.5 rounded-lg bg-bybit-elevated border border-bybit-border text-gray-500 hover:text-bybit-yellow opacity-0 group-hover:opacity-100 transition-all">
                    <Receipt size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* ─── Transaction Detail Modal ─── */}
      <Modal open={modalOpen === 'TransactionDetail'} onClose={() => setModalOpen(null)} title="Transaction Details">
        {selectedTx && (
          <div className="space-y-5">
            <div className={`p-4 rounded-xl text-center ${selectedTx.sourceCurrency === selectedTx.destinationCurrency ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              <p className={`text-2xl font-bold ${selectedTx.sourceCurrency === selectedTx.destinationCurrency ? 'text-emerald-400' : 'text-red-400'}`}>
                {selectedTx.sourceCurrency === selectedTx.destinationCurrency ? '+' : '-'}{formatAmount(Number(selectedTx.sourceAmount), selectedTx.sourceCurrency)}
              </p>
              <Badge variant={getStatusBadge(selectedTx.status) as any} className="mt-2">{selectedTx.status.replace('_', ' ')}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                <p className="text-[10px] text-gray-500 uppercase">Date</p>
                <p className="text-xs font-semibold text-white mt-1">{new Date(selectedTx.createdAt).toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                <p className="text-[10px] text-gray-500 uppercase">Exchange Rate</p>
                <p className="text-xs font-semibold text-white mt-1">1 {selectedTx.sourceCurrency} = {selectedTx.exchangeRate} {selectedTx.destinationCurrency}</p>
              </div>
              <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                <p className="text-[10px] text-gray-500 uppercase">Source</p>
                <p className="text-xs font-semibold text-white mt-1">{formatAmount(Number(selectedTx.sourceAmount), selectedTx.sourceCurrency)}</p>
              </div>
              <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                <p className="text-[10px] text-gray-500 uppercase">Destination</p>
                <p className="text-xs font-semibold text-white mt-1">{formatAmount(Number(selectedTx.destinationAmount), selectedTx.destinationCurrency)}</p>
              </div>
              <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border col-span-2">
                <p className="text-[10px] text-gray-500 uppercase">SWIFT / BIC</p>
                <p className="text-xs font-mono font-semibold text-white mt-1">{selectedTx.destinationBankSwift}</p>
              </div>
              <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border col-span-2">
                <p className="text-[10px] text-gray-500 uppercase">IBAN</p>
                <p className="text-xs font-mono font-semibold text-white mt-1">{selectedTx.destinationIban}</p>
              </div>
              {selectedTx.blockchainTxHash && (
                <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border col-span-2">
                  <p className="text-[10px] text-gray-500 uppercase">Blockchain Hash</p>
                  <div className="flex items-center gap-1 mt-1"><code className="text-xs font-mono text-bybit-yellow">{selectedTx.blockchainTxHash}</code><ExternalLink size={12} className="text-gray-500" /></div>
                </div>
              )}
            </div>
            <button onClick={() => { setReceiptTx(selectedTx); setModalOpen('Receipt'); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-bybit-elevated border border-bybit-border text-gray-300 font-semibold text-sm hover:border-bybit-yellow/50 transition-all">
              <Receipt size={16} /> View Receipt
            </button>
          </div>
        )}
      </Modal>

      {/* ─── Receipt Modal ─── */}
      <Modal open={modalOpen === 'Receipt'} onClose={() => setModalOpen(null)} title="Transaction Receipt" className="max-w-md">
        {receiptTx && (
          <div className="space-y-4">
            <div className="text-center border-b border-bybit-border pb-4">
              <div className="w-12 h-12 rounded-xl bg-bybit-yellow flex items-center justify-center mx-auto mb-2 shadow-bybit-glow">
                <Receipt size={24} className="text-bybit-bg" />
              </div>
              <p className="text-sm font-bold text-white">UZU DIGITAL UNION</p>
              <p className="text-[10px] text-gray-500 font-mono">SWIFT GPI Transaction Receipt</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs"><span className="text-gray-500">Receipt #</span><span className="text-white font-mono">UZU-RCP-{receiptTx.id.padStart(6, '0')}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">Date</span><span className="text-white">{new Date(receiptTx.createdAt).toLocaleString()}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">Type</span><span className="text-white">{receiptTx.sourceCurrency === receiptTx.destinationCurrency ? 'Deposit' : 'Wire Transfer'}</span></div>
              <div className="border-t border-bybit-border my-2" />
              <div className="flex justify-between text-sm"><span className="text-gray-400">Amount Sent</span><span className="text-white font-bold">{formatAmount(Number(receiptTx.sourceAmount), receiptTx.sourceCurrency)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-400">Amount Received</span><span className="text-white font-bold">{formatAmount(Number(receiptTx.destinationAmount), receiptTx.destinationCurrency)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">Exchange Rate</span><span className="text-white">1 {receiptTx.sourceCurrency} = {receiptTx.exchangeRate} {receiptTx.destinationCurrency}</span></div>
              <div className="border-t border-bybit-border my-2" />
              <div className="flex justify-between text-xs"><span className="text-gray-500">SWIFT</span><span className="text-white font-mono">{receiptTx.destinationBankSwift}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">IBAN</span><span className="text-white font-mono text-[8px]">{receiptTx.destinationIban}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">Status</span><Badge variant={getStatusBadge(receiptTx.status) as any}>{receiptTx.status.replace('_', ' ')}</Badge></div>
              {receiptTx.blockchainTxHash && <div className="flex justify-between text-xs"><span className="text-gray-500">Blockchain</span><span className="text-bybit-yellow font-mono text-[8px]">{receiptTx.blockchainTxHash}</span></div>}
            </div>
            <div className="border-t border-bybit-border pt-3 text-center">
              <p className="text-[8px] text-gray-600 font-mono">Digitally signed • ISO 20022 compliant • SWIFT GPI tracked</p>
              <button onClick={() => copyToClipboard(`UZU-RCP-${receiptTx.id.padStart(6, '0')}`, 'rcp')} className="mt-2 text-[10px] text-bybit-yellow hover:underline flex items-center justify-center gap-1">
                {copied === 'rcp' ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy Receipt ID</>}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Statements Modal ─── */}
      <Modal open={modalOpen === 'Statements'} onClose={() => setModalOpen(null)} title="Account Statements">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Download statements for record-keeping, tax filing, and reconciliation.</p>
          <div className="flex gap-2 mb-4">
            <button className="px-4 py-2 rounded-lg bg-bybit-yellow/10 text-bybit-yellow border border-bybit-yellow/30 text-xs font-medium">Monthly</button>
            <button className="px-4 py-2 rounded-lg bg-bybit-elevated text-gray-400 border border-bybit-border text-xs font-medium">Quarterly</button>
            <button className="px-4 py-2 rounded-lg bg-bybit-elevated text-gray-400 border border-bybit-border text-xs font-medium">Annual</button>
          </div>
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {accountStatements.map(stmt => (
              <div key={stmt.id} className="flex items-center justify-between p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border hover:border-bybit-yellow/50 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400"><FileText size={18} /></div>
                  <div><p className="text-sm font-semibold text-white">{stmt.period}</p><p className="text-[10px] text-gray-500">{stmt.type.charAt(0).toUpperCase() + stmt.type.slice(1)} • Generated {stmt.generated}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">{stmt.size}</span>
                  <button className="p-2 rounded-lg bg-bybit-yellow/10 text-bybit-yellow hover:bg-bybit-yellow/20 transition-all"><Download size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* ─── Exchange Rates Modal ─── */}
      <Modal open={modalOpen === 'Exchange Rates'} onClose={() => setModalOpen(null)} title="Live Exchange Rates">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-emerald-400 mb-2"><RefreshCw size={12} className="animate-spin" /><span>Rates update every 10 seconds • 60+ currencies</span></div>
          <div className="max-h-96 overflow-y-auto space-y-1 pr-1">
            {Object.entries(rates).length > 0 ? Object.entries(rates).map(([pair, rate]) => (
              <div key={pair} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-bybit-elevated transition-colors">
                <div className="flex items-center gap-2"><Globe size={14} className="text-bybit-yellow" /><span className="text-sm font-medium text-white">{pair}</span></div>
                <div className="text-right"><p className="text-sm font-semibold text-white">{Number(rate.rate).toFixed(4)}</p><p className="text-[10px] text-gray-500">Bid: {Number(rate.bid).toFixed(4)} / Ask: {Number(rate.ask).toFixed(4)}</p></div>
              </div>
            )) : (() => {
              const realRates: Record<string, number> = {
                'EUR': 0.9222, 'GBP': 0.7920, 'JPY': 149.94, 'CHF': 0.8806, 'SGD': 1.3245,
                'AED': 3.6730, 'AUD': 1.5420, 'CAD': 1.3740, 'CNY': 7.2450, 'HKD': 7.8200,
                'INR': 83.45, 'KRW': 1325.0, 'MXN': 17.25, 'NGN': 1550.0, 'NOK': 10.85,
                'NZD': 1.6650, 'SEK': 10.52, 'TRY': 30.25, 'ZAR': 18.75, 'BRL': 5.12,
                'PHP': 56.20, 'THB': 35.80, 'MYR': 4.72, 'IDR': 15750, 'VND': 25450,
                'SAR': 3.75, 'QAR': 3.64, 'KWD': 0.308, 'OMR': 0.385, 'BHD': 0.376,
              };
              return COUNTRIES.filter((c, i, a) => a.findIndex(x => x.currency === c.currency) === i).slice(0, 30).map(c => {
                const rate = realRates[c.currency] || (1 + Math.random() * 100);
                return (
                  <div key={c.currency} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-bybit-elevated transition-colors">
                    <div className="flex items-center gap-2"><span className="text-sm">{c.flag}</span><span className="text-sm font-medium text-white">{c.currency}</span><span className="text-xs text-gray-500">{c.currencyName}</span></div>
                    <div className="text-right"><p className="text-sm font-semibold text-white">1 USD = {rate.toFixed(4)} {c.currency}</p></div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </Modal>

      {/* ─── Settings Modal ─── */}
      <Modal open={modalOpen === 'Settings'} onClose={() => setModalOpen(null)} title="Account Settings">
        <div className="space-y-6">
          {/* Security Settings */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Shield size={16} className="text-bybit-yellow" /> Security & Encryption</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                <div className="flex items-center gap-2"><Shield size={16} className="text-emerald-400" /><div><span className="text-sm text-white">End-to-End Encryption</span><p className="text-[10px] text-gray-500">AES-256-GCM • Data at Rest & In Transit</p></div></div>
                <Badge variant="confirmed">Active</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                <div className="flex items-center gap-2"><Fingerprint size={16} className="text-emerald-400" /><div><span className="text-sm text-white">Biometric MFA</span><p className="text-[10px] text-gray-500">Fingerprint • Face ID • Hardware Keys</p></div></div>
                <Badge variant="confirmed">Active</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                <div className="flex items-center gap-2"><Globe size={16} className="text-bybit-yellow" /><div><span className="text-sm text-white">SWIFT GPI Network</span><p className="text-[10px] text-gray-500">11,000+ Institutions • 200+ Countries</p></div></div>
                <Badge variant="confirmed">Connected</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                <div className="flex items-center gap-2"><Lock size={16} className="text-bybit-yellow" /><div><span className="text-sm text-white">TLS 1.3 Protection</span><p className="text-[10px] text-gray-500">Transport Layer Security • Latest Protocol</p></div></div>
                <Badge variant="confirmed">Active</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                <div className="flex items-center gap-2"><Smartphone size={16} className="text-bybit-yellow" /><div><span className="text-sm text-white">Two-Factor Authentication</span><p className="text-[10px] text-gray-500">Additional security layer</p></div></div>
                <Badge variant="confirmed">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
                <div className="flex items-center gap-2"><Lock size={16} className="text-bybit-yellow" /><div><span className="text-sm text-white">Transaction PIN</span><p className="text-[10px] text-gray-500">4-digit bank PIN</p></div></div>
                <Badge variant="confirmed">Set</Badge>
              </div>
            </div>
          </div>

          {/* Country / Currency Selector */}
          <div className="border-t border-bybit-border pt-4">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Globe size={16} className="text-bybit-yellow" /> Country & Currency Preference</h4>
            <p className="text-xs text-gray-500 mb-3">Select your preferred country. All balance displays will update to show the corresponding currency symbol.</p>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="text" placeholder="Search 60+ countries..." value={countrySearch} onChange={e => setCountrySearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bybit-elevated border border-bybit-border text-white text-sm focus:outline-none focus:border-bybit-yellow" />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1 rounded-xl border border-bybit-border p-2">
              {countryCurrencyInfo.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.currency.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.toLowerCase().includes(countrySearch.toLowerCase())).map(c => (
                <button key={c.code} onClick={() => { setSelectedCountry(c.code); setActiveAccount(c.currency); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${selectedCountry === c.code ? 'bg-bybit-yellow/10 text-bybit-yellow border border-bybit-yellow/30' : 'text-gray-400 hover:text-white hover:bg-bybit-elevated'}`}>
                  <div className="flex items-center gap-2"><span>{c.flag}</span><span>{c.name}</span></div>
                  <div className="flex items-center gap-2"><span className="text-xs font-mono">{c.currency}</span><span className="text-xs">{c.symbol}</span>{selectedCountry === c.code && <Check size={14} className="text-bybit-yellow" />}</div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-2">
              Active: {getCountryFlag(selectedCountry)} {getCountryName(selectedCountry)} ({countryCurrencyInfo.find(c => c.code === selectedCountry)?.currency || 'USD'}) — Symbol: <span className="text-bybit-yellow font-bold">{getCurrencySymbol(countryCurrencyInfo.find(c => c.code === selectedCountry)?.currency || 'USD')}</span>
            </p>
          </div>

          {/* Banking Services */}
          <div className="border-t border-bybit-border pt-4">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Building2 size={16} className="text-bybit-yellow" /> Banking Services</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border"><p className="text-[10px] text-gray-500 uppercase">Account Type</p><p className="text-sm font-semibold text-bybit-yellow mt-1">Global Premium</p></div>
              <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border"><p className="text-[10px] text-gray-500 uppercase">Daily Limit</p><p className="text-sm font-semibold text-white mt-1">$1,000,000</p></div>
              <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border"><p className="text-[10px] text-gray-500 uppercase">SWIFT Access</p><p className="text-sm font-semibold text-emerald-400 mt-1">Enabled</p></div>
              <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border"><p className="text-[10px] text-gray-500 uppercase">ISO 20022</p><p className="text-sm font-semibold text-emerald-400 mt-1">Compliant</p></div>
            </div>
          </div>

          {/* Support */}
          <div className="border-t border-bybit-border pt-4">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><HelpCircle size={16} className="text-bybit-yellow" /> Support</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border"><MessageCircle size={16} className="text-bybit-yellow" /><span className="text-sm text-gray-300">24/7 Live Chat — support@uzudigitalunion.com</span></div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border"><Phone size={16} className="text-bybit-yellow" /><span className="text-sm text-gray-300">+1 (800) UZU-BANK</span></div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border"><Mail size={16} className="text-bybit-yellow" /><span className="text-sm text-gray-300">support@uzudigitalunion.com</span></div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border"><MapPin size={16} className="text-bybit-yellow" /><span className="text-sm text-gray-300">London • New York • Singapore • Dubai</span></div>
            </div>
          </div>
        </div>
      </Modal>

      {/* ─── Report Issues Modal ─── */}
      <Modal open={modalOpen === 'Report Issues'} onClose={() => setModalOpen(null)} title="Contact Support">
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
            <p className="text-sm text-gray-400 mb-4">Our support team is available 24/7. Reach us at <span className="text-bybit-yellow">support@uzudigitalunion.com</span> or use the form below.</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-bybit-bg/50 border border-bybit-border"><AlertTriangle size={16} className="text-bybit-yellow" /><span className="text-sm text-gray-300">Report Unauthorized Transaction</span></div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-bybit-bg/50 border border-bybit-border"><Shield size={16} className="text-emerald-400" /><span className="text-sm text-gray-300">Security Concern</span></div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-bybit-bg/50 border border-bybit-border"><HelpCircle size={16} className="text-bybit-yellow" /><span className="text-sm text-gray-300">General Inquiry</span></div>
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Subject</label>
            <input type="text" placeholder="Brief description" className="w-full px-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-white text-sm focus:outline-none focus:border-bybit-yellow" />
          </div>
          <div className="space-y-3">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Description</label>
            <textarea rows={4} placeholder="Provide detailed information..." className="w-full px-4 py-3 rounded-xl bg-bybit-elevated border border-bybit-border text-white text-sm focus:outline-none focus:border-bybit-yellow resize-none" />
          </div>
          <button className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-bybit-yellow text-bybit-bg font-bold text-sm hover:brightness-110 transition-all shadow-bybit-glow">
            <Send size={16} /> Submit to support@uzudigitalunion.com
          </button>
          <div className="p-3 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
            <p className="text-[10px] text-gray-500">For urgent issues, call <span className="text-bybit-yellow">+1 (800) UZU-BANK</span> or email <span className="text-bybit-yellow">support@uzudigitalunion.com</span>. Average response time: &lt; 15 minutes.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}