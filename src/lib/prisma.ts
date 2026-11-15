/* ==========================================================================
   UZU UNION BANK — Prisma Client with Vercel Blob Store persistence
   
   On Vercel serverless, the /tmp filesystem is ephemeral — every cold
   start gets a fresh environment. To persist user data across cold starts
   we store the SQLite database file in Vercel Blob Store.
   
   Flow:
   1. On cold start, download the latest DB from Blob Store to /tmp/
   2. If no DB exists in Blob Store (first deploy ever), use the build-time
      seeded database from ./prisma/uzu_bank.db
   3. After every Prisma write operation, upload the DB back to Blob Store
   4. The Prisma client is wrapped to auto-sync after mutations
   
   NOTE: Without BLOB_READ_WRITE_TOKEN env var, the database is ephemeral
   and resets on each cold start. Set this token in Vercel dashboard under
   Storage → Blob for persistent data across cold starts.
   ========================================================================== */

import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { Buffer } from 'buffer';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const TMP_DB_PATH = '/tmp/prisma/uzu_bank.db';
const BUILD_DB_PATH = 'prisma/uzu_bank.db';

let blobAvailable = false;
try {
  const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN;
  blobAvailable = !!BLOB_TOKEN;
} catch {}

// ─── Blob Store helpers (only used when token is available) ────────────────

async function downloadDbFromBlob(): Promise<boolean> {
  if (!blobAvailable) return false;
  try {
    const { get } = await import('@vercel/blob');
    const response = await get('uzu_bank.db', { access: 'private' });
    if (!response || !response.blob) return false;
    
    const tmpDir = '/tmp/prisma';
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    
    if (!response.stream) return false;
    
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
      return false;
    }
    console.error('[Blob] Download failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

async function uploadDbToBlob(): Promise<void> {
  if (!blobAvailable) return;
  try {
    if (!fs.existsSync(TMP_DB_PATH)) return;
    
    const data = fs.readFileSync(TMP_DB_PATH);
    const { put } = await import('@vercel/blob');
    
    await put('uzu_bank.db', data, {
      access: 'private',
      contentType: 'application/octet-stream',
      addRandomSuffix: false,
    });
    console.log('[Blob] Uploaded DB to Blob Store');
  } catch (err) {
    console.error('[Blob] Upload failed:', err instanceof Error ? err.message : err);
  }
}

function copyBuildDbToTemp(): boolean {
  const buildDb = path.join(process.cwd(), BUILD_DB_PATH);
  if (fs.existsSync(buildDb)) {
    const tmpDir = '/tmp/prisma';
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    fs.copyFileSync(buildDb, TMP_DB_PATH);
    console.log('[Prisma] Copied build DB to', TMP_DB_PATH);
    return true;
  }
  console.warn('[Prisma] Build DB not found at', buildDb);
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
    // No DB in Blob Store yet — use the build-time seeded database
    copyBuildDbToTemp();
    // Upload the seeded DB to Blob Store so future cold starts get it
    await uploadDbToBlob();
  }
  
  // Update DATABASE_URL to point to /tmp
  process.env.DATABASE_URL = `file:${TMP_DB_PATH}`;
  console.log('[Prisma] DATABASE_URL set to:', process.env.DATABASE_URL);
}

// ─── Create Prisma client ──────────────────────────────────────────────────

async function createPrismaClient() {
  const isVercel = process.env.VERCEL === '1';
  let url = process.env.DATABASE_URL || `file:./${BUILD_DB_PATH}`;

  // On Vercel, sync DB from Blob Store and update URL before creating client
  if (isVercel) {
    await ensureSchema();
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

// ─── WAL mode for better concurrent access ────────────────────────��────────

async function enableWalMode(client: PrismaClient): Promise<void> {
  try {
    await client.$queryRawUnsafe('PRAGMA journal_mode=WAL');
    await client.$queryRawUnsafe('PRAGMA busy_timeout=5000');
  } catch {}
}

// ─── Wrapped Prisma client that syncs to Blob after writes ─────────────────

export async function getPrisma(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  
  const client = await createPrismaClient();
  
  // Enable WAL mode for better concurrent access on Vercel
  await enableWalMode(client);
  
  // Wrap mutation methods to sync DB to Blob Store after writes
  const isVercel = process.env.VERCEL === '1';
  
  if (isVercel && blobAvailable) {
    const syncAfterWrite = async (original: Function, ...args: any[]) => {
      const result = await original.apply(client, args);
      await uploadDbToBlob();
      return result;
    };
    
    const models = ['user', 'account', 'transaction', 'notification', 'refreshToken', 'auditLog', 'admin', 'cryptoAddress', 'exchangeRate'];
    for (const modelName of models) {
      const model = (client as any)[modelName];
      if (!model) continue;
      
      const writeMethods = ['create', 'update', 'upsert', 'delete', 'createMany', 'updateMany', 'deleteMany'];
      for (const method of writeMethods) {
        const original = model[method];
        if (original) {
          model[method] = async (...args: any[]) => syncAfterWrite(original, ...args);
        }
      }
    }
    
    const originalTransaction = client.$transaction.bind(client);
    client.$transaction = ((arg: any, options?: any) => {
      return originalTransaction(arg, options).then(async (result: any) => {
        await uploadDbToBlob();
        return result;
      });
    }) as typeof client.$transaction;
  }
  
  globalForPrisma.prisma = client;
  return client;
}

// For backward compatibility — non-async access returns a client but
// on Vercel the Blob sync happens lazily. Prefer getPrisma() in API routes.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;