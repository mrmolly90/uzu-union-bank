import { NextRequest, NextResponse } from 'next/server';
import { getPrisma, syncDbToBlob, resetPrisma, withUnsnapshot, withUnsnapshotNull } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { generateTxHash } from '@/lib/utils';
import { formatExactAmount } from '@/lib/format';
import { transferSchema } from '@/lib/validations';
import { takeUserSnapshot } from '@/lib/dbSnapshot';

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
      console.error(`[Transactions] Retry ${attempt + 1}/${maxRetries} failed:`, err instanceof Error ? err.message : String(err));
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error('All retries exhausted');
}

/** Fallback FX rates used when the database doesn't have a pair. */
const FALLBACK_RATES: Record<string, number> = {
  'USD': 1, 'EUR': 0.9222, 'GBP': 0.7920, 'JPY': 149.94, 'CHF': 0.8806,
  'SGD': 1.3245, 'AED': 3.6730, 'AUD': 1.5420, 'CAD': 1.3740, 'CNY': 7.2450,
  'HKD': 7.8200, 'INR': 83.45, 'KRW': 1325.0, 'MXN': 17.25, 'NGN': 1550.0,
  'NOK': 10.85, 'NZD': 1.6650, 'SEK': 10.52, 'TRY': 30.25, 'ZAR': 18.75,
  'BRL': 5.12, 'PHP': 56.20, 'THB': 35.80, 'MYR': 4.72, 'IDR': 15750,
  'VND': 25450, 'SAR': 3.75, 'QAR': 3.64, 'KWD': 0.308, 'OMR': 0.385,
  'BHD': 0.376, 'PLN': 4.02, 'DKK': 6.88, 'CZK': 23.15, 'HUF': 362.5,
  'RON': 4.62, 'BGN': 1.80, 'HRK': 6.95, 'ISK': 138.5, 'RUB': 92.5,
  'EGP': 30.90, 'KES': 145.0, 'GHS': 12.85, 'TZS': 2520, 'UGX': 3800,
  'ETB': 56.50, 'MAD': 10.15, 'DZD': 135.0, 'TND': 3.12, 'PKR': 278.5,
  'BDT': 109.5, 'LKR': 310.0, 'NPR': 133.5, 'AFN': 72.5,
};

/** Look up an exchange rate — first in DB, then from fallback map. */
async function lookupRate(
  prisma: any,
  base: string,
  quote: string
): Promise<number | null> {
  // Direct lookup in DB
  const dbRate = await prisma.exchangeRate.findUnique({
    where: { base_quote: { base, quote } },
  });
  if (dbRate) return Number(dbRate.rate);

  // Inverse lookup in DB
  const inverse = await prisma.exchangeRate.findUnique({
    where: { base_quote: { base: quote, quote: base } },
  });
  if (inverse) return 1 / Number(inverse.rate);

  // Fallback: convert via USD
  const baseToUsd = base === 'USD' ? 1 : (FALLBACK_RATES[base] ? 1 / FALLBACK_RATES[base] : null);
  const quoteFromUsd = quote === 'USD' ? 1 : (FALLBACK_RATES[quote] ?? null);
  if (baseToUsd !== null && quoteFromUsd !== null) {
    return quoteFromUsd * baseToUsd;
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided.' }, { status: 401 });
    }

    const decoded = verifyAccessToken(authHeader.slice(7));
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token.' }, { status: 401 });
    }

    const transactions = await withUnsnapshot('Transactions GET', async () => {
      const prisma = await getPrisma();
      return prisma.transaction.findMany({
        where: { initiatedById: decoded.sub },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    return NextResponse.json(transactions);
  } catch (err) {
    console.error('[Transactions GET]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

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

    const prisma = await getPrisma();
    const body = await req.json();
    const parsed = transferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map((e) => e.message).join(' ') },
        { status: 400 }
      );
    }

    const { sourceAccountId, destinationBankSwift, destinationBankName, destinationIban, sourceAmount, destinationCurrency, fee } = parsed.data;

    // Check if user's transfers are paused by admin — with unsnapshot
    const userRecord = await withUnsnapshotNull('Transfer POST user', async () => {
      const p = await getPrisma();
      return p.user.findUnique({
        where: { id: decoded.sub },
        select: { transferPaused: true },
      });
    });
    if (userRecord?.transferPaused) {
      return NextResponse.json(
        { error: 'Your wire transfer capability has been paused by admin. Please contact support.' },
        { status: 403 }
      );
    }

    // Verify source account belongs to user — with unsnapshot
    const sourceAccount = await withUnsnapshotNull('Transfer POST account', async () => {
      const p = await getPrisma();
      return p.account.findFirst({
        where: { id: sourceAccountId, userId: decoded.sub },
      });
    });

    if (!sourceAccount) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    const transferFee = fee || Math.max(3, sourceAmount * 0.001);
    const totalDebit = sourceAmount + transferFee;

    if (Number(sourceAccount.balance) < totalDebit) {
      return NextResponse.json({ error: 'Insufficient funds. You need additional funds to cover the transfer fee.' }, { status: 400 });
    }

    // Get exchange rate using lookupRate (DB first, then fallback map)
    let exchangeRate: number | null = null;

    if (sourceAccount.currency === destinationCurrency) {
      // Same-currency transfer: rate is 1
      exchangeRate = 1;
    } else {
      exchangeRate = await lookupRate(prisma, sourceAccount.currency, destinationCurrency);
    }

    if (exchangeRate === null) {
      return NextResponse.json(
        { error: `Exchange rate ${sourceAccount.currency}/${destinationCurrency} is unavailable.` },
        { status: 503 }
      );
    }

    const destinationAmount = sourceAmount * exchangeRate;

    // Execute wire in a transaction (double-entry bookkeeping)
    const tx = await prisma.$transaction(async (tx: any) => {
      // Debit source (amount + fee)
      await tx.account.update({
        where: { id: sourceAccountId },
        data: { balance: { decrement: totalDebit } },
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

    // Notify user of the wire initiation
    await prisma.notification.create({
      data: {
        userId: decoded.sub,
        title: 'International Wire Initiated',
        message: `${formatExactAmount(sourceAmount, sourceAccount.currency)} → ${formatExactAmount(destinationAmount, destinationCurrency)} to ${destinationBankName || destinationBankSwift} (${destinationIban})`,
        type: 'DEBIT',
      },
    });

    // Persist DB to Blob so data survives cold starts
    try {
      await syncDbToBlob();
      await resetPrisma();
    } catch (syncErr) {
      console.error('[Transactions POST] Blob sync failed (non-fatal):', syncErr);
    }

    // Return snapshot data inline so user's dashboard updates instantly (milliseconds)
    try {
      const snapshot = await takeUserSnapshot(decoded.sub);
      return NextResponse.json({ transaction: tx, snapshot }, { status: 201 });
    } catch {
      return NextResponse.json(tx, { status: 201 });
    }
  } catch (err) {
    console.error('[Transactions POST]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
