import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyPassword, createAuthTokens, sanitizeUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password, bankPin } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    if (!bankPin || !/^\d{4}$/.test(bankPin)) {
      return NextResponse.json({ error: 'Bank PIN must be exactly 4 digits.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    if (!user.bankPinHash) {
      return NextResponse.json({ error: 'Account not fully set up. Please contact support.' }, { status: 403 });
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
    console.error('[Login]', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
