import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { takeUserSnapshot, verifySnapshot } from '@/lib/dbSnapshot';

export const dynamic = 'force-dynamic';

/**
 * GET /api/snapshot
 * Returns a verified DB snapshot of the authenticated user's data.
 * This is the "unsnapshot" mechanism — it bypasses all cached state
 * and reads directly from the database for instant verification.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided.' }, { status: 401 });
    }

    const decoded = verifyAccessToken(authHeader.slice(7));
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
    }

    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Take a fresh snapshot from the DB
    const snapshot = await takeUserSnapshot(decoded.sub, user.countryCode);

    return NextResponse.json({
      success: true,
      snapshot,
      message: 'DB snapshot verified — user store data is current',
    });
  } catch (err) {
    console.error('[Snapshot GET]', err);
    return NextResponse.json(
      { error: 'Failed to take DB snapshot.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/snapshot
 * Verifies an existing snapshot against the current DB state.
 * Use this to check if cached data is still accurate.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided.' }, { status: 401 });
    }

    const decoded = verifyAccessToken(authHeader.slice(7));
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
    }

    const body = await req.json();
    if (!body.snapshot) {
      return NextResponse.json({ error: 'Snapshot data required.' }, { status: 400 });
    }

    const result = await verifySnapshot(body.snapshot);

    return NextResponse.json({
      success: result.valid,
      ...result,
    });
  } catch (err) {
    console.error('[Snapshot POST]', err);
    return NextResponse.json(
      { error: 'Failed to verify snapshot.' },
      { status: 500 }
    );
  }
}