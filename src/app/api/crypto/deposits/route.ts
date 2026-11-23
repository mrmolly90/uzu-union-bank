import { NextRequest, NextResponse } from 'next/server';
import { getPrisma, syncDbToBlob, resetPrisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crypto/deposits
 * Returns the authenticated user's crypto deposit requests.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided.' }, { status: 401 });
    }

    const decoded = verifyAccessToken(authHeader.slice(7));
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
    }

    const prisma = await getPrisma();
    const deposits = await prisma.cryptoDeposit.findMany({
      where: { userId: decoded.sub },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(deposits);
  } catch (err) {
    console.error('[Crypto Deposits GET]', err);
    return NextResponse.json({ error: 'Failed to fetch deposits.' }, { status: 500 });
  }
}

/**
 * POST /api/crypto/deposits
 * Submit a crypto deposit request with amount and blockchain tx hash.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided.' }, { status: 401 });
    }

    const decoded = verifyAccessToken(authHeader.slice(7));
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
    }

    const body = await req.json();
    const { symbol, amount, blockchainTxHash } = body;

    if (!symbol || !amount || !blockchainTxHash) {
      return NextResponse.json({ error: 'symbol, amount, and blockchainTxHash are required.' }, { status: 400 });
    }

    const prisma = await getPrisma();

    // Create the deposit request
    const deposit = await prisma.cryptoDeposit.create({
      data: {
        userId: decoded.sub,
        symbol: symbol.toUpperCase(),
        amount,
        blockchainTxHash,
        status: 'PENDING',
      },
    });

    // Notify user
    await prisma.notification.create({
      data: {
        userId: decoded.sub,
        title: 'Crypto Deposit Submitted',
        message: `${amount} ${symbol.toUpperCase()} deposit submitted for verification. TX: ${blockchainTxHash.slice(0, 16)}...`,
        type: 'INFO',
      },
    });

    // Persist DB to Blob
    try {
      await syncDbToBlob();
      await resetPrisma();
    } catch (syncErr) {
      console.error('[Crypto Deposits POST] Blob sync failed (non-fatal):', syncErr);
    }

    return NextResponse.json({ deposit, message: 'Deposit submitted for verification.' }, { status: 201 });
  } catch (err) {
    console.error('[Crypto Deposits POST]', err);
    return NextResponse.json({ error: 'Failed to submit deposit.' }, { status: 500 });
  }
}