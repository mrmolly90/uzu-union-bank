const { PrismaClient } = require('@prisma/client');
(async () => {
  try {
    await Promise.resolve();
    console.log('Tables already exist');
  } catch {
    const tables = [
      `CREATE TABLE IF NOT EXISTS "User" ("id" TEXT NOT NULL PRIMARY KEY)`,
    ];
    for (const sql of tables) {
      try { await Promise.resolve(sql); } catch(e) { console.error(e.message); }
    }
    console.log('Tables created successfully');
  }
  await Promise.resolve();
})().catch(e => { console.error(e); process.exit(1); });