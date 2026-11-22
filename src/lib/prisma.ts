/* ==========================================================================
   UZU UNION BANK — Prisma Client
   Supports Turso (edge SQLite) on Vercel, with local SQLite fallback.
   On Vercel, persists the SQLite DB to Vercel Blob so data survives
   across deployments and cold starts.
   ========================================================================== */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@libsql/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { put, get, head } from '@vercel/blob';
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
 *
 * SKIPS the full download when the local /tmp/ DB is already at least as
 * large as the blob. This avoids unnecessary I/O after resetPrisma() is
 * called on the same instance that just performed a write (local DB is
 * already the freshest version).
 */
async function restoreFromBlob(): Promise<void> {
  ensureTmpDir();

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  if (!blobToken || !storeId) {
    console.error('[Prisma] Blob not configured (missing token or store ID)');
    copyBuildDbToTmp();
    return;
  }

  // Quick head() check: get blob metadata without downloading the full file
  let blobMeta: { downloadUrl?: string; size?: number } | null = null;
  try {
    const meta = await head(BLOB_DB_KEY, { token: blobToken, storeId });
    // @vercel/blob head() returns size at the top level
    blobMeta = meta as any;
  } catch {
    // Blob doesn't exist yet — fall through to seed DB
  }

  // If blob exists and we have a local DB, always download the blob version
  // because it's the source of truth across all serverless instances.
  // The only exception: skip if blob is empty/unavailable (first deploy).
  // This is critical for cross-instance consistency — without it, writes
  // made by one instance never appear on another instance's cold start.
  if (blobMeta?.size && blobMeta.size > 4096) {
    // Blob exists and is non-trivial — we'll download it regardless of local state.
    // This ensures every cold start gets the freshest cross-instance data.
  } else if (fs.existsSync(TMP_DB_PATH)) {
    // Blob is empty/missing but local DB exists — keep local (first deploy scenario)
    const localSize = fs.statSync(TMP_DB_PATH).size;
    if (localSize > 4096) return;
  }

  // Download from Blob: try head() + fetch first, then get() fallback.
  let blobBuffer: Buffer | null = null;

  if (blobMeta?.downloadUrl) {
    try {
      const response = await fetch(blobMeta.downloadUrl, {
        headers: { Authorization: `Bearer ${blobToken}` },
      });
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        blobBuffer = Buffer.from(arrayBuffer);
      }
    } catch {
      // Fall through to get() fallback
    }
  }

  // Fallback: try get() directly (works if store ID case matches)
  if (!blobBuffer || blobBuffer.length <= 4096) {
    try {
      const blobResult = await get(BLOB_DB_KEY, {
        access: 'private',
        token: blobToken,
        storeId,
      });
      if (blobResult?.stream) {
        const reader = blobResult.stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
        if (totalLength > 4096) {
          blobBuffer = Buffer.concat(chunks);
        }
      }
    } catch {
      // Both methods failed — fall through to seed DB
    }
  }

  if (blobBuffer && blobBuffer.length > 4096) {
    console.log('[Prisma] Restored DB from Blob (' + blobBuffer.length + ' bytes)');
    fs.writeFileSync(TMP_DB_PATH, blobBuffer);
    return;
  }

  console.log('[Prisma] Blob empty or not found, using seed DB');
  copyBuildDbToTmp();
}

/** Copy the build-time seeded DB to /tmp/ as a fallback. */
function copyBuildDbToTmp(): void {
  ensureTmpDir();

  const possiblePaths = [
    path.join(process.cwd(), 'prisma', 'uzu_bank.db'),
    path.join(process.cwd(), 'prisma', 'dev.db'),
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
 * THROWS on failure so callers can surface the error — silent failures
 * cause stale Blob overwrites on the next cold start (data loss).
 */
export async function syncDbToBlob(): Promise<void> {
  if (!process.env.VERCEL) return;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) return;
  if (!fs.existsSync(TMP_DB_PATH)) return;

  const storeId = process.env.BLOB_STORE_ID;
  if (!storeId) {
    throw new Error('BLOB_STORE_ID not set, cannot sync DB to Blob');
  }
  const buffer = fs.readFileSync(TMP_DB_PATH);

  await put(BLOB_DB_KEY, buffer, {
    access: 'private',
    token: blobToken,
    storeId,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/octet-stream',
  });

  console.log('[Prisma] Synced DB to Blob (' + buffer.length + ' bytes)');
}

/**
 * Force-sync the current DB to Blob immediately.
 * Used by the health-check endpoint to persist data on demand.
 */
export async function forceSyncDbToBlob(): Promise<{ ok: boolean; size: number; error?: string }> {
  try {
    if (!fs.existsSync(TMP_DB_PATH)) {
      return { ok: false, size: 0, error: 'DB file not found at ' + TMP_DB_PATH };
    }
    const stats = fs.statSync(TMP_DB_PATH);
    await syncDbToBlob();
    return { ok: true, size: stats.size };
  } catch (err) {
    return { ok: false, size: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Check the current state of the DB and Blob persistence.
 * Returns diagnostic info for debugging.
 */
export async function checkDbHealth(): Promise<{
  dbExists: boolean;
  dbSize: number;
  dbPath: string;
  isVercel: boolean;
  hasBlobToken: boolean;
  hasStoreId: boolean;
  blobFileExists: boolean;
  blobFileSize?: number;
  error?: string;
}> {
  const result: {
    dbExists: boolean;
    dbSize: number;
    dbPath: string;
    isVercel: boolean;
    hasBlobToken: boolean;
    hasStoreId: boolean;
    blobFileExists: boolean;
    blobFileSize?: number;
    error?: string;
  } = {
    dbExists: fs.existsSync(TMP_DB_PATH),
    dbSize: 0,
    dbPath: TMP_DB_PATH,
    isVercel: !!process.env.VERCEL,
    hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    hasStoreId: !!process.env.BLOB_STORE_ID,
    blobFileExists: false,
  };

  if (result.dbExists) {
    result.dbSize = fs.statSync(TMP_DB_PATH).size;
  }

  // Try to check if blob exists remotely
  if (result.isVercel && result.hasBlobToken && result.hasStoreId) {
    try {
      const blobResult = await get(BLOB_DB_KEY, {
        access: 'private',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        storeId: process.env.BLOB_STORE_ID,
      });
      result.blobFileExists = blobResult !== null;
      if (blobResult?.blob?.size) {
        result.blobFileSize = blobResult.blob.size;
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
    }
  }

  return result;
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
 * On warm instances, returns the cached client immediately — no I/O.
 * On cold start (no cached client), ALWAYS restores from Blob first.
 * This ensures every serverless instance gets the latest data.
 * The restore is skipped only if this exact instance just wrote the DB
 * (e.g. after resetPrisma was called with the local file already fresh).
 */
export async function getPrisma(): Promise<PrismaClient> {
  // Return cached client immediately on warm instances (no Blob I/O)
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  // No cached client = cold start. Always restore from Blob (if Vercel).
  if (process.env.VERCEL) {
    await restoreFromBlob();
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

/**
 * Disconnect and reset the Prisma client singleton.
 * Kept for backward compatibility but no longer called after every write.
 * On Vercel serverless, each cold start naturally restores from Blob,
 * so destroying the warm client only causes stale Blob overwrites.
 *
 * Only call this explicitly when you know the local DB file has changed
 * on disk and needs to be re-read (e.g. after a seed/restore operation).
 */
export async function resetPrisma(): Promise<void> {
  if (globalForPrisma.prisma) {
    try {
      await globalForPrisma.prisma.$disconnect();
    } catch {
      // Ignore disconnect errors
    }
    globalForPrisma.prisma = undefined as unknown as PrismaClient;
  }
}
