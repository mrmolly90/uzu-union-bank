import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getPrisma, syncDbToBlob, resetPrisma, withUnsnapshotForce, withUnsnapshotNull } from '@/lib/prisma';
import { formatExactAmount } from '@/lib/format';
import { generate16DigitAccountNumber } from '@/lib/accounts';
import { getJwtSecret } from '@/lib/auth';
import { getCurrencyByCountryCode } from '@/lib/countries';
import { takeUserSnapshot } from '@/lib/dbSnapshot';

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

/**
 * Retry a function up to `maxRetries` times with exponential backoff.
 * Used to handle cold-start DB restore races on serverless.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      console.error(`[Admin Transactions] Retry ${attempt + 1}/${maxRetries} failed:`, err instanceof Error ? err.message : String(err));
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error('All retries exhausted');
}

export async function GET(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const transactions = await withUnsnapshotForce('Admin Transactions GET', async () => {
    const prisma = await getPrisma();
    return prisma.transaction.findMany({
      include: { sourceAccount: true, initiatedBy: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const prisma = await getPrisma();
    const { userId, type, amount, currency, description, accountType } = await req.json();

    if (!userId || !amount || !currency) {
      return NextResponse.json({ error: 'userId, amount, and currency required' }, { status: 400 });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number.' }, { status: 400 });
    }

    // Auto-detect user's country currency for the funding — use unsnapshot
    const user = await withUnsnapshotNull('Admin Transactions POST', async () => {
      const p = await getPrisma();
      return p.user.findUnique({ where: { id: userId }, select: { id: true, countryCode: true } });
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    const homeCurrency = getCurrencyByCountryCode(user.countryCode);
    const effectiveCurrency = currency || homeCurrency;

    const targetType = accountType || 'CHECKING';

    // Execute everything in a single transaction for atomicity
    const tx = await prisma.$transaction(async (db: any) => {
      // Find or create account inside the transaction
      let account = await db.account.findFirst({
        where: { userId, currency: effectiveCurrency, accountType: targetType },
      });

      if (!account) {
        account = await db.account.findFirst({
          where: { userId, currency: effectiveCurrency },
        });
      }

      if (!account) {
        account = await db.account.create({
          data: {
            userId,
            currency: effectiveCurrency,
            accountNumber: generate16DigitAccountNumber(),
            balance: 0,
            accountType: targetType,
          },
        });
      }

      // Update balance
      await db.account.update({
        where: { id: account.id },
        data: {
          balance: type === 'credit'
            ? { increment: numericAmount }
            : { decrement: Math.min(numericAmount, Number(account.balance)) },
        },
      });

      // Create transaction record — use customer ID for FK integrity
      // (initiatedBy references User model, not Admin model)
      const transaction = await db.transaction.create({
        data: {
          sourceAccountId: account.id,
          destinationBankSwift: 'UZUADMIN',
          destinationIban: 'UZU00ADMIN0001',
          sourceAmount: numericAmount,
          sourceCurrency: effectiveCurrency,
          destinationAmount: numericAmount,
          destinationCurrency: effectiveCurrency,
          exchangeRate: 1,
          status: 'SETTLED',
          blockchainTxHash: `0xadmin_${Date.now()}`,
          initiatedById: userId,
        },
      });

      // Create notification inside the same transaction for atomicity
      const exactAmount = formatExactAmount(numericAmount, effectiveCurrency);
      await db.notification.create({
        data: {
          userId,
          title: type === 'credit' ? 'Income Deposit' : 'Debit Processed',
          message: `${type === 'credit' ? '+' : '-'}${exactAmount} - ${description || 'Admin transaction'} (${targetType === 'SAVINGS' ? 'Savings' : 'Checking'})`,
          type: type === 'credit' ? 'CREDIT' : 'DEBIT',
        },
      });

      return transaction;
    });

    // Persist DB to Blob so funded data survives cold starts
    try {
      await syncDbToBlob();
      await resetPrisma();
    } catch (syncErr) {
      console.error('[Admin Transactions POST] Blob sync failed (non-fatal):', syncErr);
    }

    // Return snapshot data inline so user's dashboard updates instantly (milliseconds)
    try {
      const snapshot = await takeUserSnapshot(userId, homeCurrency);
      return NextResponse.json({ transaction: tx, snapshot }, { status: 201 });
    } catch {
      return NextResponse.json(tx, { status: 201 });
    }
  } catch (err) {
    console.error('[Admin Transactions POST]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
