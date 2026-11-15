import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { refreshAccessToken, sanitizeUser } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token required.' },
        { status: 400 }
      );
    }

    const tokens = await refreshAccessToken(refreshToken);
    if (!tokens) {
      return NextResponse.json(
        { error: 'Invalid or expired refresh token.' },
        { status: 401 }
      );
    }

    // Decode to get user
    const decoded = jwt.decode(tokens.accessToken) as { sub: string; email: string };
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });

    return NextResponse.json({
      user: user ? sanitizeUser(user) : null,
      tokens,
    });
  } catch (err) {
    console.error('[Refresh]', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
