import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('Test@123456', 12);
  const pinHash = await bcrypt.hash('1234', 12);
  
  const user = await prisma.user.upsert({
    where: { email: 'demo@test.com' },
    update: {},
    create: {
      email: 'demo@test.com',
      passwordHash: hash,
      bankPinHash: pinHash,
      fullName: 'Demo User',
      countryCode: 'US',
      kycStatus: 'VERIFIED',
      accounts: {
        create: [
          { currency: 'USD', accountNumber: 'UZU-CHK-1000100100001001', balance: 25000, accountType: 'CHECKING' },
          { currency: 'EUR', accountNumber: 'UZU-CHK-1000100100001002', balance: 5000, accountType: 'CHECKING' },
          { currency: 'GBP', accountNumber: 'UZU-CHK-1000100100001003', balance: 3000, accountType: 'CHECKING' },
          { currency: 'USD', accountNumber: 'UZU-SAV-2000100100001001', balance: 15000, accountType: 'SAVINGS' },
          { currency: 'EUR', accountNumber: 'UZU-SAV-2000100100001002', balance: 2000, accountType: 'SAVINGS' },
        ],
      },
    },
  });

  console.log('Demo user created:', user.email);
  const accounts = await prisma.account.findMany({ where: { userId: user.id } });
  accounts.forEach(a => console.log(' ', a.accountType, a.currency, Number(a.balance)));
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });