import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyPassword, createAuthTokens, sanitizeUser, getJwtSecret } from '@/lib/auth';
import jwt from 'jsonwebtoken';

/**
 * Retry a function up to `maxRetries` times with exponential backoff.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      console.error(`[Verify PIN] Retry ${attempt + 1}/${maxRetries}:`, err instanceof Error ? err.message : String(err));
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error('All retries exhausted');
}

export async function POST(req: NextRequest) {
  try {
    const { tempToken, bankPin } = await req.json();

    if (!tempToken || !bankPin || !/^\d{4}$/.test(bankPin)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    // Verify the temporary token
    let decoded: { sub: string; email: string };
    try {
      decoded = jwt.verify(tempToken, getJwtSecret()) as { sub: string; email: string };
    } catch {
      return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 });
    }

    // Use retry to handle cold-start DB restore timing
    const result = await withRetry(async () => {
      const prisma = await getPrisma();
      const user = await prisma.user.findUnique({ where: { id: decoded.sub } });

      if (!user || !user.bankPinHash) {
        return { error: 'Invalid credentials.', status: 401 as const };
      }

      const pinValid = await verifyPassword(bankPin, user.bankPinHash);
      if (!pinValid) {
        return { error: 'Invalid bank PIN.', status: 401 as const };
      }

      const tokens = await createAuthTokens(user);

      return {
        user: sanitizeUser(user),
        tokens,
      };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[Login Verify PIN]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}