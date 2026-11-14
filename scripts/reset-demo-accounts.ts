import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'demo@test.com' } });
  if (user) {
    // Reset all accounts to $0
    await prisma.account.updateMany({ where: { userId: user.id }, data: { balance: 0 } });
    console.log('All accounts reset to $0 for demo@test.com');
    
    const accounts = await prisma.account.findMany({ where: { userId: user.id } });
    accounts.forEach(a => console.log(' ', a.accountType, a.currency, Number(a.balance)));
  } else {
    console.log('User not found');
  }
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });