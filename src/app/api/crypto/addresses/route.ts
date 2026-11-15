import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const prisma = await getPrisma();
    const addresses = await prisma.cryptoAddress.findMany({
      where: { isActive: true },
      orderBy: { symbol: 'asc' },
    });

    return NextResponse.json(addresses);
  } catch (err) {
    console.error('[Crypto Addresses]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}