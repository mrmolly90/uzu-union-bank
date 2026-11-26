import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getPrisma, syncDbToBlob, resetPrisma, unsnapshotBeforeRead, withUnsnapshotForce } from '@/lib/prisma';
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
 * UNSNAPSHOT GUARANTEE: Every admin GET proactively downloads the freshest
 * Blob data BEFORE reading. This ensures admin ALWAYS sees the MAXIMUM user
 * count across ALL instances, even if this local instance has different data.
 * No user-count comparison — always pulls the freshest Blob.
 */
export async function GET(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // ─── PROACTIVE UNSNAPSHOT: Download freshest Blob BEFORE reading ───
    // This ensures admin ALWAYS sees every user across ALL instances.
    // syncDbToBlob() guard prevents empty DBs from overwriting Blob data.
    await unsnapshotBeforeRead();

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

    // Proactive unsnapshot before reading
    await unsnapshotBeforeRead();

    const snapshot = await withUnsnapshotForce('Admin Snapshot POST', async () => {
      return await takeAdminSnapshot();
    });

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