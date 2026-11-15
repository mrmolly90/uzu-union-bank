import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export async function GET() {
  try {
    const prisma = getPrisma();
    const rates = await prisma.exchangeRate.findMany();
    return NextResponse.json(rates);
  } catch (err) {
    console.error('[Rates]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
