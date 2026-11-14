/* ==========================================================================
   UZU UNION BANK — Prisma Seed Script
   Seeds the database with demo user, accounts, and exchange rates.
   ========================================================================== */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ALL_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'SGD', 'AED', 'AFN', 'ALL', 'AMD',
  'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BGN',
  'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN',
  'BZD', 'CAD', 'CDF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CVE', 'CZK',
  'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'FJD', 'FKP', 'GEL',
  'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG',
  'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'KES',
  'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP',
  'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT',
  'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN',
  'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR',
  'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR',
  'SDG', 'SEK', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SVC', 'SYP',
  'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS',
  'UAH', 'UGX', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD',
  'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWL',
];

async function main() {
  console.log('Seeding database…');

  // Create demo user
  const passwordHash = await bcrypt.hash('Welcome@2026', 12);
  const bankPinHash = await bcrypt.hash('1234', 12);
  const user = await prisma.user.upsert({
    where: { email: 'admin@uzudigitalunion.com' },
    update: {},
    create: {
      email: 'admin@uzudigitalunion.com',
      passwordHash,
      bankPinHash,
      fullName: 'James Mitchell',
      countryCode: 'US',
      kycStatus: 'VERIFIED',
      accounts: {
        create: [
          // Checking accounts — start at $0 until admin deposits
          { currency: 'USD', accountNumber: '1000000100001001', balance: 0, accountType: 'CHECKING' },
          { currency: 'EUR', accountNumber: '1000000100001002', balance: 0, accountType: 'CHECKING' },
          { currency: 'GBP', accountNumber: '1000000100001003', balance: 0, accountType: 'CHECKING' },
          // Savings accounts — start at $0 until admin deposits
          { currency: 'USD', accountNumber: '2000000100001001', balance: 0, accountType: 'SAVINGS' },
          { currency: 'EUR', accountNumber: '2000000100001002', balance: 0, accountType: 'SAVINGS' },
          { currency: 'GBP', accountNumber: '2000000100001003', balance: 0, accountType: 'SAVINGS' },
          { currency: 'CHF', accountNumber: '2000000100001004', balance: 0, accountType: 'SAVINGS' },
        ],
      },
    },
  });

  console.log(`  ✓ Account opened: admin@uzudigitalunion.com / Welcome@2026`);

  // Create admin user
  const adminHash = await bcrypt.hash('admin@2026', 12);
  await prisma.admin.upsert({
    where: { email: 'admin@uzudigitalunion.com' },
    // Update the hash as well: with `update: {}` a re-seed left a stale
    // password in the database, so 'admin@2026' could never authenticate.
    update: { passwordHash: adminHash, role: 'SUPER_ADMIN' },
    create: {
      email: 'admin@uzudigitalunion.com',
      passwordHash: adminHash,
      fullName: 'System Administrator',
      role: 'SUPER_ADMIN',
    },
  });

  console.log(`  ✓ Admin ready: admin@uzudigitalunion.com / admin@2026`);

  // Create exchange rates for major pairs
  const majorRates = [
    { base: 'USD', quote: 'EUR', rate: 0.9222, bid: 0.9218, ask: 0.9226 },
    { base: 'USD', quote: 'GBP', rate: 0.7920, bid: 0.7916, ask: 0.7924 },
    { base: 'USD', quote: 'JPY', rate: 149.94, bid: 149.88, ask: 150.00 },
    { base: 'USD', quote: 'CHF', rate: 0.8806, bid: 0.8802, ask: 0.8810 },
    { base: 'USD', quote: 'SGD', rate: 1.3245, bid: 1.3240, ask: 1.3250 },
    { base: 'USD', quote: 'AED', rate: 3.6730, bid: 3.6725, ask: 3.6735 },
    { base: 'USD', quote: 'AUD', rate: 1.5420, bid: 1.5415, ask: 1.5425 },
    { base: 'USD', quote: 'CAD', rate: 1.3740, bid: 1.3735, ask: 1.3745 },
    { base: 'USD', quote: 'CNY', rate: 7.2450, bid: 7.2400, ask: 7.2500 },
    { base: 'USD', quote: 'HKD', rate: 7.8200, bid: 7.8180, ask: 7.8220 },
    { base: 'USD', quote: 'INR', rate: 83.4500, bid: 83.4000, ask: 83.5000 },
    { base: 'USD', quote: 'KRW', rate: 1325.00, bid: 1324.00, ask: 1326.00 },
    { base: 'USD', quote: 'MXN', rate: 17.2500, bid: 17.2000, ask: 17.3000 },
    { base: 'USD', quote: 'NGN', rate: 1550.00, bid: 1545.00, ask: 1555.00 },
    { base: 'USD', quote: 'NOK', rate: 10.8500, bid: 10.8400, ask: 10.8600 },
    { base: 'USD', quote: 'NZD', rate: 1.6650, bid: 1.6645, ask: 1.6655 },
    { base: 'USD', quote: 'SEK', rate: 10.5200, bid: 10.5100, ask: 10.5300 },
    { base: 'USD', quote: 'TRY', rate: 30.2500, bid: 30.2000, ask: 30.3000 },
    { base: 'USD', quote: 'ZAR', rate: 18.7500, bid: 18.7000, ask: 18.8000 },
    { base: 'EUR', quote: 'USD', rate: 1.0843, bid: 1.0839, ask: 1.0847 },
    { base: 'GBP', quote: 'USD', rate: 1.2626, bid: 1.2622, ask: 1.2630 },
    { base: 'EUR', quote: 'GBP', rate: 0.8590, bid: 0.8586, ask: 0.8594 },
    { base: 'GBP', quote: 'EUR', rate: 1.1641, bid: 1.1637, ask: 1.1645 },
    { base: 'EUR', quote: 'JPY', rate: 162.50, bid: 162.40, ask: 162.60 },
    { base: 'GBP', quote: 'JPY', rate: 189.20, bid: 189.10, ask: 189.30 },
    { base: 'AUD', quote: 'USD', rate: 0.6485, bid: 0.6480, ask: 0.6490 },
    { base: 'CAD', quote: 'USD', rate: 0.7278, bid: 0.7273, ask: 0.7283 },
  ];

  for (const r of majorRates) {
    await prisma.exchangeRate.upsert({
      where: { base_quote: { base: r.base, quote: r.quote } },
      update: { rate: r.rate, bid: r.bid, ask: r.ask },
      create: {
        base: r.base,
        quote: r.quote,
        rate: r.rate,
        bid: r.bid,
        ask: r.ask,
      },
    });
  }

  console.log(`  ✓ ${majorRates.length} exchange rates seeded`);
  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });