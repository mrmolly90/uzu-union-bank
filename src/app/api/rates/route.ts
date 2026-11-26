import { NextResponse } from 'next/server';
import { getPrisma, unsnapshotBeforeRead, withUnsnapshotForce } from '@/lib/prisma';

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
      console.error(`[Rates] Retry ${attempt + 1}/${maxRetries} failed:`, err instanceof Error ? err.message : String(err));
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error('All retries exhausted');
}

export async function GET() {
  try {
    // Proactive unsnapshot: download freshest Blob BEFORE reading
    await unsnapshotBeforeRead();

    const rates = await withUnsnapshotForce('Rates', async () => {
      const prisma = await getPrisma();
      return prisma.exchangeRate.findMany();
    });
    return NextResponse.json(rates);
  } catch (err) {
    console.error('[Rates]', err);
    return NextResponse.json({ error: 'Exchange rates are temporarily unavailable.' }, { status: 503 });
  }
}

