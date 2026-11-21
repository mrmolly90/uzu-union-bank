/* ==========================================================================
   UZU UNION BANK — User & Account Restoration Script
   Re-creates lost users with initial account funding.
   Runs against the local or live SQLite database.
   Usage: npx tsx scripts/restore-users.ts
   ========================================================================== */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

/** Generate a 16-digit account number. */
function generateAccountNumber(): string {
  const max = BigInt('10000000000000000');
  const raw = BigInt('0x' + crypto.randomBytes(8).toString('hex'));
  return (raw % max).toString().padStart(16, '0');
}

const DEMO_USERS = [
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

async function main() {
  console.log('=== Restoring Users & Accounts ===\n');

  let created = 0;
  let skipped = 0;
  let totalFunds = 0;

  for (const demo of DEMO_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: demo.email } });
    if (existing) {
      console.log(`  ⏭ Skipped ${demo.email} — already exists`);
      skipped++;
      continue;
    }

    const passwordHash = await bcrypt.hash(demo.password, 12);
    const bankPinHash = await bcrypt.hash(demo.pin, 12);

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
            accountNumber: generateAccountNumber(),
          })),
        },
      },
      include: { accounts: true },
    });

    // Create welcome notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Account Restored',
        message: `Welcome back, ${demo.fullName}! Your accounts have been restored with your previous balances.`,
        type: 'INFO',
      },
    });

    const userTotal = user.accounts.reduce((s, a) => s + Number(a.balance), 0);
    totalFunds += userTotal;
    created++;
    console.log(`  ✅ Created ${demo.email} (${demo.fullName}) — ${demo.accounts.length} accounts, $${userTotal.toLocaleString()} total`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Created: ${created} users`);
  console.log(`  Skipped (already exist): ${skipped} users`);
  console.log(`  Total funds deployed: $${totalFunds.toLocaleString()}`);

  // Also verify the demo admin user exists
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@uzudigitalunion.com' } });
  if (!adminUser) {
    console.log('\n  ⚠️ Demo admin user (admin@uzudigitalunion.com) not found in User table!');
  } else {
    console.log(`\n  ✓ Demo user admin@uzudigitalunion.com exists`);
  }

  const adminRecord = await prisma.admin.findUnique({ where: { email: 'admin@uzudigitalunion.com' } });
  if (!adminRecord) {
    console.log('  ⚠️ Admin record not found! Run seed script first.');
  } else {
    console.log('  ✓ Admin record exists');
  }

  const userCount = await prisma.user.count();
  const accountCount = await prisma.account.count();
  console.log(`\n  Total users: ${userCount}`);
  console.log(`  Total accounts: ${accountCount}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Restore failed:', e);
  process.exit(1);
});