import { NextRequest, NextResponse } from 'next/server';
import { getPrisma, forceFreshDbFromBlob, syncDbToBlob, resetPrisma } from '@/lib/prisma';
import { verifyPassword, getJwtSecret } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

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

/**
 * UNSNAPSHOT LOGIN: When login finds no user, force a fresh Blob download
 * and retry before returning "Invalid credentials". This ensures that even
 * if this serverless instance has a stale local DB (downloaded from old Blob),
 * the user can still log in because we re-pull the freshest Blob.
 *
 * Also syncs the local DB to Blob if we have more users than Blob, so that
 * OTHER cold instances will see the latest data on their next download.
 */
async function unsnapshotRetry<T>(fn: () => Promise<T>, retryFn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    // First attempt failed — try unsnapshot (force fresh Blob)
    console.log('[Login] Unsnapshot retry: forcing fresh DB from Blob...');
    try {
      await forceFreshDbFromBlob();
      await resetPrisma();
    } catch {
      console.warn('[Login] Unsnapshot retry: forceFreshDbFromBlob failed');
    }
    return await retryFn();
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Use retry to handle cold-start DB restore timing
    const result = await withRetry(async () => {
      const prisma = await getPrisma();
      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

      if (!user) {
        // ─── UNSNAPSHOT: User not found — force fresh Blob download ───
        // This handles the case where this instance has a stale DB from old Blob.
        // Force a fresh Blob download, reset Prisma client, and retry once.
        console.log(`[Login] User ${normalizedEmail} not found — unsnapshot retry...`);
        try {
          await forceFreshDbFromBlob();
          await resetPrisma();
        } catch (e) {
          console.warn('[Login] Unsnapshot failed:', e instanceof Error ? e.message : String(e));
        }

        // Retry with fresh DB
        const prisma2 = await getPrisma();
        const user2 = await prisma2.user.findUnique({ where: { email: normalizedEmail } });
        if (!user2) {
          return { error: 'Invalid email or password.', status: 401 as const };
        }

        const passwordValid2 = await verifyPassword(password, user2.passwordHash);
        if (!passwordValid2) {
          return { error: 'Invalid email or password.', status: 401 as const };
        }

        if (!user2.bankPinHash) {
          return { error: 'Account not fully set up. Please contact support.', status: 403 as const };
        }

        const tempToken = jwt.sign(
          { sub: user2.id, email: user2.email, purpose: 'pin_verification' },
          getJwtSecret(),
          { expiresIn: '5m' }
        );

        return {
          tempToken,
          email: user2.email,
          fullName: user2.fullName,
          unsnapshotted: true,
        };
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
