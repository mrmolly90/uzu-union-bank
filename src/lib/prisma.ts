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
  
  // On Vercel, the build creates the DB at /vercel/path0/prisma/uzu_bank.db
  // but runtime is at /var/task/ which is read-only.
  // We must copy the DB to /tmp/ which is writable.
  const sourceDb = path.resolve(process.cwd(), 'prisma', 'uzu_bank.db');
  const tmpDir = '/tmp/prisma';
  const tmpDb = path.join(tmpDir, 'uzu_bank.db');
  
  console.log('[Prisma] ensureSchema called');
  console.log('[Prisma] cwd:', process.cwd());
  console.log('[Prisma] source DB:', sourceDb);
  console.log('[Prisma] source DB exists:', fs.existsSync(sourceDb));
  console.log('[Prisma] tmp DB:', tmpDb);
  
  // Create tmp dir if needed
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  
  // Copy DB to /tmp if not already there
  if (fs.existsSync(sourceDb) && !fs.existsSync(tmpDb)) {
    fs.copyFileSync(sourceDb, tmpDb);
    console.log('[Prisma] Copied DB to /tmp');
  }
  
  // Push schema to /tmp DB
  try {
    const prismaPath = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.vercel.prisma');
    
    console.log('[Prisma] Pushing schema to /tmp DB...');
    
    const output = execSync(
      `node "${prismaPath}" db push --schema="${schemaPath}" --accept-data-loss --skip-generate`,
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: `file:${tmpDb}` },
        stdio: 'pipe',
        timeout: 60000,
      }
    );
    console.log('[Prisma] Schema push output:', output.toString());
  } catch (e: any) {
    console.error('[Prisma] Schema push failed:', e.message);
    if (e.stdout) console.error('[Prisma] stdout:', e.stdout.toString());
    if (e.stderr) console.error('[Prisma] stderr:', e.stderr.toString());
  }
  
  // Update DATABASE_URL to point to /tmp
  process.env.DATABASE_URL = `file:${tmpDb}`;
  console.log('[Prisma] DATABASE_URL set to:', process.env.DATABASE_URL);
}

function createPrismaClient() {
  const isVercel = process.env.VERCEL === '1';
  let url = process.env.DATABASE_URL || 'file:./prisma/uzu_bank.db';

  // Push schema on Vercel BEFORE creating client
  // This copies DB to /tmp and sets DATABASE_URL
  if (isVercel) {
    ensureSchema();
    url = process.env.DATABASE_URL || url;
  }

  // On Vercel, resolve to absolute path
  if (isVercel && url.startsWith('file:')) {
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