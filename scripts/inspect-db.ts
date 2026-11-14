/* Read-only inspection of the local SQLite database. */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, countryCode: true } });
  console.log('USERS:', JSON.stringify(users));

  const accounts = await prisma.account.findMany({
    select: { userId: true, accountNumber: true, accountType: true, currency: true, balance: true },
    orderBy: { accountNumber: 'asc' },
  });
  console.log('ACCOUNT COUNT:', accounts.length);
  for (const a of accounts) {
    console.log(`  ${a.accountType.padEnd(8)} ${a.currency} ${a.accountNumber} bal=${a.balance}`);
  }

  console.log('NOTIFICATIONS:', await prisma.notification.count());
  console.log('TRANSACTIONS:', await prisma.transaction.count());
  console.log('REFRESH TOKENS:', await prisma.refreshToken.count());

  const ddl = await prisma.$queryRaw<Array<{ name: string; sql: string }>>`
    SELECT name, sql FROM sqlite_master
    WHERE type = 'index' AND tbl_name = 'Account'
  `;
  console.log('ACCOUNT INDEXES:');
  for (const row of ddl) console.log(`  ${row.name}: ${row.sql}`);
}

main()
  .catch((e) => {
    console.error('INSPECT ERROR:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
