import { NextRequest, NextResponse } from 'next/server';
import { getPrisma, withUnsnapshotForce } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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
      console.error(`[Accounts] Retry ${attempt + 1}/${maxRetries} failed:`, err instanceof Error ? err.message : String(err));
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error('All retries exhausted');
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided.' }, { status: 401 });
    }

    const decoded = verifyAccessToken(authHeader.slice(7));
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token.' }, { status: 401 });
    }

    const accounts = await withUnsnapshotForce('Accounts', async () => {
      const prisma = await getPrisma();
      return prisma.account.findMany({
        where: { userId: decoded.sub },
        orderBy: { currency: 'asc' },
      });
    });

    return NextResponse.json(accounts);
  } catch (err) {
    console.error('[Accounts]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
