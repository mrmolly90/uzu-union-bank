/* ==========================================================================
   UZU UNION BANK — Prisma Client
   Supports Turso (edge SQLite) on Vercel, with local SQLite fallback.
   On Vercel without Turso, persists the SQLite DB via Vercel Blob Store.
   ========================================================================== */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@libsql/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import path from 'path';
import fs from 'fs';
import { put, head } from '@vercel/blob';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const BLOB_DB_KEY = 'uzu_bank.db';

async function downloadFromBlob(tmpDb: string): Promise<boolean> {
  try {
    const blobUrl = process.env.BLOB_READ_WRITE_TOKEN
      ? `https://${process.env.BLOB_READ_WRITE_TOKEN?.split(';')[0]}.public.blob.vercel-storage.com/${BLOB_DB_KEY}`
      : null;
    
    if (!blobUrl) return false;
    
    const response = await fetch(blobUrl, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return false;
    
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(tmpDb, buffer);
    console.log('[Prisma] Restored DB from Blob Store');
    return true;
  } catch {
    return false;
  }
}

async function uploadToBlob(tmpDb: string): Promise<void> {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return;
    const buffer = fs.readFileSync(tmpDb);
    await put(BLOB_DB_KEY, buffer, {
      access: 'public',
      addRandomSuffix: false,
    });
    console.log('[Prisma] Uploaded DB to Blob Store');
  } catch (err) {
    console.error('[Prisma] Blob upload failed:', err);
  }
}

function resolveDatabaseUrl(): string {
  // On Vercel, copy the build-time DB to /tmp/ for writable access
  if (process.env.VERCEL) {
    const tmpDir = '/tmp/prisma';
    const tmpDb = path.join(tmpDir, 'uzu_bank.db');
    
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    // Try to find the build-time database first (synchronous fallback)
    const possiblePaths = [
      path.join(process.cwd(), 'prisma', 'uzu_bank.db'),
      path.join(process.cwd(), 'uzu_bank.db'),
    ];
    
    let copied = false;
    for (const buildDb of possiblePaths) {
      if (fs.existsSync(buildDb)) {
        fs.copyFileSync(buildDb, tmpDb);
        console.log('[Prisma] Copied DB from', buildDb, 'to', tmpDb);
        copied = true;
        break;
      }
    }
    
    if (!copied) {
      if (!fs.existsSync(tmpDb)) {
        fs.writeFileSync(tmpDb, '');
        console.warn('[Prisma] No build DB found, created empty file at', tmpDb);
      }
    }
    
    return `file:${tmpDb}`;
  }

  // Local development
  const configuredUrl = process.env.DATABASE_URL?.trim();
  if (!configuredUrl) {
    throw new Error('DATABASE_URL must be configured for local SQLite development.');
  }
  if (!configuredUrl.startsWith('file:')) {
    throw new Error('Local DATABASE_URL must use a SQLite file: URL.');
  }
  return configuredUrl;
}

/**
 * Async initialization: tries to restore DB from Blob Store.
 * Call this once at startup before any Prisma queries.
 */
async function restoreFromBlob(): Promise<void> {
  if (!process.env.VERCEL || !process.env.BLOB_READ_WRITE_TOKEN) return;
  const tmpDb = '/tmp/prisma/uzu_bank.db';
  if (!fs.existsSync(tmpDb)) return;
  
  const restored = await downloadFromBlob(tmpDb);
  if (restored) {
    console.log('[Prisma] Successfully restored DB from Blob Store');
  }
}

// Track whether Blob restore has been attempted
let blobRestoreAttempted = false;

export async function ensureBlobRestore(): Promise<void> {
  if (blobRestoreAttempted) return;
  blobRestoreAttempted = true;
  await restoreFromBlob();
}

function createPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET?.trim()) {
    throw new Error('JWT_SECRET must be configured in production.');
  }

  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl) {
    const isLocalFile = tursoUrl.startsWith('file:');
    const isRemoteLibSQL = tursoUrl.startsWith('libsql://') || tursoUrl.startsWith('https://');
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

    if (!isLocalFile && !isRemoteLibSQL) {
      throw new Error('TURSO_DATABASE_URL must use file:, libsql:, or https:.');
    }

    if (isRemoteLibSQL && !authToken) {
      throw new Error('TURSO_AUTH_TOKEN must be configured for a remote Turso database.');
    }

    const client = createClient({
      url: tursoUrl,
      ...(authToken ? { authToken } : {}),
    });

    return new PrismaClient({
      adapter: new PrismaLibSQL(client),
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  // Fallback to local SQLite (handles Vercel build-time DB copy + Blob persistence)
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: { db: { url: resolveDatabaseUrl() } },
  });
}

export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

/**
 * Call this after any write operation to persist the DB to Blob Store.
 * Only works on Vercel with BLOB_READ_WRITE_TOKEN configured.
 */
export async function syncDbToBlob(): Promise<void> {
  if (!process.env.VERCEL || !process.env.BLOB_READ_WRITE_TOKEN) return;
  const tmpDb = '/tmp/prisma/uzu_bank.db';
  if (fs.existsSync(tmpDb)) {
    await uploadToBlob(tmpDb);
  }
}
