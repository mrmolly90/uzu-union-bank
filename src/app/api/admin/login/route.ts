import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPrisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/auth';

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
      console.error(`[Admin Login] Retry ${attempt + 1}/${maxRetries} failed:`, err instanceof Error ? err.message : String(err));
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error('All retries exhausted');
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required.' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const admin = await withRetry(async () => {
      const prisma = await getPrisma();
      return prisma.admin.findUnique({ where: { email: normalizedEmail } });
    });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const token = jwt.sign(
      { sub: admin.id, email: admin.email, role: admin.role },
      getJwtSecret(),
      { expiresIn: '8h' }
    );

    return NextResponse.json({
      admin: { id: admin.id, email: admin.email, fullName: admin.fullName, role: admin.role },
      token,
    });
  } catch (err) {
    console.error('[Admin Login]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
