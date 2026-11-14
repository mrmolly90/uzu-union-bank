import { PrismaClient } from '@prisma/client';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
let schemaPushed = false;

function ensureSchema(client: PrismaClient) {
  if (schemaPushed) return;
  schemaPushed = true;
  
  try {
    // Test if tables exist
    client.$executeRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name='User'");
  } catch {
    // Tables don't exist, push schema using local Prisma CLI
    try {
      const prismaPath = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
      const schemaPath = path.join(process.cwd(), 'prisma', 'schema.vercel.prisma');
      const dbPath = path.join(process.cwd(), 'prisma', 'uzu_bank.db');
      
      execSync(`node "${prismaPath}" db push --schema="${schemaPath}" --accept-data-loss --skip-generate`, {
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
        timeout: 30000,
      });
      console.log('[Prisma] Schema pushed successfully');
    } catch (e: any) {
      console.error('[Prisma] Schema push failed:', e.message);
    }
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

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: isVercel ? { db: { url } } : undefined,
  });

 // Push schema on Vercel at runtime
  if (isVercel) {
    ensureSchema(client);
  }

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;