import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'demo@test.com' } });
  if (user) {
    await prisma.account.updateMany({ where: { userId: user.id, currency: 'USD', accountType: 'CHECKING' }, data: { balance: 25000 } });
    await prisma.account.updateMany({ where: { userId: user.id, currency: 'USD', accountType: 'SAVINGS' }, data: { balance: 15000 } });
    await prisma.account.updateMany({ where: { userId: user.id, currency: 'EUR', accountType: 'CHECKING' }, data: { balance: 5000 } });
    await prisma.account.updateMany({ where: { userId: user.id, currency: 'EUR', accountType: 'SAVINGS' }, data: { balance: 2000 } });
    await prisma.account.updateMany({ where: { userId: user.id, currency: 'GBP', accountType: 'CHECKING' }, data: { balance: 3000 } });
    console.log('Accounts funded!');
    const accounts = await prisma.account.findMany({ where: { userId: user.id } });
    accounts.forEach(a => console.log(' ', a.accountType, a.currency, Number(a.balance)));
  } else {
    console.log('User not found');
  }
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });