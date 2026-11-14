'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/store/auth';
import { COUNTRIES, CURRENCY_SYMBOLS, getCountryName, getCurrencyByCountryCode } from '@/lib/countries';
import { ArrowLeft, User, Shield, Mail, Phone, Calendar, MapPin, Briefcase, Fingerprint, Smartphone, Lock, Globe, CheckCircle2, Copy, Check, Edit3, Save, X, IdCard, FileText } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ phone: '', address: '', occupation: '' });

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  const copyToClipboard = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 2000); } catch {}
  };

  const country = COUNTRIES.find(c => c.code === user?.countryCode);
  const userCurrency = getCurrencyByCountryCode(user?.countryCode || 'US');
  const currencySymbol = CURRENCY_SYMBOLS[userCurrency] || '$';
  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A';

  return (
    <div className="min-h-screen bg-bybit-bg">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-2 rounded-xl text-gray-400 hover:text-bybit-yellow hover:bg-bybit-elevated transition-all">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">My Profile</h1>
            <p className="text-xs text-gray-500">Personal information & account details</p>
          </div>
        </div>

        {/* Profile Header Card */}
        <Card className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-bybit-yellow to-amber-500 flex items-center justify-center text-bybit-bg text-2xl font-bold shadow-bybit-glow shrink-0">
              {user?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'UZ'}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white">{user?.fullName || 'User'}</h2>
                  <p className="text-sm text-gray-400">{user?.email}</p>
                </div>
                <Badge variant="premium">Verified Account</Badge>
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3">
                <div className="flex items-center gap-1 text-xs text-gray-500"><MapPin size={12} /> {country?.flag} {country?.name || 'N/A'} • {currencySymbol}{userCurrency}</div>
                <div className="flex items-center gap-1 text-xs text-gray-500"><Calendar size={12} /> Member since {memberSince}</div>
                <div className="flex items-center gap-1 text-xs text-emerald-400"><Shield size={12} /> KYC Verified</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Personal Details */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><User size={18} className="text-bybit-yellow" /> Personal Details</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1"><User size={12} /> Full Name</p>
              <p className="text-sm font-semibold text-white mt-1">{user?.fullName || 'N/A'}</p>
            </div>
            <div className="p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1"><Mail size={12} /> Email Address</p>
              <div className="flex items-center gap-1 mt-1">
                <p className="text-sm font-semibold text-white">{user?.email || 'N/A'}</p>
                <button onClick={() => copyToClipboard(user?.email || '', 'email')} className="p-0.5 rounded text-gray-500 hover:text-bybit-yellow">
                  {copied === 'email' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1"><Globe size={12} /> Country</p>
              <p className="text-sm font-semibold text-white mt-1">{country?.flag} {country?.name} ({country?.currency})</p>
            </div>
            <div className="p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1"><Phone size={12} /> Phone</p>
              <p className="text-sm font-semibold text-white mt-1">{user?.phone || `${country?.phoneCode || '+1'} (555) 000-0000`}</p>
            </div>
            <div className="p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1"><Calendar size={12} /> Date of Birth</p>
              <p className="text-sm font-semibold text-white mt-1">{user?.dob || 'January 15, 1990'}</p>
            </div>
            <div className="p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1"><Briefcase size={12} /> Occupation</p>
              <p className="text-sm font-semibold text-white mt-1">{user?.occupation || 'Financial Analyst'}</p>
            </div>
            <div className="p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border sm:col-span-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1"><MapPin size={12} /> Address</p>
              <p className="text-sm font-semibold text-white mt-1">{user?.address || '123 Banking Avenue, Financial District, New York, NY 10005, United States'}</p>
            </div>
          </div>
        </Card>

        {/* Security Details */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Shield size={18} className="text-bybit-yellow" /> Security & Authentication</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
              <div className="flex items-center gap-3"><Fingerprint size={18} className="text-emerald-400" /><div><p className="text-sm text-white font-medium">Biometric Auth</p><p className="text-[10px] text-gray-500">Fingerprint & Face ID</p></div></div>
              <Badge variant="confirmed">Active</Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
              <div className="flex items-center gap-3"><Smartphone size={18} className="text-bybit-yellow" /><div><p className="text-sm text-white font-medium">2FA</p><p className="text-[10px] text-gray-500">Two-factor authentication</p></div></div>
              <Badge variant="confirmed">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
              <div className="flex items-center gap-3"><Lock size={18} className="text-bybit-yellow" /><div><p className="text-sm text-white font-medium">Bank PIN</p><p className="text-[10px] text-gray-500">4-digit transaction PIN</p></div></div>
              <Badge variant="confirmed">Set</Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
              <div className="flex items-center gap-3"><IdCard size={18} className="text-emerald-400" /><div><p className="text-sm text-white font-medium">KYC Status</p><p className="text-[10px] text-gray-500">Identity verified</p></div></div>
              <Badge variant="confirmed">Verified</Badge>
            </div>
          </div>
        </Card>

        {/* Account Info */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><FileText size={18} className="text-bybit-yellow" /> Account Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
              <p className="text-[10px] text-gray-500 uppercase">Account Type</p>
              <p className="text-sm font-semibold text-bybit-yellow mt-1">Global Premium</p>
            </div>
            <div className="p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
              <p className="text-[10px] text-gray-500 uppercase">Member Since</p>
              <p className="text-sm font-semibold text-white mt-1">{memberSince}</p>
            </div>
            <div className="p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
              <p className="text-[10px] text-gray-500 uppercase">Daily Transfer Limit</p>
              <p className="text-sm font-semibold text-white mt-1">$1,000,000</p>
            </div>
            <div className="p-4 rounded-xl bg-bybit-elevated/50 border border-bybit-border">
              <p className="text-[10px] text-gray-500 uppercase">SWIFT Access</p>
              <p className="text-sm font-semibold text-emerald-400 mt-1">Enabled</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}