import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getPrisma, syncDbToBlob, resetPrisma, withUnsnapshot } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/auth';
import { generate16DigitAccountNumber } from '@/lib/accounts';
import { getCurrencyByCountryCode } from '@/lib/countries';
import { formatExactAmount } from '@/lib/format';
import { takeUserSnapshot } from '@/lib/dbSnapshot';

function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), getJwtSecret()) as any;
    if (!decoded || !decoded.role) return null;
    return decoded;
  } catch { return null; }
}

/**
 * GET /api/admin/crypto/deposits
 * Returns ALL crypto deposit requests (PENDING first, then by date).
 */
export async function GET(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const prisma = await getPrisma();
    const deposits = await withUnsnapshot('Admin Crypto Deposits GET', async () => {
      const prisma = await getPrisma();
      return prisma.cryptoDeposit.findMany({
        include: {
          user: { select: { id: true, fullName: true, email: true, countryCode: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 100,
      });
    });

    return NextResponse.json(deposits);
  } catch (err) {
    console.error('[Admin Crypto Deposits GET]', err);
    return NextResponse.json({ error: 'Failed to fetch deposits.' }, { status: 500 });
  }
}

/**
 * POST /api/admin/crypto/deposits
 * Approve or reject a crypto deposit. On approval, credits the user's checking account.
 */
export async function POST(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const prisma = await getPrisma();
    const { depositId, action } = await req.json();

    if (!depositId || !['APPROVED', 'REJECTED'].includes(action)) {
      return NextResponse.json({ error: 'depositId and action (APPROVED|REJECTED) required' }, { status: 400 });
    }

    // Get the deposit with user info
    const deposit = await prisma.cryptoDeposit.findUnique({
      where: { id: depositId },
      include: { user: { select: { id: true, countryCode: true } } },
    });

    if (!deposit) {
      return NextResponse.json({ error: 'Deposit not found.' }, { status: 404 });
    }

    if (deposit.status !== 'PENDING') {
      return NextResponse.json({ error: 'Deposit already processed.' }, { status: 400 });
    }

    if (action === 'REJECTED') {
      // Just mark as rejected
      await prisma.cryptoDeposit.update({
        where: { id: depositId },
        data: { status: 'REJECTED', adminId: admin.sub },
      });

      await prisma.notification.create({
        data: {
          userId: deposit.userId,
          title: 'Crypto Deposit Rejected',
          message: `Your ${deposit.amount} ${deposit.symbol} deposit was rejected. Please contact support.`,
          type: 'INFO',
        },
      });

      try {
        await syncDbToBlob();
        await resetPrisma();
      } catch {}

      return NextResponse.json({ message: 'Deposit rejected.' });
    }

    // APPROVED — credit the user's checking account
    const homeCurrency = getCurrencyByCountryCode(deposit.user.countryCode);
    const numericAmount = parseFloat(deposit.amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: 'Invalid deposit amount.' }, { status: 400 });
    }

    // Execute in a transaction
    await prisma.$transaction(async (db: any) => {
      // Find or create checking account in user's home currency
      let account = await db.account.findFirst({
        where: { userId: deposit.userId, currency: homeCurrency, accountType: 'CHECKING' },
      });

      if (!account) {
        account = await db.account.create({
          data: {
            userId: deposit.userId,
            currency: homeCurrency,
            accountNumber: generate16DigitAccountNumber(),
            balance: 0,
            accountType: 'CHECKING',
          },
        });
      }

      // Credit the account
      await db.account.update({
        where: { id: account.id },
        data: { balance: { increment: numericAmount } },
      });

      // Create transaction record
      await db.transaction.create({
        data: {
          sourceAccountId: account.id,
          destinationBankSwift: 'UZU-CRYPTO',
          destinationIban: 'UZU00CRYPTO0001',
          sourceAmount: numericAmount,
          sourceCurrency: homeCurrency,
          destinationAmount: numericAmount,
          destinationCurrency: homeCurrency,
          exchangeRate: 1,
          status: 'SETTLED',
          blockchainTxHash: deposit.blockchainTxHash,
          initiatedById: deposit.userId,
        },
      });

      // Mark deposit as approved
      await db.cryptoDeposit.update({
        where: { id: depositId },
        data: { status: 'APPROVED', adminId: admin.sub },
      });

      // Create notification
      const exactAmount = formatExactAmount(numericAmount, homeCurrency);
      await db.notification.create({
        data: {
          userId: deposit.userId,
          title: 'Crypto Deposit Approved',
          message: `${exactAmount} credited to your Checking account from ${deposit.amount} ${deposit.symbol} deposit.`,
          type: 'CREDIT',
        },
      });
    });

    // Persist DB to Blob
    try {
      await syncDbToBlob();
      await resetPrisma();
    } catch (syncErr) {
      console.error('[Admin Crypto Deposits POST] Blob sync failed (non-fatal):', syncErr);
    }

    // Return snapshot data inline
    try {
      const snapshot = await takeUserSnapshot(deposit.userId, getCurrencyByCountryCode(deposit.user.countryCode));
      return NextResponse.json({ message: 'Deposit approved and credited.', snapshot }, { status: 200 });
    } catch {
      return NextResponse.json({ message: 'Deposit approved and credited.' });
    }
  } catch (err) {
    console.error('[Admin Crypto Deposits POST]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}