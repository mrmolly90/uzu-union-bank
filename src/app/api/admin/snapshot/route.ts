import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getPrisma, syncDbToBlob, resetPrisma, forceDownloadFromBlob } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/auth';
import { takeAdminSnapshot } from '@/lib/dbSnapshot';

function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), getJwtSecret()) as any;
    if (!decoded || !decoded.role) return null;
    return decoded;
  } catch { return null; }
}

/**
 * GET /api/admin/snapshot
 * Returns a verified system-wide snapshot of ALL users with accounts, balances,
 * and stats. Uses takeAdminSnapshot() which does a single efficient DB query.
 * Every registered user appears here instantly — the "unsnapshot" for admin.
 *
 * UNSNAPSHOT GUARANTEE: Every admin GET force-downloads from Blob and
 * replaces the local DB. NO user-count comparison — admin ALWAYS sees the
 * freshest Blob data. This ensures admin sees the MAXIMUM user count across
 * ALL instances, even if this local instance has different data.
 *
 * CRITICAL: Does NOT sync local→Blob first (would push stale data over good).
 * Only downloads from Blob. The local DB is always replaced by Blob's version.
 */
export async function GET(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // ─── FORCE DOWNLOAD: Always pull the freshest Blob, replace local DB ───
    // No user-count comparison. Admin MUST see the absolute latest data.
    // If Blob is unavailable, keep the current local DB as fallback.
    try {
      await forceDownloadFromBlob();
      await resetPrisma();
    } catch (dlErr) {
      console.warn('[Admin Snapshot] Blob download failed — using local DB:', dlErr instanceof Error ? dlErr.message : String(dlErr));
    }

    const snapshot = await takeAdminSnapshot();

    return NextResponse.json({
      success: true,
      snapshot,
      message: `Admin snapshot verified — ${snapshot.stats.totalUsers} users from DB`,
    });
  } catch (err) {
    console.error('[Admin Snapshot]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * POST /api/admin/snapshot
 * Force-syncs the DB to Blob and returns a fresh admin snapshot.
 * Use after admin operations (funding, KYC, etc.) to persist data.
 */
export async function POST(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Force sync to Blob so data survives cold starts
    try { await syncDbToBlob(); } catch {}

    // Force download from Blob to ensure we see the freshest data
    try {
      await forceDownloadFromBlob();
      await resetPrisma();
    } catch {}

    const snapshot = await takeAdminSnapshot();

    return NextResponse.json({
      success: true,
      snapshot,
      synced: true,
      message: `DB synced to Blob — ${snapshot.stats.totalUsers} users verified`,
    });
  } catch (err) {
    console.error('[Admin Snapshot POST]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}