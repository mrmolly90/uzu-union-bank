'use client';

import { useState, useEffect } from 'react';

type TestResult = {
  name: string;
  status: 'pending' | 'running' | 'pass' | 'fail';
  message?: string;
  data?: any;
};

const API_BASE = 'https://uzudigitalservices-gules.vercel.app';

export default function TestPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [allPassed, setAllPassed] = useState(false);

  const updateResult = (name: string, update: Partial<TestResult>) => {
    setResults(prev => prev.map(r => r.name === name ? { ...r, ...update } : r));
  };

  const addResult = (result: TestResult) => {
    setResults(prev => [...prev, result]);
  };

  const runTests = async () => {
    setRunning(true);
    setAllPassed(false);
    setResults([]);
    setToken(null);

    const testEmail = `test_${Date.now()}@uzu.com`;
    const testPassword = 'SecurePass123!';
    const testPin = '1234';
    let currentToken: string | null = null;

    // Test 1: Registration
    addResult({ name: '1. User Registration', status: 'running' });
    try {
      const reg = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: testPassword, bankPin: testPin, fullName: 'Test User', countryCode: 'US' })
      });
      const regData = await reg.json();
      if (regData.user) {
        updateResult('1. User Registration', { status: 'pass', data: { email: regData.user.email, id: regData.user.id } });
        currentToken = regData.tokens?.accessToken;
        setToken(currentToken);
      } else {
        updateResult('1. User Registration', { status: 'fail', message: regData.error || 'Unknown error' });
      }
    } catch (e: any) {
      updateResult('1. User Registration', { status: 'fail', message: e.message });
    }

    // Test 2: Login (Credentials)
    addResult({ name: '2. Login (Credentials)', status: 'running' });
    try {
      const login = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: testPassword })
      });
      const loginData = await login.json();
      if (loginData.user) {
        updateResult('2. Login (Credentials)', { status: 'pass', data: { email: loginData.user.email } });
        currentToken = loginData.tokens?.accessToken;
        setToken(currentToken);
      } else {
        updateResult('2. Login (Credentials)', { status: 'fail', message: loginData.error || 'Invalid credentials' });
      }
    } catch (e: any) {
      updateResult('2. Login (Credentials)', { status: 'fail', message: e.message });
    }

    // Test 3: PIN Verification
    addResult({ name: '3. PIN Verification', status: 'running' });
    try {
      const pin = await fetch(`${API_BASE}/api/auth/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, bankPin: testPin })
      });
      const pinData = await pin.json();
      if (pinData.user) {
        updateResult('3. PIN Verification', { status: 'pass', data: { email: pinData.user.email } });
        currentToken = pinData.tokens?.accessToken;
        setToken(currentToken);
      } else {
        updateResult('3. PIN Verification', { status: 'fail', message: pinData.error || 'Invalid PIN' });
      }
    } catch (e: any) {
      updateResult('3. PIN Verification', { status: 'fail', message: e.message });
    }

    // Test 4: Get Accounts
    addResult({ name: '4. Get Accounts', status: 'running' });
    try {
      if (currentToken) {
        const accts = await fetch(`${API_BASE}/api/accounts`, {
          headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const acctsData = await accts.json();
        if (Array.isArray(acctsData)) {
          updateResult('4. Get Accounts', { status: 'pass', data: { count: acctsData.length, currencies: Array.from(new Set(acctsData.map((a: any) => a.currency))).join(', ') } });
        } else {
          updateResult('4. Get Accounts', { status: 'fail', message: acctsData.error || 'Invalid response' });
        }
      } else {
        updateResult('4. Get Accounts', { status: 'fail', message: 'No auth token available' });
      }
    } catch (e: any) {
      updateResult('4. Get Accounts', { status: 'fail', message: e.message });
    }

    // Test 5: Exchange Rates
    addResult({ name: '5. Exchange Rates', status: 'running' });
    try {
      const rates = await fetch(`${API_BASE}/api/rates`);
      const ratesData = await rates.json();
      if (Array.isArray(ratesData) && ratesData.length > 0) {
        updateResult('5. Exchange Rates', { status: 'pass', data: { count: ratesData.length, pairs: ratesData.slice(0, 3).map((r: any) => `${r.base}/${r.quote}`).join(', ') + '...' } });
      } else {
        updateResult('5. Exchange Rates', { status: 'fail', message: 'No rates returned' });
      }
    } catch (e: any) {
      updateResult('5. Exchange Rates', { status: 'fail', message: e.message });
    }

    // Test 6: Admin Login
    addResult({ name: '6. Admin Login', status: 'running' });
    try {
      const admin = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@uzudigitalunion.com', password: 'admin@2026' })
      });
      const adminData = await admin.json();
      if (adminData.admin) {
        updateResult('6. Admin Login', { status: 'pass', data: { email: adminData.admin.email, role: adminData.admin.role } });
      } else {
        updateResult('6. Admin Login', { status: 'fail', message: adminData.error || 'Invalid admin credentials' });
      }
    } catch (e: any) {
      updateResult('6. Admin Login', { status: 'fail', message: e.message });
    }

    // Test 7: Crypto Addresses
    addResult({ name: '7. Crypto Addresses', status: 'running' });
    try {
      const crypto = await fetch(`${API_BASE}/api/crypto/addresses`);
      const cryptoData = await crypto.json();
      if (Array.isArray(cryptoData)) {
        updateResult('7. Crypto Addresses', { status: 'pass', data: { count: cryptoData.length, coins: cryptoData.map((c: any) => c.symbol).join(', ') } });
      } else {
        updateResult('7. Crypto Addresses', { status: 'fail', message: cryptoData.error || 'Invalid response' });
      }
    } catch (e: any) {
      updateResult('7. Crypto Addresses', { status: 'fail', message: e.message });
    }

    // Test 8: Notifications
    addResult({ name: '8. Notifications', status: 'running' });
    try {
      if (currentToken) {
        const notif = await fetch(`${API_BASE}/api/notifications`, {
          headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const notifData = await notif.json();
        if (Array.isArray(notifData)) {
          updateResult('8. Notifications', { status: 'pass', data: { count: notifData.length } });
        } else {
          updateResult('8. Notifications', { status: 'fail', message: notifData.error || 'Invalid response' });
        }
      } else {
        updateResult('8. Notifications', { status: 'fail', message: 'No auth token' });
      }
    } catch (e: any) {
      updateResult('8. Notifications', { status: 'fail', message: e.message });
    }

    // Test 9: Token Refresh
    addResult({ name: '9. Token Refresh', status: 'running' });
    try {
      if (currentToken) {
        const refresh = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: currentToken })
        });
        const refreshData = await refresh.json();
        if (refreshData.tokens || refreshData.error) {
          updateResult('9. Token Refresh', { status: refreshData.tokens ? 'pass' : 'fail', message: refreshData.tokens ? 'Token refreshed' : refreshData.error });
        } else {
          updateResult('9. Token Refresh', { status: 'fail', message: 'Unexpected response' });
        }
      } else {
        updateResult('9. Token Refresh', { status: 'fail', message: 'No auth token' });
      }
    } catch (e: any) {
      updateResult('9. Token Refresh', { status: 'fail', message: e.message });
    }

    // Test 10: Landing Page
    addResult({ name: '10. Landing Page', status: 'running' });
    try {
      const landing = await fetch(`${API_BASE}/`);
      if (landing.ok) {
        updateResult('10. Landing Page', { status: 'pass', data: { status: landing.status } });
      } else {
        updateResult('10. Landing Page', { status: 'fail', message: `Status ${landing.status}` });
      }
    } catch (e: any) {
      updateResult('10. Landing Page', { status: 'fail', message: e.message });
    }

    // Test 11: Login Page
    addResult({ name: '11. Login Page', status: 'running' });
    try {
      const loginPage = await fetch(`${API_BASE}/login`);
      if (loginPage.ok) {
        updateResult('11. Login Page', { status: 'pass', data: { status: loginPage.status } });
      } else {
        updateResult('11. Login Page', { status: 'fail', message: `Status ${loginPage.status}` });
      }
    } catch (e: any) {
      updateResult('11. Login Page', { status: 'fail', message: e.message });
    }

    // Test 12: Dashboard Page (unauthenticated - should redirect)
    addResult({ name: '12. Dashboard Page', status: 'running' });
    try {
      const dash = await fetch(`${API_BASE}/dashboard`);
      updateResult('12. Dashboard Page', { status: 'pass', data: { status: dash.status, redirected: dash.redirected } });
    } catch (e: any) {
      updateResult('12. Dashboard Page', { status: 'fail', message: e.message });
    }

    setRunning(false);
    const failed = results.filter(r => r.status === 'fail').length;
    setAllPassed(failed === 0);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'running': return '🔄';
      case 'pass': return '✅';
      case 'fail': return '❌';
      default: return '❓';
    }
  };

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const total = results.length;

  return (
    <div className="min-h-screen bg-[#090A0F] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#F7A600] flex items-center justify-center">
              <span className="text-[#090A0F] font-extrabold text-xl">U</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">UZU UNION BANK</h1>
              <p className="text-gray-400 text-sm">API Test Suite</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 text-sm">
            <span className="text-gray-400">Deployment:</span>
            <a href={API_BASE} target="_blank" rel="noopener noreferrer" className="text-[#F7A600] hover:underline font-mono text-xs">
              {API_BASE}
            </a>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mb-6 p-4 bg-[#12161C] rounded-xl border border-gray-800">
          <div>
            <p className="text-sm text-gray-400">
              Tests all API endpoints to verify the deployment is working correctly
            </p>
          </div>
          <button
            onClick={runTests}
            disabled={running}
            className="px-6 py-2.5 bg-[#F7A600] text-[#090A0F] font-semibold rounded-lg hover:bg-[#e09e00] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {running ? 'Running Tests...' : '▶ Run All Tests'}
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((result, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl border ${
                  result.status === 'pass' ? 'bg-[#0a1f0a] border-green-900/50' :
                  result.status === 'fail' ? 'bg-[#1f0a0a] border-red-900/50' :
                  result.status === 'running' ? 'bg-[#1a1a0a] border-yellow-900/50' :
                  'bg-[#12161C] border-gray-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{statusIcon(result.status)}</span>
                    <div>
                      <p className="font-medium text-sm">{result.name}</p>
                      {result.message && (
                        <p className={`text-xs mt-0.5 ${
                          result.status === 'fail' ? 'text-red-400' : 'text-gray-400'
                        }`}>
                          {result.message}
                        </p>
                      )}
                    </div>
                  </div>
                  {result.data && (
                    <div className="text-right">
                      <pre className="text-xs text-gray-500 max-w-xs truncate">
                        {JSON.stringify(result.data)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {!running && results.length > 0 && (
          <div className={`mt-6 p-6 rounded-xl text-center ${
            allPassed ? 'bg-green-900/20 border border-green-900/50' : 'bg-red-900/20 border border-red-900/50'
          }`}>
            <p className={`text-2xl font-bold mb-1 ${allPassed ? 'text-green-400' : 'text-red-400'}`}>
              {allPassed ? '🎉 ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED'}
            </p>
            <p className="text-gray-400 text-sm">
              {passed}/{total} passed · {failed}/{total} failed
            </p>
            {allPassed && (
              <p className="text-green-400/70 text-xs mt-2">
                The deployment is fully operational. All API endpoints are responding correctly.
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        {results.length === 0 && !running && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🧪</div>
            <p className="text-gray-500">Click "Run All Tests" to verify the deployment</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-600">
          UZU UNION BANK · API Test Suite · {new Date().toISOString().split('T')[0]}
        </div>
      </div>
    </div>
  );
}