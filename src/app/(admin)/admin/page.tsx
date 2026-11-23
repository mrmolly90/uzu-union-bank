'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Users, Wallet, ArrowUpRight, ArrowDownLeft, Bell, LogOut, Search, X, Check, AlertTriangle, DollarSign, RefreshCw, Send, Clock, FileText, BarChart3, Activity, UserCheck, TrendingUp, Globe, Building2, Ban, ToggleLeft, ToggleRight, RotateCcw, Bitcoin, Copy, ExternalLink, Edit3, Plus, Trash2, Loader2 } from 'lucide-react';

// Simple country→currency lookup for admin panel
const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD', GB: 'GBP', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR',
  JP: 'JPY', CH: 'CHF', SG: 'SGD', AE: 'AED', NG: 'NGN', ZA: 'ZAR',
  KR: 'KRW', IN: 'INR', BR: 'BRL', CN: 'CNY', CA: 'CAD', AU: 'AUD',
  MX: 'MXN', RU: 'RUB', TR: 'TRY', AR: 'ARS', EG: 'EGP', KE: 'KES',
  GH: 'GHS', MA: 'MAD', TN: 'TND', DZ: 'DZD', PK: 'PKR', BD: 'BDT',
  LK: 'LKR', NP: 'NPR', AF: 'AFN', IQ: 'IQD', SA: 'SAR', QA: 'QAR',
  KW: 'KWD', OM: 'OMR', BH: 'BHD', JO: 'JOD', LB: 'LBP', IL: 'ILS',
  HK: 'HKD', TW: 'TWD', TH: 'THB', VN: 'VND', ID: 'IDR', MY: 'MYR',
  PH: 'PHP', NZ: 'NZD', NO: 'NOK', SE: 'SEK', DK: 'DKK', PL: 'PLN',
  CZ: 'CZK', HU: 'HUF', RO: 'RON', BG: 'BGN', HR: 'HRK', IS: 'ISK',
  UA: 'UAH', ET: 'ETB', TZ: 'TZS', UG: 'UGX', ZM: 'ZMW', AO: 'AOA',
  VE: 'VES', UY: 'UYU', PE: 'PEN', CO: 'COP', CL: 'CLP',
};
function getCurrencyByCountryCode(code: string): string { return COUNTRY_CURRENCY[code] || 'USD'; }

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  countryCode: string;
  kycStatus: string;
  transferPaused?: boolean;
  createdAt: string;
  accounts: { id: string; currency: string; balance: number; accountNumber: string; accountType: string; isActive: boolean }[];
  notifications?: any[];
  totalBalance?: number;
  checkingBalance?: number;
  savingsBalance?: number;
  notificationCount?: number;
}

interface AdminTransaction {
  id: string;
  sourceAccountId: string;
  destinationBankSwift: string;
  destinationBankName: string;
  destinationIban: string;
  sourceAmount: number;
  sourceCurrency: string;
  destinationAmount: number;
  destinationCurrency: string;
  exchangeRate: number;
  fee: number;
  status: string;
  failureReason: string | null;
  createdAt: string;
  initiatedBy: { id: string; fullName: string; email: string };
  sourceAccount: { accountNumber: string; accountType: string };
}

export default function AdminPanelPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<any>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [txForm, setTxForm] = useState({ userId: '', type: 'credit', amount: '', currency: 'USD', description: '', accountType: 'CHECKING' });
  const [txLoading, setTxLoading] = useState(false);
  const [txSuccess, setTxSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [accountLoading, setAccountLoading] = useState<string | null>(null);
  const [txSearch, setTxSearch] = useState('');

  // Crypto Control State — Extended with more assets
  const [cryptoAddresses, setCryptoAddresses] = useState<any[]>([]);
  const [cryptoForm, setCryptoForm] = useState({ symbol: '', name: '', network: '', address: '', minDeposit: '' });
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [cryptoSuccess, setCryptoSuccess] = useState('');
  const [editingCrypto, setEditingCrypto] = useState<string | null>(null);
  const [copiedCrypto, setCopiedCrypto] = useState<string | null>(null);
  const [cryptoSymbolFilter, setCryptoSymbolFilter] = useState('');

  // Snapshot verification timestamp
  const [snapshotTime, setSnapshotTime] = useState<string>('');

  // Crypto Deposit Approval State
  const [cryptoDeposits, setCryptoDeposits] = useState<any[]>([]);
  const [cryptoDepositLoading, setCryptoDepositLoading] = useState(false);
  const [cryptoDepositActionLoading, setCryptoDepositActionLoading] = useState<string | null>(null);

  const CRYPTO_PRESETS = [
    { symbol: 'BTC', name: 'Bitcoin', network: 'Bitcoin', minDeposit: '0.001 BTC' },
    { symbol: 'ETH', name: 'Ethereum', network: 'Ethereum (ERC-20)', minDeposit: '0.01 ETH' },
    { symbol: 'USDC', name: 'USD Coin', network: 'Ethereum (ERC-20)', minDeposit: '10 USDC' },
    { symbol: 'USDT', name: 'Tether', network: 'Ethereum (ERC-20)', minDeposit: '10 USDT' },
    { symbol: 'SOL', name: 'Solana', network: 'Solana', minDeposit: '0.1 SOL' },
    { symbol: 'BNB', name: 'BNB', network: 'BSC (BEP-20)', minDeposit: '0.05 BNB' },
    { symbol: 'XRP', name: 'Ripple', network: 'XRP Ledger', minDeposit: '10 XRP' },
    { symbol: 'ADA', name: 'Cardano', network: 'Cardano', minDeposit: '5 ADA' },
    { symbol: 'DOGE', name: 'Dogecoin', network: 'Dogecoin', minDeposit: '50 DOGE' },
    { symbol: 'DOT', name: 'Polkadot', network: 'Polkadot', minDeposit: '1 DOT' },
    { symbol: 'AVAX', name: 'Avalanche', network: 'Avalanche C-Chain', minDeposit: '0.5 AVAX' },
    { symbol: 'MATIC', name: 'Polygon', network: 'Polygon', minDeposit: '10 MATIC' },
    { symbol: 'LINK', name: 'Chainlink', network: 'Ethereum (ERC-20)', minDeposit: '5 LINK' },
    { symbol: 'UNI', name: 'Uniswap', network: 'Ethereum (ERC-20)', minDeposit: '5 UNI' },
    { symbol: 'ATOM', name: 'Cosmos', network: 'Cosmos', minDeposit: '1 ATOM' },
  ];

  useEffect(() => {
    const t = localStorage.getItem('uzu-admin-token');
    const a = localStorage.getItem('uzu-admin-user');
    if (!t || !a) { router.push('/admin/login'); return; }
    setToken(t);
    setAdmin(JSON.parse(a));
    fetchAllData(t);
    // Auto-refresh snapshot every 15s so new users appear instantly
    const interval = setInterval(() => {
      const storedToken = localStorage.getItem('uzu-admin-token');
      if (storedToken) fetchUsers(storedToken);
    }, 15000);
    return () => clearInterval(interval);
  }, [router]);

  const fetchAllData = async (t: string) => {
    // Clear stale state before fetching fresh snapshot data
    setUsers([]);
    setTransactions([]);
    await Promise.all([
      fetchUsers(t),
      fetchTransactions(t),
      fetchCryptoAddresses(t),
      fetchCryptoDeposits(t),
    ]);
  };

  const fetchUsers = async (t: string) => {
    try {
      // Always fetch fresh from DB snapshot — never use cached/old memory.
      // This ensures deleted users disappear and new users appear immediately.
      const res = await fetch('/api/admin/snapshot', { headers: { Authorization: `Bearer ${t}` } });
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      if (data.snapshot?.users) {
        setUsers(data.snapshot.users);
        if (data.snapshot.timestamp) setSnapshotTime(data.snapshot.timestamp);
      } else if (data.users) {
        setUsers(data.users);
      }
      setLoading(false);
    } catch {
      // On error, clear users to prevent stale data display
      setUsers([]);
      localStorage.removeItem('uzu-admin-token');
      router.push('/admin/login');
    }
  };

  const approveKyc = async (userId: string, kycStatus: string) => {
    if (!token) return;
    setStatusLoading(userId);
    try {
      const res = await fetch('/api/admin/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, kycStatus }),
      });
      if (!res.ok) throw new Error('Failed to update KYC');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, kycStatus } : u));
    } catch (err) {
      console.error('KYC update error:', err);
    } finally {
      setStatusLoading(null);
    }
  };

  const fetchTransactions = async (t: string) => {
    try {
      const res = await fetch('/api/admin/transactions', { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch {}
  };

  const fetchCryptoAddresses = async (t: string) => {
    try {
      const res = await fetch('/api/admin/crypto', { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) {
        const data = await res.json();
        setCryptoAddresses(data);
      }
    } catch {}
  };

  const fetchCryptoDeposits = async (t: string) => {
    try {
      const res = await fetch('/api/admin/crypto/deposits', { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) {
        const data = await res.json();
        setCryptoDeposits(data);
      }
    } catch {}
  };

  const handleCryptoDepositAction = async (depositId: string, action: string) => {
    if (!token) return;
    setCryptoDepositActionLoading(depositId);
    try {
      const res = await fetch('/api/admin/crypto/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ depositId, action }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Action failed');
      }
      // Refresh deposits and users (balance may have changed on approval)
      await Promise.all([fetchCryptoDeposits(token), fetchUsers(token), fetchTransactions(token)]);
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setCryptoDepositActionLoading(null);
    }
  };

  const handleSnapshotRefresh = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.snapshot) {
          setSnapshotTime(data.snapshot.timestamp);
        }
        fetchAllData(token);
      }
    } catch {}
  };

  const handleTransaction = async () => {
    if (!token || !txForm.userId || !txForm.amount) return;
    setTxLoading(true);
    setTxSuccess('');
    try {
      const res = await fetch('/api/admin/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...txForm, amount: parseFloat(txForm.amount), accountType: txForm.accountType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transaction failed');
      setTxSuccess(`${txForm.type === 'credit' ? 'Credited' : 'Debited'} ${parseFloat(txForm.amount).toLocaleString()} ${txForm.currency} to ${selectedUser?.fullName}`);
      setTxForm({ ...txForm, amount: '', description: '' });
      // Inline snapshot data from mutation response — updates admin panel in milliseconds
      if (data.snapshot?.timestamp) setSnapshotTime(data.snapshot.timestamp);
      await Promise.all([fetchUsers(token), fetchTransactions(token)]);
    } catch (err: any) {
      setTxSuccess(`❌ ${err.message}`);
      setTimeout(() => setTxSuccess(''), 5000);
    } finally {
      setTxLoading(false);
    }
  };

  const handleStatusChange = async (transactionId: string, newStatus: string, failureReason?: string) => {
    if (!token) return;
    setStatusLoading(transactionId);
    try {
      const res = await fetch('/api/admin/transactions/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transactionId, status: newStatus, failureReason }),
      });
      if (res.ok) {
        // Force Blob sync after status change so user sees updated tx status
        try {
          const snapRes = await fetch('/api/admin/snapshot', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (snapRes.ok) {
            const snapData = await snapRes.json();
            if (snapData.snapshot) setSnapshotTime(snapData.snapshot.timestamp);
          }
        } catch {}
        fetchAllData(token);
      }
    } catch {}
    finally { setStatusLoading(null); }
  };

  const handleAccountToggle = async (accountId: string, isActive: boolean) => {
    if (!token) return;
    setAccountLoading(accountId);
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accountId, isActive }),
      });
      if (res.ok) {
        try {
          const snapRes = await fetch('/api/admin/snapshot', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (snapRes.ok) {
            const snapData = await snapRes.json();
            if (snapData.snapshot) setSnapshotTime(snapData.snapshot.timestamp);
          }
        } catch {}
        fetchAllData(token);
      }
    } catch {}
    finally { setAccountLoading(null); }
  };

  const handlePauseTransfer = async (userId: string, transferPaused: boolean) => {
    if (!token) return;
    setStatusLoading(`pause-${userId}`);
    try {
      const res = await fetch('/api/admin/users/pause-transfer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, transferPaused }),
      });
      if (res.ok) {
        try {
          const snapRes = await fetch('/api/admin/snapshot', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (snapRes.ok) {
            const snapData = await snapRes.json();
            if (snapData.snapshot) setSnapshotTime(snapData.snapshot.timestamp);
          }
        } catch {}
        fetchAllData(token);
      }
    } catch {}
    finally { setStatusLoading(null); }
  };

  const handleDeleteUser = async (userId: string, fullName: string) => {
    if (!token) return;
    if (!confirm(`⚠️ Permanently delete user "${fullName}"?\n\nThis will remove ALL their accounts, transactions, and data. They can re-register.`)) return;
    setStatusLoading(`delete-${userId}`);
    try {
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Delete failed');
      }
      // Force snapshot refresh so deleted user disappears immediately
      try {
        const snapRes = await fetch('/api/admin/snapshot', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (snapRes.ok) {
          const snapData = await snapRes.json();
          if (snapData.snapshot) setSnapshotTime(snapData.snapshot.timestamp);
        }
      } catch {}
      fetchAllData(token);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
    finally { setStatusLoading(null); }
  };

  const handleCryptoSave = async () => {
    if (!token || !cryptoForm.symbol || !cryptoForm.name || !cryptoForm.network || !cryptoForm.address) return;
    setCryptoLoading(true);
    setCryptoSuccess('');
    try {
      const res = await fetch('/api/admin/crypto', {
        method: editingCrypto ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editingCrypto ? { id: editingCrypto, ...cryptoForm } : cryptoForm),
      });
      if (!res.ok) throw new Error('Failed');
      setCryptoSuccess(editingCrypto ? 'Crypto address updated!' : 'Crypto address added!');
      setCryptoForm({ symbol: '', name: '', network: '', address: '', minDeposit: '' });
      setEditingCrypto(null);
      // Force Blob sync so users see new addresses in their snapshot instantly
      try {
        const snapRes = await fetch('/api/admin/snapshot', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (snapRes.ok) {
          const snapData = await snapRes.json();
          if (snapData.snapshot) setSnapshotTime(snapData.snapshot.timestamp);
        }
      } catch {}
      fetchCryptoAddresses(token);
    } catch { setCryptoSuccess('Operation failed'); }
    finally { setCryptoLoading(false); }
  };

  const handleCryptoEdit = (addr: any) => {
    setCryptoForm({ symbol: addr.symbol, name: addr.name, network: addr.network, address: addr.address, minDeposit: addr.minDeposit || '' });
    setEditingCrypto(addr.id);
  };

  const handleCryptoDelete = async (id: string) => {
    if (!token) return;
    setCryptoLoading(true);
    try {
      const res = await fetch('/api/admin/crypto', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, isActive: false }),
      });
      if (res.ok) fetchCryptoAddresses(token);
    } catch {}
    finally { setCryptoLoading(false); }
  };

  const logout = () => {
    localStorage.removeItem('uzu-admin-token');
    localStorage.removeItem('uzu-admin-user');
    router.push('/admin/login');
  };

  const filteredUsers = users.filter(u =>
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTransactions = transactions.filter(tx =>
    tx.id.toLowerCase().includes(txSearch.toLowerCase()) ||
    tx.destinationBankSwift.toLowerCase().includes(txSearch.toLowerCase()) ||
    tx.destinationBankName.toLowerCase().includes(txSearch.toLowerCase()) ||
    tx.initiatedBy?.fullName?.toLowerCase().includes(txSearch.toLowerCase())
  );

  const totalBalance = users.reduce((sum, u) => sum + (u.totalBalance ?? u.accounts.reduce((s, a) => s + Number(a.balance), 0)), 0);
  const totalChecking = users.reduce((sum, u) => sum + (u.checkingBalance ?? 0), 0);
  const totalSavings = users.reduce((sum, u) => sum + (u.savingsBalance ?? 0), 0);
  const totalUsers = users.length;
  const pendingTx = transactions.filter(t => ['INITIATED', 'HASHED', 'MULTISIG_PENDING'].includes(t.status)).length;
  const settledTx = transactions.filter(t => t.status === 'SETTLED').length;

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      INITIATED: 'bg-blue-500/10 text-blue-400',
      HASHED: 'bg-purple-500/10 text-purple-400',
      MULTISIG_PENDING: 'bg-amber-500/10 text-amber-400',
      CLEARED: 'bg-cyan-500/10 text-cyan-400',
      SETTLED: 'bg-emerald-500/10 text-emerald-400',
      FAILED: 'bg-red-500/10 text-red-400',
      REVERSED: 'bg-orange-500/10 text-orange-400',
    };
    return map[status] || 'bg-slate-500/10 text-slate-400';
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-slate-800/90 backdrop-blur-xl border-b border-slate-700">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center">
              <Shield size={18} className="text-slate-900" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Admin Panel</h1>
              <p className="text-[10px] text-slate-400">{admin?.fullName} • {admin?.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20" title="DB snapshot verified">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] text-emerald-300 font-mono">DB Live</span>
            </div>
            <button onClick={() => { fetchAllData(token!); }} className="p-2 rounded-lg bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <RefreshCw size={16} />
            </button>
            <button onClick={logout} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors">
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Stats — from DB snapshot */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400"><Users size={20} /></div>
              <div><p className="text-xs text-slate-400">Total Users</p><p className="text-xl font-bold text-white">{totalUsers}</p></div>
            </div>
          </div>
          <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400"><Wallet size={20} /></div>
              <div>
                <p className="text-xs text-slate-400">Total Deposits</p>
                <p className="text-xl font-bold text-white">${totalBalance.toLocaleString()}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] text-blue-400">CHK ${totalChecking.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-600">|</span>
                  <span className="text-[9px] text-emerald-400">SAV ${totalSavings.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400"><Clock size={20} /></div>
              <div><p className="text-xs text-slate-400">Pending</p><p className="text-xl font-bold text-white">{pendingTx}</p></div>
            </div>
          </div>
          <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400"><Check size={20} /></div>
              <div><p className="text-xs text-slate-400">Settled</p><p className="text-xl font-bold text-white">{settledTx}</p></div>
            </div>
          </div>
        </div>

        {/* DB Snapshot Status — All registered users displayed from live DB */}
        <div className="flex items-center justify-between bg-slate-800/60 rounded-xl border border-slate-700/50 p-3">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>DB Snapshot Active — <strong className="text-white">{totalUsers}</strong> registered users displayed from live database</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSnapshotRefresh}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold text-xs hover:brightness-110 transition-all">
              <RefreshCw size={14} /> Sync & Refresh
            </button>
          </div>
          {snapshotTime && <span className="text-emerald-400 text-[10px] ml-2 font-mono">Verified: {new Date(snapshotTime).toLocaleTimeString()}</span>}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700 pb-3 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'funds', label: 'Fund Control', icon: DollarSign },
            { id: 'transactions', label: 'Transactions', icon: Clock },
            { id: 'accounts', label: 'Accounts', icon: Building2 },
            { id: 'deposits', label: 'Crypto Deposits', icon: Bitcoin },
            { id: 'crypto', label: 'Crypto Control', icon: ExternalLink },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white'}`}>
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Activity size={16} className="text-amber-400" /> Recent Users</h3>
              <div className="space-y-2">
                {users.slice(0, 5).map(u => (
                  <div key={u.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">{u.fullName.charAt(0)}</div>
                      <div><p className="text-sm text-white">{u.fullName}</p><p className="text-[10px] text-slate-500">{u.email}</p></div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.kycStatus === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{u.kycStatus}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Clock size={16} className="text-amber-400" /> Recent Transactions</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {transactions.slice(0, 8).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                        {tx.sourceCurrency === tx.destinationCurrency ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                      </div>
                      <div>
                        <p className="text-xs text-white font-medium">{tx.destinationBankName || tx.destinationBankSwift}</p>
                        <p className="text-[9px] text-slate-500">{tx.initiatedBy?.fullName || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-white">${Number(tx.sourceAmount).toLocaleString()}</p>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded ${getStatusColor(tx.status)}`}>{tx.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                ))}
                {transactions.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No transactions yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" placeholder="Search users..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-white text-sm focus:border-amber-500 outline-none" />
            </div>
            <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-700 text-slate-400 text-[10px] uppercase tracking-wider">
                    <th className="text-left p-3">User</th><th className="text-left p-3">Email</th><th className="text-left p-3">Accounts</th><th className="text-right p-3">Total Balance</th><th className="text-center p-3">KYC</th><th className="text-center p-3">Actions</th>
                  </tr></thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                        <td className="p-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">{u.fullName.charAt(0)}</div><span className="text-white font-medium">{u.fullName}</span></div></td>
                        <td className="p-3 text-slate-400 text-xs">{u.email}</td>
                        <td className="p-3"><span className="text-xs text-slate-400">{u.accounts.length} accounts</span></td>
                        <td className="p-3 text-right text-white font-semibold">${u.accounts.reduce((s, a) => s + Number(a.balance), 0).toLocaleString()}</td>
                        <td className="p-3 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.kycStatus === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{u.kycStatus}</span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {u.kycStatus !== 'VERIFIED' ? (
                              <button onClick={() => approveKyc(u.id, 'VERIFIED')} disabled={statusLoading === u.id}
                                className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[9px] font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50 flex items-center gap-1">
                                {statusLoading === u.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                Approve
                              </button>
                            ) : (
                              <button onClick={() => approveKyc(u.id, 'PENDING')} disabled={statusLoading === u.id}
                                className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-[9px] font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center gap-1">
                                {statusLoading === u.id ? <Loader2 size={10} className="animate-spin" /> : <Ban size={10} />}
                                Revoke
                              </button>
                            )}
                            <button onClick={() => { setSelectedUser(u); setTxForm({ ...txForm, userId: u.id }); setActiveTab('funds'); }}
                              className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-[9px] font-medium hover:bg-amber-500/20 transition-colors">
                              Funds
                            </button>
                            <button onClick={() => handlePauseTransfer(u.id, !(u as any).transferPaused)} disabled={statusLoading === `pause-${u.id}`}
                              className={`px-2 py-1 rounded-lg text-[9px] font-medium transition-colors disabled:opacity-50 ${(u as any).transferPaused ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'}`}>
                              {(u as any).transferPaused ? 'Resume' : 'Pause'}
                            </button>
                            <button onClick={() => handleDeleteUser(u.id, u.fullName)} disabled={statusLoading === `delete-${u.id}`}
                              className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-[9px] font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center gap-1">
                              {statusLoading === `delete-${u.id}` ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Fund Control Tab */}
        {activeTab === 'funds' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><DollarSign size={16} className="text-amber-400" /> Push Transaction</h3>
              
              {txSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-4">
                  <Check size={16} /> {txSuccess}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Select User</label>
                  <select value={txForm.userId} onChange={e => { const u = users.find(u => u.id === e.target.value); setSelectedUser(u || null); setTxForm({ ...txForm, userId: e.target.value, currency: u ? getCurrencyByCountryCode(u.countryCode) : 'USD' }); }}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white text-sm focus:border-amber-500 outline-none">
                    <option value="">Select a user...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>)}
                  </select>
                </div>

                {selectedUser && (
                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700">
                    <p className="text-xs text-slate-400">Selected: <span className="text-white font-semibold">{selectedUser.fullName}</span></p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedUser.accounts.map(a => (
                        <span key={a.id} className={`text-[10px] px-2 py-0.5 rounded-full ${a.isActive === false ? 'bg-red-900/30 text-red-400 line-through' : 'bg-slate-700 text-slate-300'}`}>
                          {a.currency}: ${Number(a.balance).toLocaleString()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">Type</label>
                    <select value={txForm.type} onChange={e => setTxForm({ ...txForm, type: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white text-sm focus:border-amber-500 outline-none">
                      <option value="credit">Credit (Income)</option>
                      <option value="debit">Debit (Withdraw)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">Account</label>
                    <select value={txForm.accountType} onChange={e => setTxForm({ ...txForm, accountType: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white text-sm focus:border-amber-500 outline-none">
                      <option value="CHECKING">Checking</option>
                      <option value="SAVINGS">Savings</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">Currency</label>
                    <select value={txForm.currency} onChange={e => setTxForm({ ...txForm, currency: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white text-sm focus:border-amber-500 outline-none">
                      <option value="USD">🇺🇸 $ USD</option><option value="EUR">🇪🇺 € EUR</option><option value="GBP">🇬🇧 £ GBP</option>
                      <option value="JPY">🇯🇵 ¥ JPY</option><option value="CHF">🇨🇭 Fr CHF</option><option value="SGD">🇸🇬 S$ SGD</option>
                      <option value="AED">🇦🇪 د.إ AED</option><option value="NGN">🇳🇬 ₦ NGN</option><option value="ZAR">🇿🇦 R ZAR</option>
                      <option value="CAD">🇨🇦 C$ CAD</option><option value="AUD">🇦🇺 A$ AUD</option><option value="BRL">🇧🇷 R$ BRL</option>
                      <option value="INR">🇮🇳 ₹ INR</option><option value="CNY">🇨🇳 ¥ CNY</option><option value="KRW">🇰🇷 ₩ KRW</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Amount</label>
                  <input type="number" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })} placeholder="0.00"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white text-sm focus:border-amber-500 outline-none" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Description</label>
                  <input type="text" value={txForm.description} onChange={e => setTxForm({ ...txForm, description: e.target.value })} placeholder="e.g. Salary Deposit, Bonus Payment"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white text-sm focus:border-amber-500 outline-none" />
                </div>

                <button onClick={handleTransaction} disabled={txLoading || !txForm.userId || !txForm.amount}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-900 font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50">
                  {txLoading ? <><div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" /> Processing…</>
                    : <><Send size={16} /> {txForm.type === 'credit' ? 'Credit Funds' : 'Debit Funds'}</>}
                </button>
              </div>
            </div>

            <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Bell size={16} className="text-amber-400" /> User Notifications</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {users.slice(0, 10).map(u => u.notifications?.slice(0, 3).map((n: any) => (
                  <div key={n.id} className="p-3 rounded-xl bg-slate-900/50 border border-slate-700">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-white">{n.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${n.type === 'CREDIT' ? 'bg-emerald-500/10 text-emerald-400' : n.type === 'DEBIT' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>{n.type}</span>
                    </div>
                    <p className="text-[10px] text-slate-400">{n.message}</p>
                    <p className="text-[8px] text-slate-600 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                )))}
                {users.every(u => !u.notifications?.length) && <p className="text-sm text-slate-500 text-center py-8">No notifications yet. Push a transaction to create one.</p>}
              </div>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" placeholder="Search by ID, bank, SWIFT, or user..." value={txSearch} onChange={e => setTxSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-white text-sm focus:border-amber-500 outline-none" />
            </div>
            <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-700 text-slate-400 text-[10px] uppercase tracking-wider">
                    <th className="text-left p-3">ID</th>
                    <th className="text-left p-3">User</th>
                    <th className="text-left p-3">Destination</th>
                    <th className="text-right p-3">Amount</th>
                    <th className="text-right p-3">Fee</th>
                    <th className="text-center p-3">Status</th>
                    <th className="text-center p-3">Actions</th>
                  </tr></thead>
                  <tbody>
                    {filteredTransactions.map(tx => (
                      <tr key={tx.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                        <td className="p-3"><span className="text-[10px] font-mono text-slate-400">{tx.id.slice(0, 8)}...</span></td>
                        <td className="p-3"><span className="text-xs text-white">{tx.initiatedBy?.fullName || 'Unknown'}</span></td>
                        <td className="p-3">
                          <div>
                            <p className="text-xs text-white">{tx.destinationBankName || tx.destinationBankSwift}</p>
                            <p className="text-[9px] text-slate-500 font-mono">{tx.destinationIban.slice(0, 12)}...</p>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <p className="text-xs font-semibold text-white">${Number(tx.sourceAmount).toLocaleString()}</p>
                          <p className="text-[9px] text-slate-500">{tx.sourceCurrency} → {tx.destinationCurrency}</p>
                        </td>
                        <td className="p-3 text-right">
                          <p className="text-xs text-slate-400">${Number(tx.fee).toLocaleString()}</p>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${getStatusColor(tx.status)}`}>
                            {tx.status.replace('_', ' ')}
                          </span>
                          {tx.failureReason && <p className="text-[8px] text-red-400 mt-0.5">{tx.failureReason}</p>}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {['INITIATED', 'HASHED', 'MULTISIG_PENDING'].includes(tx.status) && (
                              <>
                                <button onClick={() => handleStatusChange(tx.id, 'CLEARED')} disabled={statusLoading === tx.id}
                                  className="px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 text-[9px] hover:bg-cyan-500/20 transition-colors disabled:opacity-50">
                                  Clear
                                </button>
                                <button onClick={() => handleStatusChange(tx.id, 'SETTLED')} disabled={statusLoading === tx.id}
                                  className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-[9px] hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                                  Settle
                                </button>
                                <button onClick={() => {
                                  const reason = prompt('Failure reason:');
                                  if (reason) handleStatusChange(tx.id, 'FAILED', reason);
                                }} disabled={statusLoading === tx.id}
                                  className="px-2 py-1 rounded bg-red-500/10 text-red-400 text-[9px] hover:bg-red-500/20 transition-colors disabled:opacity-50">
                                  Fail
                                </button>
                              </>
                            )}
                            {['CLEARED'].includes(tx.status) && (
                              <button onClick={() => handleStatusChange(tx.id, 'SETTLED')} disabled={statusLoading === tx.id}
                                className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-[9px] hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                                Settle
                              </button>
                            )}
                            {['INITIATED', 'HASHED', 'MULTISIG_PENDING', 'CLEARED'].includes(tx.status) && (
                              <button onClick={() => {
                                const reason = prompt('Reversal reason:');
                                if (reason) handleStatusChange(tx.id, 'REVERSED', reason);
                              }} disabled={statusLoading === tx.id}
                                className="px-2 py-1 rounded bg-orange-500/10 text-orange-400 text-[9px] hover:bg-orange-500/20 transition-colors disabled:opacity-50">
                                <RotateCcw size={10} />
                              </button>
                            )}
                            {statusLoading === tx.id && <div className="w-3 h-3 border border-amber-500 border-t-transparent rounded-full animate-spin" />}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <tr><td colSpan={7} className="p-8 text-center text-sm text-slate-500">No transactions found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Accounts Tab */}
        {activeTab === 'accounts' && (
          <div className="space-y-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" placeholder="Search users..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-white text-sm focus:border-amber-500 outline-none" />
            </div>
            <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-700 text-slate-400 text-[10px] uppercase tracking-wider">
                    <th className="text-left p-3">User</th>
                    <th className="text-left p-3">Account</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-right p-3">Balance</th>
                    <th className="text-center p-3">Status</th>
                    <th className="text-center p-3">Toggle</th>
                  </tr></thead>
                  <tbody>
                    {filteredUsers.map(u => u.accounts.map(a => (
                      <tr key={a.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                        <td className="p-3"><span className="text-xs text-white">{u.fullName}</span></td>
                        <td className="p-3"><span className="text-[10px] font-mono text-slate-400">{a.accountNumber}</span></td>
                        <td className="p-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.accountType === 'CHECKING' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            {a.accountType}
                          </span>
                        </td>
                        <td className="p-3 text-right"><span className="text-xs font-semibold text-white">${Number(a.balance).toLocaleString()}</span></td>
                        <td className="p-3 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.isActive !== false ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {a.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button onClick={() => handleAccountToggle(a.id, a.isActive === false ? true : false)} disabled={accountLoading === a.id}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                              a.isActive !== false 
                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' 
                                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            } disabled:opacity-50`}>
                            {accountLoading === a.id ? (
                              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            ) : a.isActive !== false ? (
                              <><Ban size={10} /> Deactivate</>
                            ) : (
                              <><Check size={10} /> Activate</>
                            )}
                          </button>
                        </td>
                      </tr>
                    )))}
                    {filteredUsers.length === 0 && (
                      <tr><td colSpan={6} className="p-8 text-center text-sm text-slate-500">No users found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Crypto Deposits Tab */}
        {activeTab === 'deposits' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Bitcoin size={16} className="text-amber-400" />
                Crypto Deposit Requests
              </h3>
              <span className="text-xs text-slate-400">{cryptoDeposits.filter(d => d.status === 'PENDING').length} pending</span>
            </div>
            <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-700 text-slate-400 text-[10px] uppercase tracking-wider">
                    <th className="text-left p-3">User</th>
                    <th className="text-left p-3">Asset</th>
                    <th className="text-right p-3">Amount</th>
                    <th className="text-left p-3">TX Hash</th>
                    <th className="text-center p-3">Status</th>
                    <th className="text-center p-3">Date</th>
                    <th className="text-center p-3">Actions</th>
                  </tr></thead>
                  <tbody>
                    {cryptoDeposits.length === 0 ? (
                      <tr><td colSpan={7} className="p-8 text-center text-sm text-slate-500">No crypto deposit requests yet</td></tr>
                    ) : cryptoDeposits.map(d => (
                      <tr key={d.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">{d.user?.fullName?.charAt(0) || '?'}</div>
                            <div>
                              <p className="text-xs text-white font-medium">{d.user?.fullName || 'Unknown'}</p>
                              <p className="text-[9px] text-slate-500">{d.user?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-xs font-bold text-amber-400">{d.symbol}</span>
                        </td>
                        <td className="p-3 text-right">
                          <span className="text-xs font-semibold text-white">{d.amount} {d.symbol}</span>
                        </td>
                        <td className="p-3">
                          <code className="text-[9px] font-mono text-slate-400">{d.blockchainTxHash?.slice(0, 20)}...</code>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            d.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' :
                            d.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>{d.status}</span>
                        </td>
                        <td className="p-3 text-center text-[10px] text-slate-400">
                          {new Date(d.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-center">
                          {d.status === 'PENDING' ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleCryptoDepositAction(d.id, 'APPROVED')} disabled={cryptoDepositActionLoading === d.id}
                                className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50 flex items-center gap-1">
                                {cryptoDepositActionLoading === d.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                Approve
                              </button>
                              <button onClick={() => handleCryptoDepositAction(d.id, 'REJECTED')} disabled={cryptoDepositActionLoading === d.id}
                                className="px-2 py-1 rounded bg-red-500/10 text-red-400 text-[9px] font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center gap-1">
                                {cryptoDepositActionLoading === d.id ? <Loader2 size={10} className="animate-spin" /> : <Ban size={10} />}
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Crypto Control Tab */}
        {activeTab === 'crypto' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Add/Edit Crypto Address */}
            <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Bitcoin size={16} className="text-amber-400" />
                {editingCrypto ? 'Edit Crypto Address' : 'Add Crypto Address'}
              </h3>

              {cryptoSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-4">
                  <Check size={16} /> {cryptoSuccess}
                </div>
              )}

              {/* Quick Preset Buttons */}
              <div className="mb-4">
                <label className="text-xs text-slate-400 mb-2 block">Quick Select Asset</label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {CRYPTO_PRESETS.map(p => (
                    <button key={p.symbol} type="button" onClick={() => {
                      setCryptoForm({ symbol: p.symbol, name: p.name, network: p.network, address: cryptoForm.address, minDeposit: p.minDeposit });
                    }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${cryptoForm.symbol === p.symbol ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-amber-500/30'}`}>
                      {p.symbol}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">Symbol</label>
                    <input type="text" value={cryptoForm.symbol} onChange={e => setCryptoForm({ ...cryptoForm, symbol: e.target.value.toUpperCase() })}
                      placeholder="BTC" disabled={!!editingCrypto}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white text-sm focus:border-amber-500 outline-none disabled:opacity-50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">Name</label>
                    <input type="text" value={cryptoForm.name} onChange={e => setCryptoForm({ ...cryptoForm, name: e.target.value })}
                      placeholder="Bitcoin"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white text-sm focus:border-amber-500 outline-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Network</label>
                  <input type="text" value={cryptoForm.network} onChange={e => setCryptoForm({ ...cryptoForm, network: e.target.value })}
                    placeholder="Bitcoin"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white text-sm focus:border-amber-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Deposit Address</label>
                  <textarea value={cryptoForm.address} onChange={e => setCryptoForm({ ...cryptoForm, address: e.target.value })}
                    placeholder="bc1q..."
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white text-sm font-mono focus:border-amber-500 outline-none resize-none" rows={2} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Min Deposit (optional)</label>
                  <input type="text" value={cryptoForm.minDeposit} onChange={e => setCryptoForm({ ...cryptoForm, minDeposit: e.target.value })}
                    placeholder="e.g. 0.001 BTC"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white text-sm focus:border-amber-500 outline-none" />
                </div>

                <div className="flex gap-2">
                  {editingCrypto && (
                    <button onClick={() => { setEditingCrypto(null); setCryptoForm({ symbol: '', name: '', network: '', address: '', minDeposit: '' }); }}
                      className="px-4 py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-all">
                      Cancel
                    </button>
                  )}
                  <button onClick={handleCryptoSave} disabled={cryptoLoading || !cryptoForm.symbol || !cryptoForm.name || !cryptoForm.network || !cryptoForm.address}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-900 font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50">
                    {cryptoLoading ? <><div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" /> Saving…</>
                      : <><Plus size={16} /> {editingCrypto ? 'Update Address' : 'Add Address'}</>}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Crypto Addresses List */}
            <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <ExternalLink size={16} className="text-amber-400" />
                Crypto Deposit Addresses
              </h3>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {cryptoAddresses.length === 0 ? (
                  <div className="text-center py-8">
                    <Bitcoin size={32} className="text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No crypto addresses configured yet.</p>
                    <p className="text-[10px] text-slate-600">Add addresses above — users will see them in their Crypto Wallet.</p>
                  </div>
                ) : cryptoAddresses.map(addr => (
                  <div key={addr.id} className={`p-4 rounded-xl border transition-all ${addr.isActive ? 'bg-slate-900/50 border-slate-600' : 'bg-slate-900/30 border-slate-700/50 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 text-xs font-bold">{addr.symbol}</div>
                        <div>
                          <p className="text-sm font-semibold text-white">{addr.name}</p>
                          <p className="text-[10px] text-slate-500">{addr.network} • {addr.isActive ? 'Active' : 'Inactive'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleCryptoEdit(addr)} className="p-1.5 rounded-lg bg-slate-700 text-slate-400 hover:text-amber-400 transition-all">
                          <Edit3 size={12} />
                        </button>
                        {addr.isActive && (
                          <button onClick={() => handleCryptoDelete(addr.id)} className="p-1.5 rounded-lg bg-slate-700 text-slate-400 hover:text-red-400 transition-all">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800 border border-slate-700">
                      <code className="flex-1 text-[10px] font-mono text-slate-300 break-all">{addr.address}</code>
                      <button onClick={() => { navigator.clipboard.writeText(addr.address); setCopiedCrypto(addr.id); setTimeout(() => setCopiedCrypto(null), 2000); }}
                        className="p-1 rounded text-slate-500 hover:text-amber-400 shrink-0">
                        {copiedCrypto === addr.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                    {addr.minDeposit && <p className="text-[9px] text-slate-500 mt-1">Min deposit: {addr.minDeposit}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}