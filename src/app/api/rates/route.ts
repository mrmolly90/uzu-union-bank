import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const prisma = await getPrisma();
    const rates = await prisma.exchangeRate.findMany();
    return NextResponse.json(rates);
  } catch (err) {
    console.error('[Rates]', err);
    return NextResponse.json({ error: 'Exchange rates are temporarily unavailable.' }, { status: 503 });
  }
}
