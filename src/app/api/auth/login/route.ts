import { NextRequest, NextResponse } from 'next/server';
import { getPrisma, syncDbToBlob, ensureBlobRestore } from '@/lib/prisma';
import { verifyPassword, createAuthTokens, sanitizeUser } from '@/lib/auth';
import { loginSchema } from '@/lib/validations';

export async function POST(req: NextRequest) {
  try {
    const prisma = getPrisma();
    // Restore from Blob Store so we can find the user
    await ensureBlobRestore();
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

    if (
      !user ||
      !(await verifyPassword(password, user.passwordHash)) ||
      !user.bankPinHash ||
      !(await verifyPassword(bankPin, user.bankPinHash))
    ) {
      return NextResponse.json(
        { error: 'Invalid credentials.' },
        { status: 401 }
      );
    }

    const tokens = await createAuthTokens(user);

    // Persist DB to Blob Store so refresh token survives cold starts
    await syncDbToBlob();

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
