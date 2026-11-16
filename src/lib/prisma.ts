/* ==========================================================================
   UZU UNION BANK — Prisma Client
   Supports Turso (edge SQLite) on Vercel, with local SQLite fallback.
   On Vercel, persists the SQLite DB via Vercel Blob Store so user data
   survives cold starts.
   ========================================================================== */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@libsql/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import path from 'path';
import fs from 'fs';
import { put, head } from '@vercel/blob';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const BLOB_DB_KEY = 'uzu_bank.db';

/**
 * Download the database from Vercel Blob Store to /tmp/.
 * Returns true if a blob was found and restored.
 */
async function downloadFromBlob(tmpDb: string): Promise<boolean> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  try {
    // Use the SDK's head() to get the blob URL, then fetch it
    const blob = await head(BLOB_DB_KEY, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (!blob?.url) return false;
    
    const res = await fetch(blob.url, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(tmpDb, buffer);
    console.log('[Prisma] Restored DB from Blob Store');
    return true;
  } catch (err) {
    console.error('[Prisma] Blob download failed:', err);
    return false;
  }
}

/**
 * Upload the database from /tmp/ to Vercel Blob Store.
 */
async function uploadToBlob(tmpDb: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const buffer = fs.readFileSync(tmpDb);
    await put(BLOB_DB_KEY, buffer, { access: 'private', addRandomSuffix: false, allowOverwrite: true });
    console.log('[Prisma] Uploaded DB to Blob Store');
  } catch (err) {
    console.error('[Prisma] Blob upload failed:', err);
  }
}

function resolveDatabaseUrl(): string {
  const tmpDir = '/tmp/prisma';
  const tmpDb = path.join(tmpDir, 'uzu_bank.db');

  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // On Vercel, try Blob Store first, then fall back to build-time DB copy
  if (process.env.VERCEL) {
    // Try to find the build-time database
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

    if (!copied && !fs.existsSync(tmpDb)) {
      fs.writeFileSync(tmpDb, '');
      console.warn('[Prisma] No build DB found, created empty file at', tmpDb);
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
 * Must be called AFTER resolveDatabaseUrl() has created the tmp file.
 */
let blobRestoreAttempted = false;

export async function ensureBlobRestore(): Promise<void> {
  if (blobRestoreAttempted) return;
  blobRestoreAttempted = true;
  if (!process.env.VERCEL || !process.env.BLOB_READ_WRITE_TOKEN) return;
  const tmpDb = '/tmp/prisma/uzu_bank.db';
  // File must exist (created by resolveDatabaseUrl) before we can overwrite it
  if (!fs.existsSync(tmpDb)) {
    console.warn('[Prisma] ensureBlobRestore: tmp DB not found, skipping');
    return;
  }
  const restored = await downloadFromBlob(tmpDb);
  if (restored) {
    console.log('[Prisma] Successfully restored DB from Blob Store');
  }
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
