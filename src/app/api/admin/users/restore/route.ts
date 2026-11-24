import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getPrisma, syncDbToBlob, resetPrisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { generate16DigitAccountNumber } from '@/lib/accounts';
import { getJwtSecret } from '@/lib/auth';
import { getCurrencyByCountryCode } from '@/lib/countries';

function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), getJwtSecret()) as any;
    if (!decoded || !decoded.role) return null;
    return decoded;
  } catch { return null; }
}

/** Build accounts — exactly 1 CHECKING + 1 SAVINGS in user's home currency. */
function buildCountryAccounts(countryCode: string, fundAmount: number) {
  const homeCurrency = getCurrencyByCountryCode(countryCode);
  return [
    { currency: homeCurrency, accountType: 'CHECKING', balance: fundAmount, accountNumber: generate16DigitAccountNumber() },
    { currency: homeCurrency, accountType: 'SAVINGS', balance: Math.round(fundAmount * 0.5), accountNumber: generate16DigitAccountNumber() },
  ];
}

/** Users to restore — 22 fully-funded users with diverse countries. */
const RESTORE_USERS = [
  { email: 'tom.charania@gmail.com', password: 'Tom@2026', pin: '1234', fullName: 'Tom Charania', countryCode: 'US', fundAmount: 100000 },
  { email: 'tomcharania@gmail.com', password: 'Tom2@2026', pin: '4321', fullName: 'Tom C Jr', countryCode: 'US', fundAmount: 75000 },
  { email: 'entertainment@gmail.com', password: 'Enter@2026', pin: '5678', fullName: 'Entertainment Pro', countryCode: 'US', fundAmount: 50000 },
  { email: 'willkev913@gmail.com', password: 'Will@2026', pin: '1111', fullName: 'Kevin William', countryCode: 'GB', fundAmount: 25000 },
  { email: 'willingkevin9@gmail.com', password: 'Wolf@2026', pin: '2222', fullName: 'Wolf Germ', countryCode: 'DE', fundAmount: 20000 },
  { email: 'bwallet828@gmail.com', password: 'Hen@2026', pin: '3333', fullName: 'Hen xxx', countryCode: 'JP', fundAmount: 30000 },
  { email: 'alice@example.com', password: 'Alice@2026', pin: '1234', fullName: 'Alice Johnson', countryCode: 'US', fundAmount: 25000 },
  { email: 'bob@example.com', password: 'Bob@2026', pin: '5678', fullName: 'Bob Williams', countryCode: 'GB', fundAmount: 30000 },
  { email: 'carol@example.com', password: 'Carol@2026', pin: '9012', fullName: 'Carol Schmidt', countryCode: 'DE', fundAmount: 40000 },
  { email: 'david@example.com', password: 'David@2026', pin: '3456', fullName: 'David Kim', countryCode: 'KR', fundAmount: 60000 },
  { email: 'emma@example.com', password: 'Emma@2026', pin: '7890', fullName: 'Emma Okafor', countryCode: 'NG', fundAmount: 45000 },
  { email: 'frank@example.com', password: 'Frank@2026', pin: '2345', fullName: 'Frank Chen', countryCode: 'SG', fundAmount: 80000 },
  { email: 'grace@example.com', password: 'Grace@2026', pin: '6789', fullName: 'Grace Patel', countryCode: 'IN', fundAmount: 35000 },
  { email: 'henry@example.com', password: 'Henry@2026', pin: '0123', fullName: 'Henry Silva', countryCode: 'BR', fundAmount: 50000 },
  // Additional 8 users to reach 22 total
  { email: 'isabella@example.com', password: 'Isa@2026', pin: '2468', fullName: 'Isabella Rossi', countryCode: 'IT', fundAmount: 55000 },
  { email: 'james@example.com', password: 'James@2026', pin: '1357', fullName: 'James Dubois', countryCode: 'FR', fundAmount: 65000 },
  { email: 'sophia@example.com', password: 'Sophia@2026', pin: '8642', fullName: 'Sophia Müller', countryCode: 'CH', fundAmount: 120000 },
  { email: 'liam@example.com', password: 'Liam@2026', pin: '5793', fullName: 'Liam O\'Brien', countryCode: 'IE', fundAmount: 42000 },
  { email: 'olivia@example.com', password: 'Olivia@2026', pin: '6824', fullName: 'Olivia Tanaka', countryCode: 'JP', fundAmount: 72000 },
  { email: 'noah@example.com', password: 'Noah@2026', pin: '7935', fullName: 'Noah van der Meer', countryCode: 'NL', fundAmount: 88000 },
  { email: 'amelia@example.com', password: 'Amelia@2026', pin: '8046', fullName: 'Amelia Santos', countryCode: 'MX', fundAmount: 38000 },
  { email: 'ethan@example.com', password: 'Ethan@2026', pin: '9157', fullName: 'Ethan Kowalski', countryCode: 'PL', fundAmount: 28000 },
];

export async function POST(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const prisma = await getPrisma();
    const body = await req.json().catch(() => ({}));
    const wipeFirst = body?.wipeFirst === true;

    // ─── WIPE FIRST: Delete ALL existing non-admin users ───
    if (wipeFirst) {
      const allUsers = await prisma.user.findMany({ select: { id: true, email: true } });
      let wiped = 0;
      for (const user of allUsers) {
        if (user.email === 'admin@uzudigitalunion.com') continue;
        await prisma.cryptoDeposit.deleteMany({ where: { userId: user.id } });
        await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
        await prisma.notification.deleteMany({ where: { userId: user.id } });
        await prisma.transaction.deleteMany({ where: { initiatedById: user.id } });
        await prisma.auditLog.deleteMany({ where: { userId: user.id } });
        await prisma.account.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
        wiped++;
      }
      console.log(`[Restore] Wiped ${wiped} existing users before restore`);
    }

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
      const accounts = buildCountryAccounts(demo.countryCode, demo.fundAmount);

      const user = await prisma.user.create({
        data: {
          email: demo.email,
          passwordHash,
          bankPinHash,
          fullName: demo.fullName,
          countryCode: demo.countryCode,
          kycStatus: 'VERIFIED',
          accounts: { create: accounts },
        },
        include: { accounts: true },
      });

      await prisma.notification.create({
        data: {
          userId: user.id,
          title: 'Account Restored',
          message: `Welcome back, ${demo.fullName}! Your accounts have been restored with pre-funded balances.`,
          type: 'INFO',
        },
      });

      const totalBalance = user.accounts.reduce((s, a) => s + Number(a.balance), 0);
      created++;
      results.push({ email: demo.email, status: 'created', fullName: demo.fullName, country: demo.countryCode, accounts: user.accounts.length, totalBalance });
    }

    // Auto-approve KYC for ALL existing PENDING users so they can use the system
    const autoApproved = await prisma.user.updateMany({
      where: { kycStatus: 'PENDING' },
      data: { kycStatus: 'VERIFIED' },
    });

    // Persist to Blob — if this fails, the restore still succeeded locally
    // but data won't survive cold starts. Report this to the admin.
    let syncError: string | null = null;
    try {
      await syncDbToBlob();
      await resetPrisma();
    } catch (syncErr) {
      syncError = syncErr instanceof Error ? syncErr.message : String(syncErr);
      console.error('[Admin Restore Users] Blob sync failed:', syncError);
    }

    return NextResponse.json({ success: true, wiped: wipeFirst ? 'all' : 'none', created, skipped, kycApproved: autoApproved.count, syncError, results });
  } catch (err) {
    console.error('[Admin Restore Users]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ availableUsers: RESTORE_USERS.map(u => ({ email: u.email, fullName: u.fullName, countryCode: u.countryCode, fundAmount: u.fundAmount })), totalTemplates: RESTORE_USERS.length });
}