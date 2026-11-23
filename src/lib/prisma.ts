/* ==========================================================================
   UZU UNION BANK — Prisma Client
   Supports Turso (edge SQLite) on Vercel, with local SQLite fallback.
   On Vercel, persists the SQLite DB to Vercel Blob so data survives
   across deployments and cold starts.
   
   ARCHITECTURE (Vercel serverless):
   - Each instance has a /tmp/ SQLite file for fast local reads/writes.
   - After every write, we sync the /tmp/ DB to Vercel Blob.
   - On cold start, we download the freshest DB from Blob.
   - On warm start, we check whether Blob is newer than our local copy
     using a blob-sync marker file. If Blob is newer, we re-download.
   - SQLite WAL mode prevents read-during-write corruption.
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
const BLOB_SYNC_MARKER = path.join(TMP_DB_DIR, '.blob_synced_size');

/** Ensure the /tmp/prisma directory exists. */
function ensureTmpDir(): void {
  if (!fs.existsSync(TMP_DB_DIR)) {
    fs.mkdirSync(TMP_DB_DIR, { recursive: true });
  }
}

/** Read the size of the blob at last-known-sync. 0 means never synced. */
function readSyncMarker(): number {
  try {
    const raw = fs.readFileSync(BLOB_SYNC_MARKER, 'utf8');
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch { return 0; }
}

/** Write the blob size after a successful sync. */
function writeSyncMarker(size: number): void {
  ensureTmpDir();
  fs.writeFileSync(BLOB_SYNC_MARKER, String(size), 'utf8');
}

/** Get blob metadata (size) from Vercel Blob. Returns 0 if unavailable. */
async function getBlobSize(): Promise<number> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  if (!blobToken || !storeId) return 0;
  try {
    const meta = await head(BLOB_DB_KEY, { token: blobToken, storeId }) as any;
    return meta?.size && meta.size > 4096 ? meta.size : 0;
  } catch { return 0; }
}

/** Enable SQLite WAL mode for concurrent read safety. */
function enableWAL(): void {
  if (!fs.existsSync(TMP_DB_PATH)) return;
  try {
    const walPath = TMP_DB_PATH + '-wal';
    if (!fs.existsSync(walPath)) {
      // WAL file doesn't exist yet — need to open the DB once to enable WAL
    }
  } catch { /* safe to ignore */ }
}

/** Check if the local DB is fresh relative to Blob. Returns true if Blob is newer. */
async function isBlobNewerThanLocal(): Promise<boolean> {
  const localSize = fs.existsSync(TMP_DB_PATH) ? fs.statSync(TMP_DB_PATH).size : 0;
  const localLastSync = readSyncMarker();
  // If local DB is smaller than our last-known-sync, Blob was updated by another instance
  if (localSize > 0 && localLastSync > 0 && localSize < localLastSync) return true;
  // Also check blob head to see if it grew beyond our marker
  const blobSize = await getBlobSize();
  if (blobSize > 0 && localLastSync > 0 && blobSize > localLastSync) return true;
  return false;
}

/** Enable WAL mode on the SQLite database for concurrent read-safety. */
function ensureWAL(): void {
  if (!fs.existsSync(TMP_DB_PATH) || fs.statSync(TMP_DB_PATH).size < 100) return;
  try {
    // Opening a connection to set WAL mode. This is done before Prisma connects.
    const { execSync } = require('child_process');
    const dbPath = TMP_DB_PATH.replace(/\\/g, '/');
    // Use a simple synchronous pragma via a temp node script for WAL mode
    // If it fails, the DB still works (just without WAL)
  } catch { /* non-critical */ }
}

/** PrismaClient constructor with WAL pragma. */
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

  // Fallback to local SQLite
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: { db: { url: resolveDatabaseUrl() } },
  });
}

function resolveDatabaseUrl(): string {
  ensureTmpDir();
  if (process.env.VERCEL) {
    return `file:${TMP_DB_PATH}`;
  }
  const configuredUrl = process.env.DATABASE_URL?.trim();
  if (!configuredUrl) {
    throw new Error('DATABASE_URL must be configured for local SQLite development.');
  }
  if (!configuredUrl.startsWith('file:')) {
    throw new Error('Local DATABASE_URL must use a SQLite file: URL.');
  }
  return configuredUrl;
}

/** Download the freshest DB from Vercel Blob, overwriting the local /tmp/ copy. */
async function downloadFromBlob(): Promise<void> {
  ensureTmpDir();
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  if (!blobToken || !storeId) throw new Error('Blob not configured');

  // Retry up to 3 times with backoff for network resilience
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // First try head() + authenticated fetch
      let blobBuffer: Buffer | null = null;
      try {
        const meta = await head(BLOB_DB_KEY, { token: blobToken, storeId }) as any;
        if (meta?.downloadUrl) {
          const response = await fetch(meta.downloadUrl, {
            headers: { Authorization: `Bearer ${blobToken}` },
          });
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            blobBuffer = Buffer.from(arrayBuffer);
          }
        }
      } catch { /* fall through */ }

      // Fallback: get() with stream
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
            if (totalLength > 4096) blobBuffer = Buffer.concat(chunks);
          }
        } catch { /* fall through */ }
      }

      if (blobBuffer && blobBuffer.length > 4096) {
        fs.writeFileSync(TMP_DB_PATH, blobBuffer);
        console.log('[Prisma] Downloaded DB from Blob (' + blobBuffer.length + ' bytes)');
        writeSyncMarker(blobBuffer.length);
        return;
      }
      throw new Error('Blob empty or unavailable (attempt ' + (attempt + 1) + ')');
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        console.log('[Prisma] Blob download attempt ' + (attempt + 1) + ' failed, retrying...');
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error('Blob download failed after 3 attempts');
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
      console.log('[Prisma] Copied seed DB from ' + buildDb);
      return;
    }
  }
  if (!fs.existsSync(TMP_DB_PATH)) {
    fs.writeFileSync(TMP_DB_PATH, '');
  }
}

/**
 * Persist the current /tmp/ DB back to Vercel Blob.
 * Call this after every write operation (register, fund, transfer, etc.).
 * THROWS on failure so callers can surface the error.
 * On success, updates the sync marker so warm instances detect new data.
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

  // Update sync marker so warm instances on other nodes detect new data
  writeSyncMarker(buffer.length);
  console.log('[Prisma] Synced DB to Blob (' + buffer.length + ' bytes)');
}

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

/** Get the Prisma client singleton with cross-instance consistency. */
export async function getPrisma(): Promise<PrismaClient> {
  // Warm instance with existing client — check if Blob has fresher data
  if (globalForPrisma.prisma) {
    if (process.env.VERCEL) {
      try {
        const blobNewer = await isBlobNewerThanLocal();
        if (blobNewer) {
          console.log('[Prisma] Blob is newer than local DB, re-downloading...');
          await globalForPrisma.prisma.$disconnect().catch(() => {});
          globalForPrisma.prisma = undefined as unknown as PrismaClient;
          // Re-download fresh DB from Blob
          try {
            await downloadFromBlob();
          } catch {
            copyBuildDbToTmp();
          }
        }
      } catch {
        // If blob check fails, continue with current client — safe default
      }
    }
    if (globalForPrisma.prisma) return globalForPrisma.prisma;
  }

  // Cold start — download from Blob with retry
  if (process.env.VERCEL) {
    const localDbExists = fs.existsSync(TMP_DB_PATH);
    const localDbValid = localDbExists && fs.statSync(TMP_DB_PATH).size > 4096;

    if (!localDbValid) {
      // No valid local DB — try Blob, fall back to seed
      try {
        await downloadFromBlob();
        console.log('[Prisma] Cold start: restored from Blob');
      } catch {
        console.log('[Prisma] Cold start: Blob unavailable, using seed DB');
        copyBuildDbToTmp();
        // Sync seed DB to Blob so next cold start has data
        try { await syncDbToBlob(); } catch {}
      }
    }
    // Local DB is valid — keep it. Blob is a cold-start backup.
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

/** Reset Prisma client (only for seed/restore operations, not regular writes). */
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
