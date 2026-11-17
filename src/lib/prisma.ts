/* ==========================================================================
   UZU UNION BANK — Prisma Client
   Supports Turso (edge SQLite) on Vercel, with local SQLite fallback.
   On Vercel, persists the SQLite DB to Vercel Blob so data survives
   across deployments and cold starts.
   ========================================================================== */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@libsql/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { put, head } from '@vercel/blob';
import path from 'path';
import fs from 'fs';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const BLOB_DB_KEY = 'uzu_bank.db';
const TMP_DB_DIR = '/tmp/prisma';
const TMP_DB_PATH = path.join(TMP_DB_DIR, 'uzu_bank.db');

/** Ensure the /tmp/prisma directory exists. */
function ensureTmpDir(): void {
  if (!fs.existsSync(TMP_DB_DIR)) {
    fs.mkdirSync(TMP_DB_DIR, { recursive: true });
  }
}

/**
 * On Vercel, try to restore the DB from Blob storage first.
 * If Blob is empty or unavailable, fall back to the build-time seed DB.
 */
async function restoreFromBlob(): Promise<void> {
  ensureTmpDir();

  // If /tmp/ DB already has data, keep it — don't overwrite from Blob
  if (fs.existsSync(TMP_DB_PATH)) {
    const stats = fs.statSync(TMP_DB_PATH);
    if (stats.size > 4096) return;
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  if (!blobToken || !storeId) {
    console.error('[Prisma] Blob not configured (missing token or store ID)');
    copyBuildDbToTmp();
    return;
  }

  try {
    const blobHead = await head(BLOB_DB_KEY, {
      token: blobToken,
      storeId: storeId,
    });
    if (blobHead && blobHead.url) {
      const response = await fetch(blobHead.url);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > 4096) {
          console.log('[Prisma] Restored DB from Blob (' + buffer.length + ' bytes)');
          fs.writeFileSync(TMP_DB_PATH, buffer);
          return;
        }
      }
    }
    console.log('[Prisma] Blob empty or not found, using seed DB');
  } catch (err) {
    console.error('[Prisma] Blob restore failed:', err instanceof Error ? err.message : String(err));
  }

  copyBuildDbToTmp();
}

/** Copy the build-time seeded DB to /tmp/ as a fallback. */
function copyBuildDbToTmp(): void {
  ensureTmpDir();

  // If /tmp/ DB already exists AND has data (not empty), keep it — don't overwrite
  if (fs.existsSync(TMP_DB_PATH)) {
    const stats = fs.statSync(TMP_DB_PATH);
    if (stats.size > 4096) return; // non-empty DB, keep existing data
  }

  const possiblePaths = [
    path.join(process.cwd(), 'prisma', 'uzu_bank.db'),
    path.join(process.cwd(), 'uzu_bank.db'),
  ];

  for (const buildDb of possiblePaths) {
    if (fs.existsSync(buildDb)) {
      fs.copyFileSync(buildDb, TMP_DB_PATH);
      return;
    }
  }

  // No seed DB found — create empty
  if (!fs.existsSync(TMP_DB_PATH)) {
    fs.writeFileSync(TMP_DB_PATH, '');
  }
}

/**
 * Persist the current /tmp/ DB back to Vercel Blob.
 * Call this after every write operation (register, fund, transfer, etc.).
 */
export async function syncDbToBlob(): Promise<void> {
  if (!process.env.VERCEL) return;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) return;
  if (!fs.existsSync(TMP_DB_PATH)) return;

  try {
    const storeId = process.env.BLOB_STORE_ID;
    if (!storeId) {
      console.error('[Prisma] BLOB_STORE_ID not set, cannot sync');
      return;
    }
    const buffer = fs.readFileSync(TMP_DB_PATH);
    await put(BLOB_DB_KEY, buffer, {
      token: blobToken,
      storeId: storeId,
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    console.log('[Prisma] Synced DB to Blob (' + buffer.length + ' bytes)');
  } catch (err) {
    console.error('[Prisma] Failed to sync DB to Blob:', err instanceof Error ? err.message : String(err));
  }
}

function resolveDatabaseUrl(): string {
  ensureTmpDir();

  if (process.env.VERCEL) {
    return `file:${TMP_DB_PATH}`;
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

  // Fallback to local SQLite (handles Vercel build-time DB copy)
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: { db: { url: resolveDatabaseUrl() } },
  });
}

/**
 * Get the Prisma client singleton.
 * On Vercel, this also restores the DB from Blob on first call.
 */
export async function getPrisma(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  // On Vercel, restore persisted DB from Blob before creating client
  if (process.env.VERCEL) {
    await restoreFromBlob();
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}
