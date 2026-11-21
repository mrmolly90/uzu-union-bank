import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getPrisma, syncDbToBlob, resetPrisma } from '@/lib/prisma';
import { formatExactAmount } from '@/lib/format';
import { getJwtSecret } from '@/lib/auth';

function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), getJwtSecret()) as any;
    // Customer access tokens are signed with the same secret but carry no role.
    if (!decoded || !decoded.role) return null;
    return decoded;
  } catch { return null; }
}

export async function PATCH(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const prisma = await getPrisma();
    const { transactionId, status, failureReason } = await req.json();

    if (!transactionId || !status) {
      return NextResponse.json({ error: 'transactionId and status required' }, { status: 400 });
    }

    const validStatuses = ['INITIATED', 'HASHED', 'MULTISIG_PENDING', 'CLEARED', 'SETTLED', 'FAILED', 'REVERSED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const tx = await prisma.transaction.findUnique({ where: { id: transactionId }, include: { sourceAccount: true } });
    if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

    // Exact amounts, 2 decimals preserved, with the real source currency.
    const exactAmount = formatExactAmount(Number(tx.sourceAmount), tx.sourceCurrency);
    const exactRefund = formatExactAmount(
      Number(tx.sourceAmount) + Number(tx.fee),
      tx.sourceCurrency
    );

    // If reversing, credit the amount + fee back to the source account
    if (status === 'REVERSED' && tx.status !== 'REVERSED' && tx.status !== 'FAILED') {
      await prisma.account.update({
        where: { id: tx.sourceAccountId },
        data: { balance: { increment: Number(tx.sourceAmount) + Number(tx.fee) } },
      });

      await prisma.notification.create({
        data: {
          userId: tx.initiatedById,
          title: 'Transfer Reversed',
          message: `${exactRefund} refunded to your account - ${failureReason || 'Admin reversal'}`,
          type: 'INFO',
        },
      });
    }

    // If settling, create a credit notification
    if (status === 'SETTLED' && tx.status !== 'SETTLED') {
      await prisma.notification.create({
        data: {
          userId: tx.initiatedById,
          title: 'Transfer Completed',
          message: `${exactAmount} settled to ${tx.destinationBankName || tx.destinationBankSwift}`,
          type: 'CREDIT',
        },
      });
    }

    // If failing, refund + notify user
    if (status === 'FAILED' && tx.status !== 'FAILED') {
      await prisma.account.update({
        where: { id: tx.sourceAccountId },
        data: { balance: { increment: Number(tx.sourceAmount) + Number(tx.fee) } },
      });

      await prisma.notification.create({
        data: {
          userId: tx.initiatedById,
          title: 'Transfer Failed',
          message: `${exactAmount} failed - ${failureReason || 'Transaction failed'}. ${exactRefund} refunded to your account.`,
          type: 'DEBIT',
        },
      });
    }

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: { status, failureReason: failureReason || null },
    });

    // Persist DB to Blob so status changes survive cold starts
    await syncDbToBlob();
    await resetPrisma();

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[Admin Transaction Status]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
