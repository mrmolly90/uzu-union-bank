import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyPassword, createAuthTokens, sanitizeUser, getJwtSecret } from '@/lib/auth';
import jwt from 'jsonwebtoken';

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

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });

    if (!user || !user.bankPinHash) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const pinValid = await verifyPassword(bankPin, user.bankPinHash);
    if (!pinValid) {
      return NextResponse.json({ error: 'Invalid bank PIN.' }, { status: 401 });
    }

    const tokens = await createAuthTokens(user);

    return NextResponse.json({
      user: sanitizeUser(user),
      tokens,
    });
  } catch (err) {
    console.error('[Login Verify PIN]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}