import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getPrisma, syncDbToBlob, resetPrisma, unsnapshotBeforeRead, withUnsnapshotNull } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/auth';

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
 * PATCH /api/admin/users/pause-transfer
 * Admin can pause or resume a user's ability to initiate wire transfers.
 * When paused, the transfer page and API will reject new transfers.
 * The snapshot system reflects this status instantly to users.
 */
export async function PATCH(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Download freshest Blob BEFORE the write so we operate on merged data
    await unsnapshotBeforeRead();

    const prisma = await getPrisma();
    const { userId, transferPaused } = await req.json();

    if (!userId || transferPaused === undefined) {
      return NextResponse.json({ error: 'userId and transferPaused required' }, { status: 400 });
    }

    // Use unsnapshot to handle cold-start DB restore races
    const user = await withUnsnapshotNull('Admin Pause Transfer', async () => {
      const p = await getPrisma();
      return p.user.findUnique({ where: { id: userId } });
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { transferPaused },
    });

    // Notify the user
    await prisma.notification.create({
      data: {
        userId,
        title: transferPaused ? 'Transfers Paused' : 'Transfers Resumed',
        message: transferPaused
          ? 'Your wire transfer capability has been temporarily paused by admin. Contact support for details.'
          : 'Your wire transfer capability has been restored by admin.',
        type: 'INFO',
      },
    });

    // Persist to Blob
    try { await syncDbToBlob(); await resetPrisma(); } catch {}

    return NextResponse.json({
      success: true,
      transferPaused: updated.transferPaused,
    });
  } catch (err) {
    console.error('[Admin Pause Transfer]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}