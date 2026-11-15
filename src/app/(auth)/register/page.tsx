'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useApi } from '@/hooks/useAuth';
import { ArrowLeft, Shield, Sparkles, Wallet, KeyRound, Lock } from 'lucide-react';

const COUNTRIES = [
  { code: 'US', name: 'United States' }, { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' }, { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' }, { code: 'SG', name: 'Singapore' },
  { code: 'CH', name: 'Switzerland' }, { code: 'NG', name: 'Nigeria' },
  { code: 'AE', name: 'UAE' }, { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' }, { code: 'HK', name: 'Hong Kong' },
  { code: 'BR', name: 'Brazil' }, { code: 'IN', name: 'India' },
  { code: 'CN', name: 'China' }, { code: 'ZA', name: 'South Africa' },
  { code: 'KE', name: 'Kenya' }, { code: 'GH', name: 'Ghana' },
  { code: 'EG', name: 'Egypt' }, { code: 'SA', name: 'Saudi Arabia' },
];

export default function RegisterPage() {
  const { register } = useApi();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    fullName: '', countryCode: '', phone: '', dob: '',
    address: '', occupation: '', idNumber: '',
    bankPin: '', confirmBankPin: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateStep = (s: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (s === 1) {
      if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Valid email required';
      if (!form.password || form.password.length < 5) newErrors.password = 'Min 5 characters';
      if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords must match';
      if (!form.countryCode) newErrors.countryCode = 'Select a country';
    }
    if (s === 2) {
      if (!form.fullName.trim()) newErrors.fullName = 'Full name required';
      if (!form.dob) newErrors.dob = 'Date of birth required';
      if (!form.phone.trim()) newErrors.phone = 'Phone required';
    }
    if (s === 3) {
      if (!form.bankPin || !/^\d{4}$/.test(form.bankPin)) newErrors.bankPin = 'Bank PIN must be exactly 4 digits';
      if (form.bankPin !== form.confirmBankPin) newErrors.confirmBankPin = 'PINs must match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => { if (validateStep(step)) setStep((s) => s + 1); };
  const prevStep = () => setStep((s) => s - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) return;
    setLoading(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        bankPin: form.bankPin,
        fullName: form.fullName,
        countryCode: form.countryCode,
        phone: form.phone,
        dob: form.dob,
        address: form.address,
        occupation: form.occupation,
        idNumber: form.idNumber,
      });
    } catch (err: any) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  };

  const passwordScore = () => {
    let s = 0;
    if (form.password.length >= 8) s++;
    if (form.password.length >= 12) s++;
    if (/[A-Z]/.test(form.password)) s++;
    if (/[a-z]/.test(form.password)) s++;
    if (/[0-9]/.test(form.password)) s++;
    if (/[^A-Za-z0-9]/.test(form.password)) s++;
    return Math.min(s, 4);
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
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">Open Your Free <span className="text-gradient-yellow">Account</span></h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-10">Bank-grade security with AES-256 encryption, real-time fraud monitoring, and biometric authentication. Get started in under 5 minutes.</p>
          <div className="space-y-4">
            {[
              { icon: Shield, text: 'AES-256-GCM encrypted data at rest & in transit' },
              { icon: Sparkles, text: 'AI-powered 24/7 fraud detection system' },
              { icon: Wallet, text: 'Biometric MFA with hardware security key support' },
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
      <div className="w-full lg:w-[480px] flex flex-col justify-center p-6 sm:p-12 overflow-y-auto bg-uzu-950">
        <div className="max-w-md mx-auto w-full">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">Open Your Account</h2>
            <p className="text-sm text-gray-400 mt-1">Start your smarter banking journey.</p>
          </div>

          {/* Step Indicator */}
          <div className="flex gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                  s <= step ? 'bg-uzu-yellow' : 'bg-uzu-800'
                }`}
              />
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {/* Step 1 */}
            {step === 1 && (
              <div className="space-y-1">
                <Input label="Email Address" id="reg-email" type="email" placeholder="you@example.com"
                  value={form.email} onChange={(e) => updateField('email', e.target.value)} error={errors.email} />
                <Input label="Create Password" id="reg-password" type="password" placeholder="Min. 5 characters"
                  value={form.password} onChange={(e) => updateField('password', e.target.value)} error={errors.password} showPasswordToggle />
                {form.password && (
                  <div className="flex gap-1 mt-1 mb-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className={`flex-1 h-1 rounded-full transition-all ${
                        i < passwordScore()
                          ? passwordScore() <= 2 ? 'bg-red-500' : passwordScore() === 3 ? 'bg-amber-500' : 'bg-uzu-yellow'
                          : 'bg-uzu-800'
                      }`} />
                    ))}
                  </div>
                )}
                <Input label="Confirm Password" id="reg-confirm" type="password" placeholder="Re-enter password"
                  value={form.confirmPassword} onChange={(e) => updateField('confirmPassword', e.target.value)} error={errors.confirmPassword} />
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">Country of Residence</label>
                  <select className="w-full px-4 py-3 rounded-xl bg-uzu-900/80 border border-uzu-700 text-white text-sm focus:border-uzu-yellow focus:ring-2 focus:ring-uzu-yellow/20 transition-all outline-none"
                    value={form.countryCode} onChange={(e) => updateField('countryCode', e.target.value)}>
                    <option value="" disabled>Select country</option>
                    {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                  {errors.countryCode && <p className="text-xs text-red-400 mt-1">{errors.countryCode}</p>}
                </div>
                <Button type="button" className="w-full" size="lg" onClick={nextStep}>
                  Continue <ArrowLeft size={16} className="rotate-180" />
                </Button>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Full Legal Name" id="reg-name" type="text" placeholder="Jane Doe"
                    value={form.fullName} onChange={(e) => updateField('fullName', e.target.value)} error={errors.fullName} />
                  <Input label="Date of Birth" id="reg-dob" type="date"
                    value={form.dob} onChange={(e) => updateField('dob', e.target.value)} error={errors.dob} />
                </div>
                <Input label="Phone Number" id="reg-phone" type="tel" placeholder="+1 (555) 000-0000"
                  value={form.phone} onChange={(e) => updateField('phone', e.target.value)} error={errors.phone} />
                <Input label="Residential Address" id="reg-address" type="text" placeholder="Street, City, Postal Code"
                  value={form.address} onChange={(e) => updateField('address', e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Occupation" id="reg-occ" type="text" placeholder="e.g. Engineer"
                    value={form.occupation} onChange={(e) => updateField('occupation', e.target.value)} />
                  <Input label="National ID / Passport" id="reg-id" type="text" placeholder="Field-level encrypted"
                    value={form.idNumber} onChange={(e) => updateField('idNumber', e.target.value)} />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" className="flex-1" onClick={prevStep}>Back</Button>
                  <Button type="button" className="flex-1" onClick={nextStep}>Continue</Button>
                </div>
              </div>
            )}

            {/* Step 3: Bank PIN Setup */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-uzu-yellow/5 border border-uzu-yellow/20 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-uzu-yellow/10 border border-uzu-yellow/30 flex items-center justify-center text-uzu-yellow shrink-0">
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Create Your 4-Digit Bank PIN</p>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      Your bank PIN is required to access your account after login. It adds an extra layer of security to protect your funds.
                    </p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-uzu-900/60 border border-uzu-800 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-uzu-yellow/10 border border-uzu-yellow/30 flex items-center justify-center text-uzu-yellow shrink-0">
                    <Lock size={16} />
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Your PIN is encrypted with AES-256 and never stored in plain text. Do not share it with anyone.
                  </p>
                </div>
                <Input
                  label="4-Digit Bank PIN"
                  id="reg-pin"
                  type="password"
                  placeholder="••••"
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.bankPin}
                  onChange={(e) => updateField('bankPin', e.target.value.replace(/\D/g, ''))}
                  error={errors.bankPin}
                  showPasswordToggle
                />
                <Input
                  label="Confirm Bank PIN"
                  id="reg-confirm-pin"
                  type="password"
                  placeholder="••••"
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.confirmBankPin}
                  onChange={(e) => updateField('confirmBankPin', e.target.value.replace(/\D/g, ''))}
                  error={errors.confirmBankPin}
                  showPasswordToggle
                />
                {errors.submit && <p className="text-xs text-red-400">{errors.submit}</p>}
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" className="flex-1" onClick={prevStep}>Back</Button>
                  <Button type="submit" className="flex-1" loading={loading}>Create Secure Account</Button>
                </div>
              </div>
            )}
          </form>

          <div className="mt-6 text-center">
            <a href="/" className="text-xs text-gray-500 hover:text-uzu-accent transition-colors">
              <ArrowLeft size={12} className="inline mr-1" /> Back to Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}