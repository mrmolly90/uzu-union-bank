import { PrismaClient } from '@prisma/client';
import path from 'path';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
let pushDone = false;

async function ensureSchema(client: PrismaClient) {
  if (pushDone) return;
  pushDone = true;
  try {
    // Push schema using Prisma's internal migrate engine
    await client.$executeRawUnsafe("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='User'");
  } catch {
    // Table doesn't exist, need to push
    const { execSync } = require('child_process');
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.vercel.prisma');
    const dbPath = path.join('/tmp', 'uzu_bank.db');
    try {
      execSync(`npx prisma db push --schema="${schemaPath}" --accept-data-loss --skip-generate`, {
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
        timeout: 30000,
      });
    } catch (e) {
      console.error('[Prisma] Schema push failed, trying inline...', e);
    }
  }
}

function createPrismaClient() {
  const isVercel = process.env.VERCEL === '1';
  
  let url = process.env.DATABASE_URL || 'file:./prisma/uzu_bank.db';
  
  if (isVercel && url.startsWith('file:')) {
    const dbPath = path.join('/tmp', 'uzu_bank.db');
    url = `file:${dbPath}`;
    process.env.DATABASE_URL = url;
  }

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: isVercel ? { db: { url } } : undefined,
  });

  // Auto-push schema on Vercel
  if (isVercel) {
    ensureSchema(client).catch(e => console.error('[Prisma] ensureSchema error:', e));
  }

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;