/* ==========================================================================
   UZU UNION BANK — Prisma Client
   
   On Vercel serverless, the /tmp filesystem is ephemeral — every cold
   start gets a fresh environment. To persist user data across cold starts
   we use Vercel Blob Store (requires BLOB_READ_WRITE_TOKEN env var).
   Without it, data resets on each cold start.
   ========================================================================== */

import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const TMP_DB_PATH = '/tmp/prisma/uzu_bank.db';
const BUILD_DB_PATH = 'prisma/uzu_bank.db';

// ─── Blob Store helpers ────────────────────────────────────────────────────

async function downloadDbFromBlob(): Promise<boolean> {
  try {
    const { get } = await import('@vercel/blob');
    const response = await get('uzu_bank.db', { access: 'private' });
    if (!response || !response.blob || !response.stream) return false;
    
    const tmpDir = '/tmp/prisma';
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    
    const chunks: Buffer[] = [];
    const reader = response.stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    fs.writeFileSync(TMP_DB_PATH, Buffer.concat(chunks));
    console.log('[Blob] Downloaded DB from Blob Store');
    return true;
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('NOT_FOUND')) {
      console.log('[Blob] No DB in Blob Store yet');
    } else {
      console.error('[Blob] Download failed:', err instanceof Error ? err.message : err);
    }
    return false;
  }
}

async function uploadDbToBlob(): Promise<void> {
  try {
    if (!fs.existsSync(TMP_DB_PATH)) return;
    const { put } = await import('@vercel/blob');
    const data = fs.readFileSync(TMP_DB_PATH);
    await put('uzu_bank.db', data, {
      access: 'private',
      contentType: 'application/octet-stream',
      addRandomSuffix: false,
    });
    console.log('[Blob] Uploaded DB to Blob Store');
  } catch (err) {
    // Silently ignore Blob errors — DB still works in-memory for this session
  }
}

function copyBuildDbToTemp(): boolean {
  // Try multiple possible locations for the build DB
  const possiblePaths = [
    path.join(process.cwd(), BUILD_DB_PATH),
    path.join(process.cwd(), '..', BUILD_DB_PATH),
    path.resolve(BUILD_DB_PATH),
    BUILD_DB_PATH,
  ];
  
  // Also check if DATABASE_URL already points to a valid file
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('file:')) {
    const filePath = dbUrl.replace('file:', '').trim();
    if (fs.existsSync(filePath)) {
      const tmpDir = '/tmp/prisma';
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      fs.copyFileSync(filePath, TMP_DB_PATH);
      console.log('[Prisma] Copied DB from DATABASE_URL to', TMP_DB_PATH);
      return true;
    }
    possiblePaths.push(filePath);
  }
  
  for (const buildDb of possiblePaths) {
    if (fs.existsSync(buildDb)) {
      const tmpDir = '/tmp/prisma';
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      fs.copyFileSync(buildDb, TMP_DB_PATH);
      console.log('[Prisma] Copied build DB from', buildDb, 'to', TMP_DB_PATH);
      return true;
    }
  }
  
  console.warn('[Prisma] Build DB not found. Tried:', possiblePaths.join(', '));
  return false;
}

// ─── Ensure schema on Vercel ───────────────────────────────────────────────

let schemaInitialized = false;

async function ensureSchema(): Promise<void> {
  if (schemaInitialized) return;
  schemaInitialized = true;
  
  const isVercel = process.env.VERCEL === '1';
  if (!isVercel) return;
  
  console.log('[Prisma] ensureSchema called');
  
  // Try to download from Blob Store first
  const downloaded = await downloadDbFromBlob();
  
  if (!downloaded) {
    const copied = copyBuildDbToTemp();
    if (copied) {
      await uploadDbToBlob();
      process.env.DATABASE_URL = `file:${TMP_DB_PATH}`;
    } else {
      // Fall back to the build DB path directly
      const fallbackPath = path.resolve(BUILD_DB_PATH);
      if (fs.existsSync(fallbackPath)) {
        process.env.DATABASE_URL = `file:${fallbackPath}`;
        console.log('[Prisma] Using build DB directly at', fallbackPath);
      } else {
        // Last resort: use the DATABASE_URL from env
        console.warn('[Prisma] No database file found, using DATABASE_URL from env');
      }
    }
  } else {
    process.env.DATABASE_URL = `file:${TMP_DB_PATH}`;
  }
  
  console.log('[Prisma] DATABASE_URL set to:', process.env.DATABASE_URL);
}

// ─── Create Prisma client ──────────────────────────────────────────────────

async function createPrismaClient() {
  const isVercel = process.env.VERCEL === '1';
  let url = process.env.DATABASE_URL || `file:./${BUILD_DB_PATH}`;

  if (isVercel) {
    await ensureSchema();
    url = process.env.DATABASE_URL || url;
  }

  if (url.startsWith('file:')) {
    const relativePath = url.replace('file:', '').trim();
    const absolutePath = path.resolve(relativePath);
    url = `file:${absolutePath}`;
    process.env.DATABASE_URL = url;
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: isVercel ? { db: { url } } : undefined,
  });
}

// ─── Wrapped Prisma client that syncs to Blob after writes ─────────────────

export async function getPrisma(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  
  const client = await createPrismaClient();
  
  // Wrap mutation methods to sync DB to Blob Store after writes
  const isVercel = process.env.VERCEL === '1';
  
  if (isVercel) {
    const syncAfterWrite = async (original: Function, ...args: any[]) => {
      const result = await original.apply(client, args);
      await uploadDbToBlob().catch(() => {});
      return result;
    };
    
    const models = ['user', 'account', 'transaction', 'notification', 'refreshToken', 'auditLog', 'admin', 'cryptoAddress', 'exchangeRate'];
    for (const modelName of models) {
      const model = (client as any)[modelName];
      if (!model) continue;
      
      for (const method of ['create', 'update', 'upsert', 'delete', 'createMany', 'updateMany', 'deleteMany']) {
        const original = model[method];
        if (original) {
          model[method] = async (...args: any[]) => syncAfterWrite(original, ...args);
        }
      }
    }
    
    const originalTransaction = client.$transaction.bind(client);
    client.$transaction = ((arg: any, options?: any) => {
      return originalTransaction(arg, options).then(async (result: any) => {
        await uploadDbToBlob().catch(() => {});
        return result;
      });
    }) as typeof client.$transaction;
  }
  
  globalForPrisma.prisma = client;
  return client;
}

// For backward compatibility
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;