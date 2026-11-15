import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: 'file:./prisma/uzu_bank.db' } },
});

async function main() {
  const email = process.argv[2] || 'willkev913@gmail.com';
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (user) {
    console.log('User found:', user.id, user.fullName, user.createdAt);
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.transaction.deleteMany({ where: { initiatedById: user.id } });
    await prisma.account.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log('User deleted successfully');
  } else {
    console.log('User not found:', email);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);