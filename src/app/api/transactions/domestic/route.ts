import { NextRequest, NextResponse } from 'next/server';
import { getPrisma, syncDbToBlob, resetPrisma, withUnsnapshot, withUnsnapshotNull } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { generateTxHash } from '@/lib/utils';
import { formatExactAmount } from '@/lib/format';
import { generate16DigitAccountNumber } from '@/lib/accounts';
import { takeUserSnapshot } from '@/lib/dbSnapshot';

export async function POST(req: NextRequest) {
  try {
    // Auth check FIRST — before any DB call, so cold-start Blob download
    // doesn't block the auth response and cause "invalid token" timeouts.
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

    // Verify source account belongs to the user — with unsnapshot
    const sourceAccount = await withUnsnapshotNull('Domestic Transfer', async () => {
      const prisma = await getPrisma();
      return prisma.account.findFirst({
        where: { id: sourceAccountId, userId: decoded.sub },
      });
    });

    if (!sourceAccount) {
      return NextResponse.json({ error: 'Source account not found.' }, { status: 404 });
    }

    if (Number(sourceAccount.balance) < amount) {
      return NextResponse.json({ error: 'Insufficient funds.' }, { status: 400 });
    }

    const prisma = await getPrisma();

    // Find or auto-create destination account (new users may only have one account type)
    let destAccount = await prisma.account.findFirst({
      where: { id: destinationAccountId, userId: decoded.sub },
    });

    if (!destAccount) {
      // Destination account doesn't exist — auto-create it with same currency
      const targetType = sourceAccount.accountType === 'CHECKING' ? 'SAVINGS' : 'CHECKING';
      destAccount = await prisma.account.create({
        data: {
          userId: decoded.sub,
          currency: sourceAccount.currency,
          accountNumber: generate16DigitAccountNumber(),
          balance: 0,
          accountType: targetType,
          isActive: true,
        },
      });
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
        where: { id: destAccount.id },
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
          destinationAccountId: destAccount.id,
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

    // Persist DB to Blob
    try {
      await syncDbToBlob();
      await resetPrisma();
    } catch (syncErr) {
      console.error('[Domestic Transfer POST] Blob sync failed (non-fatal):', syncErr);
    }

    // Return snapshot data inline so user's dashboard updates instantly (milliseconds)
    try {
      const snapshot = await takeUserSnapshot(decoded.sub);
      return NextResponse.json({ transaction: tx, snapshot }, { status: 201 });
    } catch {
      return NextResponse.json(tx, { status: 201 });
    }
  } catch (err) {
    console.error('[Domestic Transfer POST]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
