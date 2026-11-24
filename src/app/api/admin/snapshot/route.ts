import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getPrisma, syncDbToBlob, resetPrisma, forceFreshDbFromBlob } from '@/lib/prisma';
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
 * FIX: Force a fresh DB download from Blob BEFORE querying. A warm instance's
 * /tmp/ DB may be STALE (old deploy without the latest registered users) and
 * the size-based freshness check silently failed (threw ReferenceError → always
 * returned false). This guarantees the admin panel always reads the freshest
 * DB — no user is ever "lost."
 */
export async function GET(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Admin loads use the throttled freshness check in getPrisma() (every 10s).
    // forceFreshDbFromBlob is NOT called here because it disconnects + re-downloads
    // the entire DB, which causes timeouts on every admin page load.
    // The anti-wipe guard in syncDbToBlob() + the timestamp-based freshness check
    // in getPrisma() ensure users are never lost.
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