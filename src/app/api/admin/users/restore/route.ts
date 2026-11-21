import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getPrisma, syncDbToBlob, resetPrisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { generate16DigitAccountNumber } from '@/lib/accounts';
import { getJwtSecret } from '@/lib/auth';

function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), getJwtSecret()) as any;
    if (!decoded || !decoded.role) return null;
    return decoded;
  } catch { return null; }
}

const RESTORE_USERS = [
  {
    email: 'alice@example.com',
    password: 'Alice@2026',
    pin: '1234',
    fullName: 'Alice Johnson',
    countryCode: 'US',
    accounts: [
      { currency: 'USD', type: 'CHECKING', balance: 15000 },
      { currency: 'USD', type: 'SAVINGS', balance: 45000 },
      { currency: 'EUR', type: 'CHECKING', balance: 5000 },
      { currency: 'EUR', type: 'SAVINGS', balance: 10000 },
      { currency: 'GBP', type: 'CHECKING', balance: 3000 },
    ],
  },
  {
    email: 'bob@example.com',
    password: 'Bob@2026',
    pin: '5678',
    fullName: 'Bob Williams',
    countryCode: 'GB',
    accounts: [
      { currency: 'GBP', type: 'CHECKING', balance: 12000 },
      { currency: 'GBP', type: 'SAVINGS', balance: 35000 },
      { currency: 'USD', type: 'CHECKING', balance: 8000 },
      { currency: 'EUR', type: 'CHECKING', balance: 4000 },
    ],
  },
  {
    email: 'carol@example.com',
    password: 'Carol@2026',
    pin: '9012',
    fullName: 'Carol Schmidt',
    countryCode: 'DE',
    accounts: [
      { currency: 'EUR', type: 'CHECKING', balance: 20000 },
      { currency: 'EUR', type: 'SAVINGS', balance: 60000 },
      { currency: 'USD', type: 'CHECKING', balance: 5000 },
      { currency: 'GBP', type: 'CHECKING', balance: 2000 },
    ],
  },
  {
    email: 'david@example.com',
    password: 'David@2026',
    pin: '3456',
    fullName: 'David Kim',
    countryCode: 'KR',
    accounts: [
      { currency: 'USD', type: 'CHECKING', balance: 25000 },
      { currency: 'USD', type: 'SAVINGS', balance: 55000 },
      { currency: 'EUR', type: 'CHECKING', balance: 7000 },
      { currency: 'KRW', type: 'CHECKING', balance: 50000000 },
    ],
  },
  {
    email: 'emma@example.com',
    password: 'Emma@2026',
    pin: '7890',
    fullName: 'Emma Okafor',
    countryCode: 'NG',
    accounts: [
      { currency: 'USD', type: 'CHECKING', balance: 8000 },
      { currency: 'USD', type: 'SAVINGS', balance: 20000 },
      { currency: 'NGN', type: 'CHECKING', balance: 5000000 },
      { currency: 'NGN', type: 'SAVINGS', balance: 15000000 },
      { currency: 'EUR', type: 'CHECKING', balance: 2000 },
    ],
  },
  {
    email: 'frank@example.com',
    password: 'Frank@2026',
    pin: '2345',
    fullName: 'Frank Chen',
    countryCode: 'SG',
    accounts: [
      { currency: 'USD', type: 'CHECKING', balance: 35000 },
      { currency: 'USD', type: 'SAVINGS', balance: 85000 },
      { currency: 'SGD', type: 'CHECKING', balance: 50000 },
      { currency: 'SGD', type: 'SAVINGS', balance: 120000 },
      { currency: 'EUR', type: 'CHECKING', balance: 10000 },
    ],
  },
  {
    email: 'grace@example.com',
    password: 'Grace@2026',
    pin: '6789',
    fullName: 'Grace Patel',
    countryCode: 'IN',
    accounts: [
      { currency: 'USD', type: 'CHECKING', balance: 10000 },
      { currency: 'USD', type: 'SAVINGS', balance: 30000 },
      { currency: 'INR', type: 'CHECKING', balance: 500000 },
      { currency: 'INR', type: 'SAVINGS', balance: 1500000 },
    ],
  },
  {
    email: 'henry@example.com',
    password: 'Henry@2026',
    pin: '0123',
    fullName: 'Henry Silva',
    countryCode: 'BR',
    accounts: [
      { currency: 'USD', type: 'CHECKING', balance: 12000 },
      { currency: 'USD', type: 'SAVINGS', balance: 40000 },
      { currency: 'BRL', type: 'CHECKING', balance: 75000 },
      { currency: 'BRL', type: 'SAVINGS', balance: 200000 },
      { currency: 'EUR', type: 'CHECKING', balance: 3000 },
    ],
  },
];

export async function POST(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const prisma = await getPrisma();
    const results: any[] = [];
    let created = 0;
    let skipped = 0;

    for (const demo of RESTORE_USERS) {
      const existing = await prisma.user.findUnique({ where: { email: demo.email } });
      if (existing) {
        skipped++;
        results.push({ email: demo.email, status: 'skipped', fullName: demo.fullName });
        continue;
      }

      const passwordHash = await hashPassword(demo.password);
      const bankPinHash = await hashPassword(demo.pin);

      const user = await prisma.user.create({
        data: {
          email: demo.email,
          passwordHash,
          bankPinHash,
          fullName: demo.fullName,
          countryCode: demo.countryCode,
          kycStatus: 'VERIFIED',
          accounts: {
            create: demo.accounts.map((acct) => ({
              currency: acct.currency,
              accountType: acct.type,
              balance: acct.balance,
              accountNumber: generate16DigitAccountNumber(),
            })),
          },
        },
        include: { accounts: true },
      });

      // Welcome notification
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: 'Account Restored',
          message: `Welcome back, ${demo.fullName}! Your accounts have been restored.`,
          type: 'INFO',
        },
      });

      const totalBalance = user.accounts.reduce((s, a) => s + Number(a.balance), 0);
      created++;
      results.push({
        email: demo.email,
        status: 'created',
        fullName: demo.fullName,
        accounts: demo.accounts.length,
        totalBalance,
      });
    }

    // Persist to Blob
    try {
      await syncDbToBlob();
      await resetPrisma();
    } catch (syncErr) {
      console.error('[Admin Restore Users] Blob sync failed:', syncErr);
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      results,
    });
  } catch (err) {
    console.error('[Admin Restore Users]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    availableUsers: RESTORE_USERS.map((u) => ({
      email: u.email,
      fullName: u.fullName,
      countryCode: u.countryCode,
    })),
    totalTemplates: RESTORE_USERS.length,
  });
}