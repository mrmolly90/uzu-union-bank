/* ==========================================================================
   UZU UNION BANK — DB Snapshot Store
   Maintains a verified point-in-time snapshot of user data from the DB.
   Refreshes on login, page visits, and after critical actions (transfers, funding).
   Displays user store info instantly from verified DB state.
   ========================================================================== */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DbSnapshot } from '@/lib/dbSnapshot';

interface SnapshotState {
  /** The current verified DB snapshot */
  snapshot: DbSnapshot | null;
  /** Whether a snapshot fetch is in progress */
  loading: boolean;
  /** Last error message */
  error: string | null;
  /** Timestamp of last successful fetch */
  lastFetched: string | null;

  /** Fetch a fresh snapshot from the DB API */
  fetchSnapshot: (accessToken: string) => Promise<DbSnapshot>;
  /** Clear the snapshot (e.g., on logout) */
  clearSnapshot: () => void;
  /** Set snapshot data directly (e.g., after a mutation we know the result) */
  setSnapshot: (snapshot: DbSnapshot) => void;
}

export const useSnapshotStore = create<SnapshotState>()(
  persist(
    (set) => ({
      snapshot: null,
      loading: false,
      error: null,
      lastFetched: null,

      fetchSnapshot: async (accessToken: string) => {
        set({ loading: true, error: null });
        try {
          const res = await fetch('/api/snapshot', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: 'Failed to fetch snapshot' }));
            throw new Error(errData.error || 'Failed to fetch snapshot');
          }
          const data = await res.json();
          const snapshot = data.snapshot as DbSnapshot;
          set({
            snapshot,
            loading: false,
            error: null,
            lastFetched: snapshot.timestamp,
          });
          return snapshot;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to fetch snapshot';
          set({ loading: false, error: msg });
          throw err;
        }
      },

      clearSnapshot: () => {
        set({ snapshot: null, loading: false, error: null, lastFetched: null });
      },

      setSnapshot: (snapshot: DbSnapshot) => {
        set({ snapshot, lastFetched: snapshot.timestamp, error: null });
      },
    }),
    {
      name: 'uzu-snapshot',
      partialize: (state) => ({
        snapshot: state.snapshot,
        lastFetched: state.lastFetched,
      }),
    }
  )
);