'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/store/auth';
import { useSnapshotStore } from '@/store/snapshot';
import {
  ArrowLeft,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Lock,
  Shield,
  Sparkles,
  Wallet,
} from 'lucide-react';

type LoginStep = 'credentials' | 'pin' | 'granted';
type LoginErrors = { email?: string; password?: string; bankPin?: string; form?: string };

async function readApiError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  return typeof body?.error === 'string' ? body.error : fallback;
}

function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bankPin, setBankPin] = useState('');
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const mountedRef = useRef(true);

  // Only redirect if already authenticated AND store is hydrated — prevents flash
  useEffect(() => {
    const { isAuthenticated, hydrated } = useAuthStore.getState();
    if (isAuthenticated && hydrated && mountedRef.current) {
      router.replace('/dashboard');
    }
  }, [router]);

  // Subscribe to auth changes
  useEffect(() => {
    const unsub = useAuthStore.subscribe((state) => {
      if (state.isAuthenticated && state.hydrated && mountedRef.current) {
        router.replace('/dashboard');
      }
    });
    return () => { mountedRef.current = false; unsub(); };
  }, [router]);

  const handleCredentialsSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: LoginErrors = {};
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!password) nextErrors.password = 'Password is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Invalid email or password.'));
      }
      const data = await response.json();
      setTempToken(data.tempToken);
      setFullName(data.fullName);
      setEmail(normalizedEmail);
      setErrors({});
      setStep('pin');
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : 'Invalid email or password.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(bankPin)) {
      setErrors({ bankPin: 'Bank PIN must be exactly 4 digits.' });
      return;
    }
    if (!tempToken) {
      setErrors({ form: 'Session expired. Please sign in again.' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/login/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, bankPin }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Invalid bank PIN.'));
      }

      const result = await response.json();
      useAuthStore.getState().setAuth(result.user, result.tokens);

      // Immediately take a fresh DB snapshot to display verified user store info
      // the moment the user logs in — the "unsnapshot" verification mechanism.
      try {
        await useSnapshotStore.getState().fetchSnapshot(result.tokens.accessToken);
      } catch (snapshotErr) {
        console.warn('[Login] Snapshot fetch failed (non-fatal):', snapshotErr);
      }

      setErrors({});
      setStep('granted');
      setTimeout(() => router.replace('/dashboard'), 900);
    } catch (error) {
      setErrors({
        bankPin: error instanceof Error ? error.message : 'Invalid bank PIN.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex flex-1 flex-col justify-center p-16 relative overflow-hidden bg-uzu-950">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-uzu-yellow/5 rounded-full blur-[120px] pointer-events-none" aria-hidden="true" />
        <div className="max-w-md relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-uzu-yellow flex items-center justify-center shadow-lg shadow-uzu-yellow/20">
              <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" aria-hidden="true">
                <path d="M3 10L12 3L21 10V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V10Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill="#0A0A0B" />
                <text x="12" y="13" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#F7D44A">$</text>
              </svg>
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white">
                UZU <span className="text-uzu-yellow">UNION</span>
              </span>
              <span className="block text-[10px] uppercase tracking-widest text-gray-500 font-mono">Smarter Banking</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-4 leading-tight">
            Welcome Back to <span className="text-gradient-yellow">Secure Banking</span>
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-10">
            Sign in with your password and bank PIN to securely access your account.
          </p>
          <div className="space-y-4">
            {[
              { icon: Shield, text: 'Secure, encrypted authentication' },
              { icon: Sparkles, text: 'Account activity monitoring' },
              { icon: Wallet, text: 'Two-step sign-in verification' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-4 text-sm text-gray-300">
                <div className="w-8 h-8 rounded-lg bg-uzu-yellow/10 border border-uzu-yellow/20 flex items-center justify-center text-uzu-yellow shrink-0">
                  <item.icon size={14} />
                </div>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="w-full lg:w-[480px] flex flex-col justify-center p-6 sm:p-12 bg-uzu-950">
        <div className="max-w-md mx-auto w-full">
          {step === 'granted' ? (
            <div className="fixed inset-0 z-10 flex flex-col items-center justify-center bg-bybit-bg" role="status" aria-live="polite">
              <div className="flex flex-col items-center px-6 py-8 animate-slide-in">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 size={40} className="text-emerald-400" aria-hidden="true" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2 text-center">Access Granted!</h1>
                <p className="text-sm text-gray-400 text-center mb-4">Welcome, {fullName || email}</p>
                <div className="flex items-center gap-2 text-emerald-400 mb-4">
                  <Fingerprint size={16} aria-hidden="true" />
                  <span className="text-sm font-semibold">PIN verified</span>
                </div>
                <p className="text-xs text-gray-500 font-mono">Opening your dashboard…</p>
              </div>
            </div>
          ) : step === 'credentials' ? (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
                <p className="text-sm text-gray-400 mt-1">Sign in to your UZU UNION account.</p>
              </div>
              <form onSubmit={handleCredentialsSubmit} noValidate>
                <Input
                  label="Email Address"
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setErrors((previous) => ({ ...previous, email: undefined, password: undefined }));
                  }}
                  error={errors.email}
                  autoComplete="email"
                  autoFocus
                  required
                />
                <Input
                  label="Password"
                  id="login-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setErrors((previous) => ({ ...previous, password: undefined }));
                  }}
                  error={errors.password}
                  showPasswordToggle
                  autoComplete="current-password"
                  required
                />
                {errors.form && <p className="text-sm text-red-400 mb-4" role="alert">{errors.form}</p>}
                <Button type="submit" className="w-full" size="lg" loading={loading}>
                  Continue
                </Button>
              </form>

              <div className="mt-6 p-4 rounded-xl bg-uzu-yellow/5 border border-uzu-yellow/20">
                <p className="text-[10px] font-bold uppercase tracking-wider text-uzu-yellow mb-2 font-mono">
                  <Shield size={12} className="inline mr-1" aria-hidden="true" /> Your Security Matters
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Never share your password or bank PIN. UZU UNION will not ask you to disclose them by email or phone.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-uzu-yellow/10 border border-uzu-yellow/30 flex items-center justify-center text-uzu-yellow">
                    <KeyRound size={20} aria-hidden="true" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">Enter Bank PIN</h1>
                    <p className="text-xs text-gray-400 mt-0.5">Step 2 of 2 — Security verification</p>
                  </div>
                </div>
                <p className="text-sm text-gray-400">
                  Enter your 4-digit PIN to complete sign-in for{' '}
                  <span className="text-uzu-yellow font-semibold">{email}</span>.
                </p>
              </div>
              <form onSubmit={handlePinSubmit} noValidate>
                <div className="mb-6">
                  <label htmlFor="login-pin" className="block text-xs font-semibold text-gray-300 mb-1.5">
                    4-Digit Bank PIN
                  </label>
                  <input
                    className="w-full px-4 py-3 rounded-xl bg-uzu-900/80 border border-uzu-700 text-white text-sm focus:border-uzu-yellow focus:ring-2 focus:ring-uzu-yellow/20 transition-all outline-none text-center text-2xl tracking-[0.5em] font-mono"
                    type="password"
                    id="login-pin"
                    placeholder="••••"
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    value={bankPin}
                    onChange={(event) => {
                      setBankPin(event.target.value.replace(/\D/g, '').slice(0, 4));
                      setErrors((previous) => ({ ...previous, bankPin: undefined }));
                    }}
                    aria-invalid={Boolean(errors.bankPin)}
                    aria-describedby={errors.bankPin ? 'login-pin-error' : undefined}
                    autoFocus
                    required
                  />
                  {errors.bankPin && <p id="login-pin-error" className="text-xs text-red-400 mt-1" role="alert">{errors.bankPin}</p>}
                </div>
                <div className="p-4 rounded-xl bg-uzu-yellow/5 border border-uzu-yellow/20 flex items-start gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-uzu-yellow/10 border border-uzu-yellow/30 flex items-center justify-center text-uzu-yellow shrink-0">
                    <Lock size={16} aria-hidden="true" />
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Your PIN is verified securely. Do not share it with anyone.
                  </p>
                </div>
                {errors.form && <p className="text-sm text-red-400 mb-4" role="alert">{errors.form}</p>}
                <Button type="submit" className="w-full" size="lg" loading={loading}>
                  Verify &amp; Sign In
                </Button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setStep('credentials');
                    setBankPin('');
                    setErrors({});
                  }}
                  className="w-full mt-3 text-xs text-gray-500 hover:text-uzu-yellow transition-colors disabled:opacity-50"
                >
                  <ArrowLeft size={12} className="inline mr-1" /> Back to credentials
                </button>
              </form>
            </>
          )}

          {step !== 'granted' && (
            <>
              <p className="mt-8 text-center text-xs text-gray-500">
                Don&apos;t have an account?{' '}
                <a href="/register" className="text-uzu-yellow hover:text-uzu-yellow-light transition-colors font-semibold">Open Account</a>
              </p>
              <div className="mt-4 text-center">
                <a href="/" className="text-xs text-gray-500 hover:text-uzu-yellow transition-colors">
                  <ArrowLeft size={12} className="inline mr-1" /> Back to Home
                </a>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-uzu-950" />}>
      <LoginForm />
    </Suspense>
  );
}
