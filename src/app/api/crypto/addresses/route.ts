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
      console.error(`[Crypto Addresses] Retry ${attempt + 1}/${maxRetries} failed:`, err instanceof Error ? err.message : String(err));
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error('All retries exhausted');
}

export async function GET(req: NextRequest) {
  try {
    // Require authentication for crypto addresses
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const decoded = verifyAccessToken(authHeader.slice(7));
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
    }

    const addresses = await withUnsnapshotForce('Crypto Addresses', async () => {
      const prisma = await getPrisma();
      return prisma.cryptoAddress.findMany({
        where: { isActive: true },
        orderBy: { symbol: 'asc' },
      });
    });

    return NextResponse.json(addresses);
  } catch (err) {
    console.error('[Crypto Addresses]', err);
    return NextResponse.json({ error: 'Crypto addresses are temporarily unavailable.' }, { status: 503 });
  }
}
