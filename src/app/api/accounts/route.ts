import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided.' }, { status: 401 });
    }

    const decoded = verifyAccessToken(authHeader.slice(7));
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token.' }, { status: 401 });
    }

    const prisma = await getPrisma();
    const accounts = await prisma.account.findMany({
      where: { userId: decoded.sub },
      orderBy: { currency: 'asc' },
    });

    return NextResponse.json(accounts);
  } catch (err) {
    console.error('[Accounts]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}