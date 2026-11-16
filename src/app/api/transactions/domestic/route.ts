import { NextRequest, NextResponse } from 'next/server';
import { getPrisma, syncDbToBlob } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { generateTxHash } from '@/lib/utils';
import { formatExactAmount } from '@/lib/format';

export async function POST(req: NextRequest) {
  try {
    const prisma = getPrisma();
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided.' }, { status: 401 });
    }

    const decoded = verifyAccessToken(authHeader.slice(7));
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token.' }, { status: 401 });
    }

    const body = await req.json();
    const { sourceAccountId, destinationAccountId, amount } = body;

    if (!sourceAccountId || !destinationAccountId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid transfer details.' }, { status: 400 });
    }

    // Verify both accounts belong to the user
    const sourceAccount = await prisma.account.findFirst({
      where: { id: sourceAccountId, userId: decoded.sub },
    });

    const destAccount = await prisma.account.findFirst({
      where: { id: destinationAccountId, userId: decoded.sub },
    });

    if (!sourceAccount || !destAccount) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    if (Number(sourceAccount.balance) < amount) {
      return NextResponse.json({ error: 'Insufficient funds.' }, { status: 400 });
    }

    // Execute domestic transfer in a transaction (double-entry bookkeeping)
    const tx = await prisma.$transaction(async (db: any) => {
      // Debit source
      await db.account.update({
        where: { id: sourceAccountId },
        data: { balance: { decrement: amount } },
      });

      // Credit destination
      await db.account.update({
        where: { id: destinationAccountId },
        data: { balance: { increment: amount } },
      });

      // Create transaction record
      const transaction = await db.transaction.create({
        data: {
          sourceAccountId,
          destinationBankSwift: 'UZU-DOMESTIC',
          destinationIban: destAccount.accountNumber,
          sourceAmount: amount,
          sourceCurrency: sourceAccount.currency,
          destinationAmount: amount,
          destinationCurrency: destAccount.currency,
          exchangeRate: 1.0,
          status: 'SETTLED',
          blockchainTxHash: generateTxHash(),
          initiatedById: decoded.sub,
          destinationAccountId,
        },
      });

      return transaction;
    });

    // Notify with the EXACT amount transferred (2 decimals preserved).
    const fromLabel = sourceAccount.accountType === 'SAVINGS' ? 'Savings' : 'Checking';
    const toLabel = destAccount.accountType === 'SAVINGS' ? 'Savings' : 'Checking';
    const exactAmount = formatExactAmount(amount, sourceAccount.currency);

    await prisma.notification.create({
      data: {
        userId: decoded.sub,
        title: 'Transfer Completed',
        message: `${exactAmount} transferred from ${fromLabel} to ${toLabel}`,
        type: 'INFO',
      },
    });

    return NextResponse.json(tx, { status: 201 });
  } catch (err) {
    console.error('[Domestic Transfer POST]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
