'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Eye, EyeOff, ArrowLeft, AlertTriangle } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('uzu-admin-token', data.token);
      localStorage.setItem('uzu-admin-user', JSON.stringify(data.admin));
      router.push('/admin');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
            <Shield size={32} className="text-slate-900" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Control Panel</h1>
          <p className="text-sm text-slate-400 mt-1">UZU DIGITAL UNION — Secure Administration</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-slate-700 p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@uzudigitalunion.com"
              className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-600 text-white text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all outline-none"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-900/80 border border-slate-600 text-white text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all outline-none"
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-900 font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" /> Authenticating…</>
            ) : (
              <><Lock size={16} /> Access Admin Panel</>
            )}
          </button>

          <div className="pt-3 border-t border-slate-700">
            <button type="button" onClick={() => router.push('/')} className="flex items-center gap-1 text-xs text-slate-500 hover:text-amber-400 transition-colors mx-auto">
              <ArrowLeft size={12} /> Back to Main Site
            </button>
          </div>
        </form>

        <p className="text-center text-[10px] text-slate-600 mt-4 font-mono">TLS 1.3 Encrypted • Rate Limited • IP Logged</p>
      </div>
    </div>
  );
}
