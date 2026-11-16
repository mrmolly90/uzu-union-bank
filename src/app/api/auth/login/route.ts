import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyPassword, getJwtSecret } from '@/lib/auth';
import jwt from 'jsonwebtoken';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const prisma = await getPrisma();
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

    // Issue a short-lived temporary token for PIN verification
    const tempToken = jwt.sign(
      { sub: user.id, email: user.email, purpose: 'pin_verification' },
      getJwtSecret(),
      { expiresIn: '5m' }
    );

    return NextResponse.json({
      tempToken,
      email: user.email,
      fullName: user.fullName,
    });
  } catch (err) {
    console.error('[Login]', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
