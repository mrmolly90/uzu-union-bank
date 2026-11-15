'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useApi } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/components/ui/Toast';
import { ArrowLeft, Shield, Sparkles, Wallet, KeyRound, Lock, CheckCircle2, Fingerprint, LogIn } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, verifyPin } = useApi();
  const [step, setStep] = useState<'credentials' | 'pin' | 'granted'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bankPin, setBankPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; bankPin?: string }>({});

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Valid email required';
    if (!password) newErrors.password = 'Password required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    try {
      // First verify credentials via login endpoint
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Invalid credentials');
      }
      // Credentials valid - now ask for PIN
      setStep('pin');
    } catch (err: any) {
      setErrors({ password: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(bankPin)) {
      setErrors({ bankPin: 'Bank PIN must be exactly 4 digits' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, bankPin }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Invalid bank PIN');
      }
      // Show access granted screen
      setStep('granted');
      // Store auth and redirect after showing success
      setTimeout(() => {
        useAuthStore.getState().setAuth(result.user, result.tokens);
        toast('success', 'Access Granted! ✓');
        router.push('/dashboard');
      }, 2500);
    } catch (err: any) {
      setErrors({ bankPin: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Brand Panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-center p-16 relative overflow-hidden bg-uzu-950">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-uzu-yellow/5 rounded-full blur-[120px] pointer-events-none" aria-hidden="true" />
        <div className="max-w-md relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-uzu-yellow flex items-center justify-center shadow-lg shadow-uzu-yellow/20">
              <span className="text-uzu-950 font-extrabold text-xl">
                <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7">
                  <path d="M3 10L12 3L21 10V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V10Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill="#0A0A0B"/>
                  <text x="12" y="13" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#F7D44A">$</text>
                </svg>
              </span>
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white">
                UZU <span className="text-uzu-yellow">UNION</span>
              </span>
              <span className="block text-[10px] uppercase tracking-widest text-gray-500 font-mono">Smarter Banking</span>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">Welcome Back to <span className="text-gradient-yellow">Secure Banking</span></h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-10">Your account is protected with military-grade encryption, real-time fraud monitoring, and multi-factor authentication.</p>
          <div className="space-y-4">
            {[
              { icon: Shield, text: 'AES-256 encryption on all data' },
              { icon: Sparkles, text: 'Real-time AI fraud monitoring 24/7' },
              { icon: Wallet, text: '4-digit bank PIN verification' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 text-sm text-gray-300">
                <div className="w-8 h-8 rounded-lg bg-uzu-yellow/10 border border-uzu-yellow/20 flex items-center justify-center text-uzu-yellow shrink-0">
                  <item.icon size={14} />
                </div>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Panel */}
      <div className="w-full lg:w-[480px] flex flex-col justify-center p-6 sm:p-12 bg-uzu-950">
        <div className="max-w-md mx-auto w-full">
          {step === 'credentials' ? (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
                <p className="text-sm text-gray-400 mt-1">Sign in to your UZU UNION account.</p>
              </div>

              <form onSubmit={handleCredentialsSubmit}>
                <Input
                  label="Email Address"
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={errors.email}
                  autoComplete="email"
                />
                <Input
                  label="Password"
                  id="login-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                  showPasswordToggle
                  autoComplete="current-password"
                />
                <div className="flex items-center justify-between mb-6">
                  <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                    <input type="checkbox" className="accent-uzu-yellow" defaultChecked />
                    Remember me
                  </label>
                  <a href="#" className="text-xs text-uzu-yellow hover:text-uzu-yellow-light transition-colors">Forgot password?</a>
                </div>
                <Button type="submit" className="w-full" size="lg" loading={loading}>
                  Continue
                </Button>
              </form>

              <div className="mt-6 p-4 rounded-xl bg-uzu-yellow/5 border border-uzu-yellow/20">
                <p className="text-[10px] font-bold uppercase tracking-wider text-uzu-yellow mb-2 font-mono">
                  <i className="fa-solid fa-shield-halved mr-1"></i> Your Security Matters
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Every login is protected with TLS 1.3 encryption, rate-limited brute-force protection, and session monitoring. Never share your credentials with anyone.
                </p>
              </div>
            </>
          ) : step === 'granted' ? (
            <>
              {/* Access Granted - Success Screen */}
              <div className="flex flex-col items-center justify-center py-8 animate-slide-in">
                {/* Animated Check Circle */}
                <div className="relative mb-8">
                  <div className="w-24 h-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center animate-glow">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 size={48} className="text-emerald-400 animate-bounce" />
                    </div>
                  </div>
                  {/* Orbiting rings */}
                  <div className="absolute inset-0 w-24 h-24 rounded-full border-2 border-emerald-500/20 animate-orbit" />
                  <div className="absolute inset-0 w-24 h-24 rounded-full border-2 border-emerald-500/10 animate-orbit-reverse" />
                </div>

                {/* Success Text */}
                <h2 className="text-2xl font-bold text-white mb-2 text-center">
                  Access Granted!
                </h2>
                <div className="flex items-center gap-2 text-emerald-400 mb-4">
                  <Fingerprint size={18} />
                  <span className="text-sm font-semibold">✓ PIN Verified Successfully</span>
                </div>
                <p className="text-sm text-gray-400 text-center mb-6 max-w-xs">
                  Your 4-digit bank PIN has been verified. Redirecting to your secure dashboard...
                </p>

                {/* Security Checkmarks */}
                <div className="w-full space-y-3 mb-6">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span className="text-xs text-gray-300">Identity Verified — AES-256 Encrypted</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span className="text-xs text-gray-300">4-Digit Bank PIN Authenticated</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span className="text-xs text-gray-300">Session Secured — TLS 1.3 Active</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <LogIn size={16} className="text-emerald-400 shrink-0" />
                    <span className="text-xs text-gray-300">Access Granted — Welcome, {email}</span>
                  </div>
                </div>

                {/* Loading bar */}
                <div className="w-full h-1.5 rounded-full bg-uzu-800 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 animate-progress" />
                </div>
                <p className="text-[10px] text-gray-500 mt-2 font-mono">Redirecting to dashboard...</p>
              </div>
            </>
          ) : (
            <>
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-uzu-yellow/10 border border-uzu-yellow/30 flex items-center justify-center text-uzu-yellow">
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Enter Bank PIN</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Step 2 of 2 — Security verification</p>
                  </div>
                </div>
                <p className="text-sm text-gray-400">
                  Enter your 4-digit bank PIN to complete secure login for <span className="text-uzu-yellow font-semibold">{email}</span>
                </p>
              </div>

              <form onSubmit={handlePinSubmit}>
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">4-Digit Bank PIN</label>
                  <input
                    className="w-full px-4 py-3 rounded-xl bg-uzu-900/80 border border-uzu-700 text-white text-sm focus:border-uzu-yellow focus:ring-2 focus:ring-uzu-yellow/20 transition-all outline-none text-center text-2xl tracking-[0.5em] font-mono"
                    type="password"
                    id="login-pin"
                    placeholder="••••"
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={bankPin}
                    onChange={(e) => {
                      setBankPin(e.target.value.replace(/\D/g, ''));
                      setErrors((prev) => ({ ...prev, bankPin: '' }));
                    }}
                    autoFocus
                  />
                  {errors.bankPin && <p className="text-xs text-red-400 mt-1">{errors.bankPin}</p>}
                </div>
                <div className="p-4 rounded-xl bg-uzu-yellow/5 border border-uzu-yellow/20 flex items-start gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-uzu-yellow/10 border border-uzu-yellow/30 flex items-center justify-center text-uzu-yellow shrink-0">
                    <Lock size={16} />
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Your PIN is encrypted with AES-256 and verified securely. Never share your PIN with anyone.
                  </p>
                </div>
                <Button type="submit" className="w-full" size="lg" loading={loading}>
                  Verify & Sign In
                </Button>
                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setBankPin(''); setErrors({}); }}
                  className="w-full mt-3 text-xs text-gray-500 hover:text-uzu-yellow transition-colors"
                >
                  <ArrowLeft size={12} className="inline mr-1" /> Back to credentials
                </button>
              </form>
            </>
          )}

          <p className="mt-8 text-center text-xs text-gray-500">
            Don&apos;t have an account?{' '}
            <a href="/register" className="text-uzu-yellow hover:text-uzu-yellow-light transition-colors font-semibold">Open Account</a>
          </p>
          <div className="mt-4 text-center">
            <a href="/" className="text-xs text-gray-500 hover:text-uzu-yellow transition-colors">
              <ArrowLeft size={12} className="inline mr-1" /> Back to Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}