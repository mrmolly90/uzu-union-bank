import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getPrisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'uzu-production-secret-change-me';

function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as any;
    // Customer access tokens are signed with the same secret but carry no role.
    if (!decoded || !decoded.role) return null;
    return decoded;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    include: { accounts: true, notifications: { orderBy: { createdAt: 'desc' }, take: 5 } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const prisma = getPrisma();
    const body = await req.json();
    const { userId, accountType, amount } = body;

    if (!userId || !accountType || !amount || amount <= 0) {
      return NextResponse.json({ error: 'userId, accountType, and amount are required.' }, { status: 400 });
    }

    // Find the user's savings account in USD
    const account = await prisma.account.findFirst({
      where: { userId, accountType, currency: 'USD' },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    // Credit the account
    const updated = await prisma.account.update({
      where: { id: account.id },
      data: { balance: { increment: amount } },
    });

    // Create a transaction record
    await prisma.transaction.create({
      data: {
        sourceAccountId: account.id,
        destinationBankSwift: 'UZU-ADMIN',
        destinationIban: account.accountNumber,
        sourceAmount: amount,
        sourceCurrency: 'USD',
        destinationAmount: amount,
        destinationCurrency: 'USD',
        exchangeRate: 1.0,
        status: 'SETTLED',
        blockchainTxHash: `0xadmin-${Date.now().toString(36)}`,
        initiatedById: userId,
      },
    });

    return NextResponse.json({ success: true, account: updated });
  } catch (err) {
    console.error('[Admin Fund]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
