import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { formatExactAmount } from '@/lib/format';
import { generate16DigitAccountNumber } from '@/lib/accounts';
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

export async function GET(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prisma = getPrisma();
  const transactions = await prisma.transaction.findMany({
    include: { sourceAccount: true, initiatedBy: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const prisma = getPrisma();
    const { userId, type, amount, currency, description, accountType } = await req.json();

    if (!userId || !amount || !currency) {
      return NextResponse.json({ error: 'userId, amount, and currency required' }, { status: 400 });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number.' }, { status: 400 });
    }

    const targetType = accountType || 'CHECKING';

    // Find account for this currency and type
    let account = await prisma.account.findFirst({
      where: { userId, currency, accountType: targetType },
    });

    if (!account) {
      account = await prisma.account.findFirst({
        where: { userId, currency },
      });
    }

    if (!account) {
      account = await prisma.account.create({
        data: {
          userId,
          currency,
          accountNumber: generate16DigitAccountNumber(),
          balance: 0,
          accountType: targetType,
        },
      });
    }

    const tx = await prisma.$transaction(async (db) => {
      const updated = await db.account.update({
        where: { id: account!.id },
        data: {
          balance: type === 'credit'
            ? { increment: numericAmount }
            : { decrement: Math.min(numericAmount, Number(account!.balance)) },
        },
      });

      return db.transaction.create({
        data: {
          sourceAccountId: account!.id,
          destinationBankSwift: 'UZUADMIN',
          destinationIban: 'UZU00ADMIN0001',
          sourceAmount: numericAmount,
          sourceCurrency: currency,
          destinationAmount: numericAmount,
          destinationCurrency: currency,
          exchangeRate: 1,
          status: 'SETTLED',
          blockchainTxHash: `0xadmin_${Date.now()}`,
          initiatedById: userId,
        },
      });
    });

    // Notification with the exact amount (cents preserved) and real currency.
    const exactAmount = formatExactAmount(numericAmount, currency);

    await prisma.notification.create({
      data: {
        userId,
        title: type === 'credit' ? 'Income Deposit' : 'Debit Processed',
        message: `${type === 'credit' ? '+' : '-'}${exactAmount} - ${description || 'Admin transaction'} (${targetType === 'SAVINGS' ? 'Savings' : 'Checking'})`,
        type: type === 'credit' ? 'CREDIT' : 'DEBIT',
      },
    });

    return NextResponse.json(tx, { status: 201 });
  } catch (err) {
    console.error('[Admin Transactions POST]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
