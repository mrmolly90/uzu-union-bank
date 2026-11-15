import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
let schemaPushed = false;

function ensureSchema() {
  if (schemaPushed) return;
  schemaPushed = true;
  
  const isVercel = process.env.VERCEL === '1';
  if (!isVercel) return;
  
  const tmpDir = '/tmp/prisma';
  const tmpDb = path.join(tmpDir, 'uzu_bank.db');
  
  console.log('[Prisma] ensureSchema called');
  console.log('[Prisma] cwd:', process.cwd());
  
  // Create tmp dir if needed
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  
  // The database was created during the build step at ./prisma/uzu_bank.db.
  // On Vercel serverless, the filesystem is read-only except /tmp, so we
  // copy the pre-built database to /tmp where it can be written to.
  const buildDb = path.join(process.cwd(), 'prisma', 'uzu_bank.db');
  if (fs.existsSync(buildDb)) {
    fs.copyFileSync(buildDb, tmpDb);
    console.log('[Prisma] Copied DB from', buildDb, 'to', tmpDb);
  } else {
    console.warn('[Prisma] Build DB not found at', buildDb, '- creating empty database');
    // Create an empty file so Prisma can open it (tables will be missing)
    fs.writeFileSync(tmpDb, '');
  }
  
  // Update DATABASE_URL to point to /tmp
  process.env.DATABASE_URL = `file:${tmpDb}`;
  console.log('[Prisma] DATABASE_URL set to:', process.env.DATABASE_URL);
}

function createPrismaClient() {
  const isVercel = process.env.VERCEL === '1';
  let url = process.env.DATABASE_URL || 'file:./prisma/uzu_bank.db';

  // On Vercel, copy DB to /tmp and update URL before creating client
  if (isVercel) {
    ensureSchema();
    url = process.env.DATABASE_URL || url;
  }

  // Resolve to absolute path
  if (url.startsWith('file:')) {
    const relativePath = url.replace('file:', '').trim();
    const absolutePath = path.resolve(relativePath);
    url = `file:${absolutePath}`;
    process.env.DATABASE_URL = url;
  }

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: isVercel ? { db: { url } } : undefined,
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;