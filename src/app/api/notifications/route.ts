import { NextRequest, NextResponse } from 'next/server';
import { getPrisma, syncDbToBlob, resetPrisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

/**
 * Retry a function up to `maxRetries` times with exponential backoff.
 * Used to handle cold-start DB restore races on serverless.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      console.error(`[Notifications] Retry ${attempt + 1}/${maxRetries} failed:`, err instanceof Error ? err.message : String(err));
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error('All retries exhausted');
}

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = verifyAccessToken(auth.slice(7));
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const notifications = await withRetry(async () => {
      const prisma = await getPrisma();
      return prisma.notification.findMany({
        where: { userId: decoded.sub },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    return NextResponse.json(notifications);
  } catch (err) {
    console.error('[Notifications]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const prisma = await getPrisma();
    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = verifyAccessToken(auth.slice(7));
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await req.json();
    if (id) {
      await prisma.notification.update({ where: { id }, data: { read: true } });
    } else {
      await prisma.notification.updateMany({ where: { userId: decoded.sub }, data: { read: true } });
    }

    // Persist read status to Blob
    try {
      await syncDbToBlob();
      await resetPrisma();
    } catch (syncErr) {
      console.error('[Notifications PATCH] Blob sync failed (non-fatal):', syncErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Notifications PATCH]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
