import { NextRequest, NextResponse } from 'next/server';
import { getPrisma, syncDbToBlob, resetPrisma } from '@/lib/prisma';
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

    const transferFee = fee || Math.max(3, sourceAmount * 0.001);
    const totalDebit = sourceAmount + transferFee;

    if (Number(sourceAccount.balance) < totalDebit) {
      return NextResponse.json({ error: 'Insufficient funds. You need additional funds to cover the transfer fee.' }, { status: 400 });
    }

    // Get exchange rate — supports both direct (USD→EUR) and indirect (EUR→GBP)
    // lookup: all stored rates are USD-quoted, so cross-pairs are computed.
    let rate: { base: string; quote: string; rate: number } | null = null;

    if (sourceAccount.currency === destinationCurrency) {
      // Same-currency transfer: rate is 1
      rate = { base: sourceAccount.currency, quote: destinationCurrency, rate: 1 };
    } else {
      const direct = await prisma.exchangeRate.findUnique({
        where: {
          base_quote: {
            base: sourceAccount.currency as any,
            quote: destinationCurrency as any,
          },
        },
      });
      if (direct) {
        rate = { base: direct.base, quote: direct.quote, rate: Number(direct.rate) };
      } else if (sourceAccount.currency === 'USD') {
        // USD → X: direct lookup
        const usdRate = await prisma.exchangeRate.findUnique({
          where: { base_quote: { base: 'USD', quote: destinationCurrency as any } },
        });
        if (usdRate) rate = { base: 'USD', quote: destinationCurrency, rate: Number(usdRate.rate) };
      } else {
        // Cross-pair: sourceCurrency → USD (inverse) then USD → destCurrency
        const toUsd = await prisma.exchangeRate.findUnique({
          where: { base_quote: { base: 'USD', quote: sourceAccount.currency as any } },
        });
        const fromUsd = await prisma.exchangeRate.findUnique({
          where: { base_quote: { base: 'USD', quote: destinationCurrency as any } },
        });
        if (toUsd && fromUsd) {
          const usdPerSource = Number(toUsd.rate);
          const destPerUsd = Number(fromUsd.rate);
          rate = {
            base: sourceAccount.currency,
            quote: destinationCurrency,
            rate: destPerUsd / usdPerSource,
          };
        } else if (toUsd && destinationCurrency === 'USD') {
          // sourceCurrency → USD
          rate = {
            base: sourceAccount.currency,
            quote: 'USD',
            rate: 1 / Number(toUsd.rate),
          };
        }
      }
    }

    if (!rate) {
      return NextResponse.json(
        { error: `Exchange rate ${sourceAccount.currency}/${destinationCurrency} is unavailable.` },
        { status: 503 }
      );
    }

    const exchangeRate = Number(rate.rate);
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

    // Persist DB to Blob
    await syncDbToBlob();

    // Reset Prisma client so subsequent reads see the new transaction
    await resetPrisma();

    return NextResponse.json(tx, { status: 201 });
  } catch (err) {
    console.error('[Transactions POST]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
