import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createAuthTokens, sanitizeUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, bankPin } = body;

    if (!email || !bankPin) {
      return NextResponse.json(
        { error: 'Email and bank PIN are required.' },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(bankPin)) {
      return NextResponse.json(
        { error: 'Bank PIN must be exactly 4 digits.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.bankPinHash || !(await verifyPassword(bankPin, user.bankPinHash))) {
      return NextResponse.json(
        { error: 'Invalid bank PIN.' },
        { status: 401 }
      );
    }

    const tokens = await createAuthTokens(user);

    return NextResponse.json({
      user: sanitizeUser(user),
      tokens,
    });
  } catch (err) {
    console.error('[PIN Verify]', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}