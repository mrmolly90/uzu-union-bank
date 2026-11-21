import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Require authentication for crypto addresses
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const decoded = verifyAccessToken(authHeader.slice(7));
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
    }

    const prisma = await getPrisma();
    const addresses = await prisma.cryptoAddress.findMany({
      where: { isActive: true },
      orderBy: { symbol: 'asc' },
    });

    return NextResponse.json(addresses);
  } catch (err) {
    console.error('[Crypto Addresses]', err);
    return NextResponse.json({ error: 'Crypto addresses are temporarily unavailable.' }, { status: 503 });
  }
}
