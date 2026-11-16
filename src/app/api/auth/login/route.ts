import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyPassword, createAuthTokens, sanitizeUser } from '@/lib/auth';
import { loginSchema } from '@/lib/validations';

export async function POST(req: NextRequest) {
  try {
    const prisma = getPrisma();
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, password, bankPin } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      console.error('[Login] User not found:', normalizedEmail);
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      console.error('[Login] Password mismatch for:', normalizedEmail);
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    if (!user.bankPinHash) {
      console.error('[Login] No bankPinHash for:', normalizedEmail);
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const pinValid = await verifyPassword(bankPin, user.bankPinHash);
    if (!pinValid) {
      console.error('[Login] PIN mismatch for:', normalizedEmail);
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
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
