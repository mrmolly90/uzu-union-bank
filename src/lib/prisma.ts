import { PrismaClient } from '@prisma/client';
import path from 'path';
import { execSync } from 'child_process';
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
  
  // Update DATABASE_URL to point to /tmp
  process.env.DATABASE_URL = `file:${tmpDb}`;
  console.log('[Prisma] DATABASE_URL set to:', process.env.DATABASE_URL);
  
  // Run init-db script synchronously to create tables
  // This script uses @prisma/client (always available) to create the DB and tables
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'init-db.cjs');
  if (fs.existsSync(scriptPath)) {
    console.log('[Prisma] Running init-db script...');
    try {
      const output = execSync(`node "${scriptPath}"`, {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: `file:${tmpDb}` },
        stdio: 'pipe',
        timeout: 30000,
      });
      console.log('[Prisma] init-db output:', output.toString());
    } catch (e: any) {
      console.error('[Prisma] init-db failed:', e.message);
      if (e.stdout) console.error('[Prisma] stdout:', e.stdout.toString());
      if (e.stderr) console.error('[Prisma] stderr:', e.stderr.toString());
    }
  } else {
    console.log('[Prisma] init-db script not found at:', scriptPath);
  }
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