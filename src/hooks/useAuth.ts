'use client';

import { useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/Toast';

const API_BASE = '/api';

async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { tokens } = useAuthStore.getState();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (tokens?.accessToken) {
    headers['Authorization'] = `Bearer ${tokens.accessToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // Login, PIN verification, and registration are public routes; do not
    // attempt an unrelated refresh when they reject submitted credentials.
    const isPublicAuthRoute =
      path === '/auth/login' || path === '/auth/pin' || path === '/auth/register';
    if (!isPublicAuthRoute && tokens?.refreshToken) {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        useAuthStore.getState().setAuth(data.user, data.tokens);
        headers['Authorization'] = `Bearer ${data.tokens.accessToken}`;
        const retryRes = await fetch(`${API_BASE}${path}`, { ...options, headers });
        if (!retryRes.ok) {
          const error = await retryRes.json().catch(() => ({ error: 'Request failed after refresh.' }));
          throw new Error(error.error || `HTTP ${retryRes.status}`);
        }
        return retryRes.json();
      }
    }
    if (!isPublicAuthRoute) {
      useAuthStore.getState().clearAuth();
      throw new Error('Session expired. Please sign in again.');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(
      typeof err?.error === 'string' ? err.error : `Request failed (${res.status}). Please try again.`
    );
  }

  return res.json();
}

export function useApi() {
  const { clearAuth } = useAuthStore();
  const router = useRouter();

  const verifyPin = useCallback(async (email: string, bankPin: string) => {
    const data = await fetchApi<{ user: any; tokens: any }>('/auth/pin', {
      method: 'POST',
      body: JSON.stringify({ email, bankPin }),
    });
    useAuthStore.getState().setAuth(data.user, data.tokens);
    toast('success', 'PIN verified!');
    router.push('/dashboard');
  }, [router]);

  const register = useCallback(async (data: {
    email: string;
    password: string;
    bankPin: string;
    fullName: string;
    countryCode: string;
    phone?: string;
    dob?: string;
    address?: string;
    occupation?: string;
    idNumber?: string;
  }) => {
    await fetchApi<{ user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    toast('success', 'Account created successfully!');
    router.push('/login?registered=1');
  }, [router]);

  const logout = useCallback(() => {
    clearAuth();
    router.push('/');
    toast('info', 'Signed out.');
  }, [clearAuth, router]);

  const getAccounts = useCallback(async () => {
    return fetchApi<any[]>('/accounts');
  }, []);

  const getTransactions = useCallback(async () => {
    return fetchApi<any[]>('/transactions');
  }, []);

  const createTransfer = useCallback(async (data: any) => {
    return fetchApi<any>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }, []);

  return { verifyPin, register, logout, getAccounts, getTransactions, createTransfer };
}