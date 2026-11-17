import { NextRequest, NextResponse } from 'next/server';
import { getPrisma, syncDbToBlob } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { generateTxHash } from '@/lib/utils';
import { transferSchema } from '@/lib/validations';

export async function GET(req: NextRequest) {
  try {
    const prisma = await getPrisma();
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided.' }, { status: 401 });
    }

    const decoded = verifyAccessToken(authHeader.slice(7));
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token.' }, { status: 401 });
    }

    const transactions = await prisma.transaction.findMany({
      where: { initiatedById: decoded.sub },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(transactions);
  } catch (err) {
    console.error('[Transactions GET]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const prisma = await getPrisma();
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided.' }, { status: 401 });
    }

    const decoded = verifyAccessToken(authHeader.slice(7));
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token.' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = transferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map((e) => e.message).join(' ') },
        { status: 400 }
      );
    }

    const { sourceAccountId, destinationBankSwift, destinationBankName, destinationIban, sourceAmount, destinationCurrency, fee } = parsed.data;

    // Verify source account belongs to user
    const sourceAccount = await prisma.account.findFirst({
      where: { id: sourceAccountId, userId: decoded.sub },
    });

    if (!sourceAccount) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    if (Number(sourceAccount.balance) < sourceAmount) {
      return NextResponse.json({ error: 'Insufficient funds.' }, { status: 400 });
    }

    // Get exchange rate
    const rate = await prisma.exchangeRate.findUnique({
      where: {
        base_quote: {
          base: sourceAccount.currency,
          quote: destinationCurrency as any,
        },
      },
    });

    if (!rate) {
      return NextResponse.json(
        { error: `Exchange rate ${sourceAccount.currency}/${destinationCurrency} is unavailable.` },
        { status: 503 }
      );
    }

    const exchangeRate = Number(rate.rate);
    const destinationAmount = sourceAmount * exchangeRate;
    const transferFee = fee || Math.max(3, sourceAmount * 0.001);

    // Execute wire in a transaction (double-entry bookkeeping)
    const tx = await prisma.$transaction(async (tx: any) => {
      // Debit source (amount + fee)
      await tx.account.update({
        where: { id: sourceAccountId },
        data: { balance: { decrement: sourceAmount + transferFee } },
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          sourceAccountId,
          destinationBankSwift,
          destinationBankName: destinationBankName || '',
          destinationIban,
          sourceAmount,
          sourceCurrency: sourceAccount.currency,
          destinationAmount,
          destinationCurrency: destinationCurrency as any,
          exchangeRate,
          fee: transferFee,
          status: 'INITIATED',
          blockchainTxHash: generateTxHash(),
          initiatedById: decoded.sub,
        },
      });

      return transaction;
    });

    // Persist DB to Blob
    await syncDbToBlob();

    return NextResponse.json(tx, { status: 201 });
  } catch (err) {
    console.error('[Transactions POST]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
