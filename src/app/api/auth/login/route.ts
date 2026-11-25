import { NextRequest, NextResponse } from 'next/server';
import { getPrisma, withUnsnapshotNull } from '@/lib/prisma';
import { verifyPassword, getJwtSecret } from '@/lib/auth';
import jwt from 'jsonwebtoken';

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
      console.error(`[Login] Retry ${attempt + 1}/${maxRetries} failed:`, err instanceof Error ? err.message : String(err));
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error('All retries exhausted');
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Use retry + unsnapshot to handle cold-start DB restore races.
    // When user is not found, withUnsnapshotNull forces a fresh Blob
    // download and retries before returning null.
    const result = await withRetry(async () => {
      const user = await withUnsnapshotNull('Login', async () => {
        const prisma = await getPrisma();
        return prisma.user.findUnique({ where: { email: normalizedEmail } });
      });

      if (!user) {
        return { error: 'Invalid email or password.', status: 401 as const };
      }

      const passwordValid = await verifyPassword(password, user.passwordHash);
      if (!passwordValid) {
        return { error: 'Invalid email or password.', status: 401 as const };
      }

      if (!user.bankPinHash) {
        return { error: 'Account not fully set up. Please contact support.', status: 403 as const };
      }

      // Issue a short-lived temporary token for PIN verification
      const tempToken = jwt.sign(
        { sub: user.id, email: user.email, purpose: 'pin_verification' },
        getJwtSecret(),
        { expiresIn: '5m' }
      );

      return {
        tempToken,
        email: user.email,
        fullName: user.fullName,
      };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[Login]', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
