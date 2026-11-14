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
  
  const dbPath = path.resolve(process.cwd(), 'prisma', 'uzu_bank.db');
  
  // Check if DB file exists and has tables
  if (fs.existsSync(dbPath)) {
    try {
      const result = execSync(
        `node -e "const d=require('child_process').execSync('node -e \\"process.exit(0)\\"');"`,
        { stdio: 'pipe', timeout: 5000 }
      );
    } catch {}
    
    // Quick check: try reading the DB file size
    const stat = fs.statSync(dbPath);
    if (stat.size > 4096) {
      console.log('[Prisma] Database exists, size:', stat.size);
      return; // DB likely has tables
    }
  }
  
  // Push schema
  try {
    const prismaPath = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.vercel.prisma');
    
    console.log('[Prisma] Pushing schema...');
    console.log('[Prisma] DB path:', dbPath);
    console.log('[Prisma] Schema path:', schemaPath);
    
    const output = execSync(
      `node "${prismaPath}" db push --schema="${schemaPath}" --accept-data-loss --skip-generate`,
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
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
}

function createPrismaClient() {
  const isVercel = process.env.VERCEL === '1';
  let url = process.env.DATABASE_URL || 'file:./prisma/uzu_bank.db';

  // On Vercel, resolve to absolute path
  if (isVercel && url.startsWith('file:')) {
    const relativePath = url.replace('file:', '').trim();
    const absolutePath = path.resolve(relativePath);
    url = `file:${absolutePath}`;
    process.env.DATABASE_URL = url;
  }

  // Push schema on Vercel BEFORE creating client
  if (isVercel) {
    ensureSchema();
  }

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: isVercel ? { db: { url } } : undefined,
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;