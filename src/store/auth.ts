'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile, AuthTokens } from '@/types';

interface AuthState {
  user: UserProfile | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  setAuth: (user: UserProfile, tokens: AuthTokens) => void;
  clearAuth: () => void;
  updateUser: (user: UserProfile) => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      hydrated: false,

      setAuth: (user, tokens) =>
        set({ user, tokens, isAuthenticated: true }),

      clearAuth: () =>
        set({ user: null, tokens: null, isAuthenticated: false }),

      updateUser: (user) =>
        set({ user }),

      setHydrated: () =>
        set({ hydrated: true }),
    }),
    {
      name: 'uzu-auth',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHydrated();
      },
    }
  )
);