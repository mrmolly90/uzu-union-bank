'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { useSnapshotStore } from '@/store/snapshot';

/**
 * AuthSnapshotProvider — wraps the app and automatically fetches a verified
 * DB snapshot whenever the user's authentication state changes.
 * This ensures that user store info is always displayed from live DB data
 * whenever the user visits any page in the application.
 */
export function AuthSnapshotProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hydrated } = useAuthStore();
  const fetchSnapshot = useSnapshotStore(s => s.fetchSnapshot);

  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;

    const { tokens } = useAuthStore.getState();
    if (!tokens?.accessToken) return;

    // Fetch a verified DB snapshot on every authenticated page visit
    // This is the core "unsnapshot" mechanism — reads directly from DB
    // to display user store info instantly.
    fetchSnapshot(tokens.accessToken).catch(() => {
      // Non-critical — snapshot is a verification layer, not a dependency
    });
  }, [hydrated, isAuthenticated, fetchSnapshot]);

  return <>{children}</>;
}