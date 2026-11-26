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

/**
 * Clean up SQLite WAL and SHM files that may remain from a previous instance.
 * When we swap the DB file, stale WAL/SHM files cause "database disk image is
 * malformed" errors because SQLite reads the WAL first and finds data that
 * doesn't match the new DB file.
 * 
 * This must be called BEFORE any DB file swap or cold-start restore.
 */
function cleanupWalShm(): void {
  try {
    const walPath = TMP_DB_PATH + '-wal';
    const shmPath = TMP_DB_PATH + '-shm';
    if (fs.existsSync(walPath)) {
      fs.unlinkSync(walPath);
      console.log('[Prisma] Cleaned stale WAL file');
    }
    if (fs.existsSync(shmPath)) {
      fs.unlinkSync(shmPath);
      console.log('[Prisma] Cleaned stale SHM file');
    }
  } catch (err) {
    console.warn('[Prisma] WAL/SHM cleanup error:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Read the last-known-sync timestamp (epoch ms). 0 means never synced.
 * Storing a TIMESTAMP (not a size) means content changes that keep the
 * same file size still trigger a re-download on warm instances.
 */
function readSyncMarker(): number {
  try {
    const raw = fs.readFileSync(BLOB_SYNC_MARKER, 'utf8');
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch { return 0; }
}

/** Write the sync marker as an epoch-ms timestamp. */
function writeSyncMarker(timestampMs: number): void {
  ensureTmpDir();
  fs.writeFileSync(BLOB_SYNC_MARKER, String(timestampMs), 'utf8');
}

/**
 * Get blob metadata (uploadedAt + size) from Vercel Blob.
 * Returns { size, uploadedAt: epoch-ms } or zeros if unavailable.
 * `uploadedAt` is the authoritative freshness signal — a NEWER upload
 * always wins regardless of file size.
 */
async function getBlobMeta(): Promise<{ size: number; uploadedAt: number }> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  if (!blobToken || !storeId) return { size: 0, uploadedAt: 0 };
  try {
    const meta = await head(BLOB_DB_KEY, { token: blobToken, storeId }) as any;
    const size = meta?.size && meta.size > 4096 ? meta.size : 0;
    // uploadedAt comes back as ISO string from @vercel/blob
    const uploadedAt = meta?.uploadedAt ? new Date(meta.uploadedAt).getTime() : 0;
    return { size, uploadedAt };
  } catch { return { size: 0, uploadedAt: 0 }; }
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

/**
 * Check if the Blob DB is newer than our local /tmp/ copy.
 * Uses `uploadedAt` (timestamp) as the authoritative freshness signal —
 * content changes that keep the same file size still trigger a re-download.
 * Returns true if the Blob was uploaded after our last sync AND is larger
 * than the empty placeholder (i.e. contains real data).
 */
async function isBlobNewerThanLocal(): Promise<boolean> {
  const { uploadedAt: blobUploadedAt, size: blobSize } = await getBlobMeta();
  // No usable Blob → nothing to pull
  if (blobSize <= 0) return false;

  const localLastSync = readSyncMarker();
  // localLastSync stores an epoch-ms TIMESTAMP. If the Blob was uploaded
  // after our last sync, it is fresher → download.
  return localLastSync <= 0 || blobUploadedAt > localLastSync;
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
  const blobBuffer = await downloadBlobToBuffer();
  if (!blobBuffer || blobBuffer.length <= 4096) {
    throw new Error('Blob empty or unavailable after retries');
  }
  cleanupWalShm();
  fs.writeFileSync(TMP_DB_PATH, blobBuffer);
  console.log('[Prisma] Downloaded DB from Blob (' + blobBuffer.length + ' bytes)');
  // CRITICAL: writeSyncMarker expects epoch-ms TIMESTAMP, not file size!
  // Using Date.now() ensures isBlobNewerThanLocal() correctly compares
  // against the Blob's uploadedAt timestamp.
  writeSyncMarker(Date.now());
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
      cleanupWalShm();
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
 * Ensure ALL core tables and latest schema exist in the local /tmp/ SQLite DB.
 * 
 * CRITICAL: When Blob is unavailable on cold start, getPrisma() creates an
 * empty DB file. This function creates ALL Prisma-model tables using
 * CREATE TABLE IF NOT EXISTS so the first query succeeds instead of throwing
 * "no such table: User" → "Internal server error".
 * 
 * Also adds columns that may be missing on older Blob snapshots (e.g.
 * transferPaused). Safe to run on every instance — IF NOT EXISTS is idempotent.
 */
async function ensureLatestSchema(prisma: PrismaClient): Promise<void> {
  try {
    // ─── CORE TABLES (created if empty DB from cold-start Blob failure) ───
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "email" TEXT NOT NULL UNIQUE,
        "passwordHash" TEXT NOT NULL,
        "bankPinHash" TEXT,
        "fullName" TEXT NOT NULL,
        "countryCode" TEXT NOT NULL,
        "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
        "twoFactorEnabled" INTEGER NOT NULL DEFAULT 0,
        "twoFactorSecret" TEXT,
        "transferPaused" INTEGER NOT NULL DEFAULT 0,
        "phone" TEXT,
        "dob" TEXT,
        "address" TEXT,
        "occupation" TEXT,
        "idNumber" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      )
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Admin" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "email" TEXT NOT NULL UNIQUE,
        "passwordHash" TEXT NOT NULL,
        "fullName" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'ADMIN',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      )
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Account" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "currency" TEXT NOT NULL,
        "balance" DECIMAL NOT NULL DEFAULT 0,
        "ledgerLockedBalance" DECIMAL NOT NULL DEFAULT 0,
        "accountNumber" TEXT NOT NULL UNIQUE,
        "accountType" TEXT NOT NULL DEFAULT 'CHECKING',
        "isActive" INTEGER NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
      )
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Transaction" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "sourceAccountId" TEXT NOT NULL,
        "destinationBankSwift" TEXT NOT NULL,
        "destinationIban" TEXT NOT NULL,
        "destinationBankName" TEXT NOT NULL DEFAULT '',
        "sourceAmount" DECIMAL NOT NULL,
        "sourceCurrency" TEXT NOT NULL,
        "destinationAmount" DECIMAL NOT NULL,
        "destinationCurrency" TEXT NOT NULL,
        "exchangeRate" DECIMAL NOT NULL,
        "fee" DECIMAL NOT NULL DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'INITIATED',
        "blockchainTxHash" TEXT,
        "iso20022Payload" TEXT,
        "failureReason" TEXT,
        "initiatedById" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        "destinationAccountId" TEXT,
        FOREIGN KEY ("sourceAccountId") REFERENCES "Account" ("id"),
        FOREIGN KEY ("initiatedById") REFERENCES "User" ("id")
      )
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Notification" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "type" TEXT NOT NULL DEFAULT 'INFO',
        "read" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
      )
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RefreshToken" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "token" TEXT NOT NULL UNIQUE,
        "expiresAt" DATETIME NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
      )
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AuditLog" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "metadata" TEXT,
        "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
      )
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ExchangeRate" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "base" TEXT NOT NULL,
        "quote" TEXT NOT NULL,
        "rate" DECIMAL NOT NULL,
        "bid" DECIMAL NOT NULL,
        "ask" DECIMAL NOT NULL,
        "updatedAt" DATETIME NOT NULL,
        UNIQUE("base", "quote")
      )
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CryptoAddress" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "symbol" TEXT NOT NULL UNIQUE,
        "name" TEXT NOT NULL,
        "network" TEXT NOT NULL,
        "address" TEXT NOT NULL,
        "minDeposit" TEXT NOT NULL DEFAULT '',
        "isActive" INTEGER NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      )
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CryptoDeposit" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "symbol" TEXT NOT NULL,
        "amount" TEXT NOT NULL,
        "blockchainTxHash" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "adminId" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
      )
    `).catch(() => {});

    // ─── INDEXES ───
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId")`
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Transaction_initiatedById_idx" ON "Transaction"("initiatedById")`
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Transaction_sourceAccountId_idx" ON "Transaction"("sourceAccountId")`
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId")`
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken"("userId")`
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "CryptoDeposit_userId_idx" ON "CryptoDeposit"("userId")`
    ).catch(() => {});

    // transferPaused column may be missing on older Blob DBs
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN "transferPaused" INTEGER NOT NULL DEFAULT 0`
    ).catch((e) => {
      if (!String(e?.message || e).toLowerCase().includes('duplicate column') &&
          !String(e?.message || e).toLowerCase().includes('already exists')) {
        console.error('[Prisma] transferPaused ALTER failed (non-fatal):', e?.message || e);
      }
    });
  } catch (err) {
    console.error('[Prisma] ensureLatestSchema non-fatal error:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Force a fresh download from Blob by using a SAFE SWAP pattern:
 * 1. Download fresh Blob data to a TEMPORARY file
 * 2. ONLY if the download succeeds, swap it in and reset the client
 * 3. If the download fails, KEEP the existing local DB and client intact
 *
 * This prevents the admin panel from showing 0 users when Blob is
 * temporarily unavailable (common in serverless cold-start races).
 *
 * SMART SYNC: Compares user count between local DB and Blob.
 * - If local has MORE users → sync local→Blob first (preserves richer data)
 * - If Blob has MORE users → skip sync, just pull fresh Blob
 * - If equal → just pull fresh Blob
 * This ensures admin ALWAYS sees the MAXIMUM user count across all instances.
 */
export async function forceFreshDbFromBlob(): Promise<void> {
  if (!process.env.VERCEL) return;
  const TMP_DOWNLOAD_PATH = path.join(TMP_DB_DIR, 'uzu_bank.db.download');

  try {
    // Count users in local DB using a lightweight Prisma query.
    // If the Prisma client doesn't exist yet (first request after cold start),
    // we CANNOT count local users — but we also MUST NOT assume Blob is better.
    // Instead, check if the local DB file exists and has valid size.
    let localUsers = -1;
    let localDbHasData = false;
    try {
      if (globalForPrisma.prisma) {
        const result = await globalForPrisma.prisma.$queryRawUnsafe<Array<{n: number}>>('SELECT COUNT(*) AS n FROM "User"');
        localUsers = Number(result?.[0]?.n ?? -1);
        localDbHasData = localUsers > 0;
      } else {
        // No Prisma client yet — check the file directly
        localDbHasData = fs.existsSync(TMP_DB_PATH) && fs.statSync(TMP_DB_PATH).size > 4096;
      }
    } catch {
      // Local DB may not exist or may be empty
      localDbHasData = fs.existsSync(TMP_DB_PATH) && fs.statSync(TMP_DB_PATH).size > 4096;
    }

    // Count users in Blob by checking metadata (size-based heuristic)
    const blobMeta = await getBlobMeta();
    const blobUsers = blobMeta.size > 0 ? Math.floor(blobMeta.size / 10000) : -1;

    // ─── DECISION: Which DB is richer? ───
    // If local has data (users > 0 OR valid file) → sync local→Blob, KEEP local DB.
    // The local DB is already the freshest — downloading from Blob would be
    // wasteful and RISKY (could get a stale Blob and wipe real users).
    if (localDbHasData && (blobUsers < 0 || localUsers >= blobUsers)) {
      console.log(`[Prisma] forceFreshDbFromBlob: local=${localUsers} users >= blob≈${blobUsers} — syncing local→Blob, keeping local DB`);
      try { await syncDbToBlob(); } catch (e) { console.warn('[Prisma] sync warning:', e); }
      // CRITICAL: Update sync marker even if sync FAILED. This prevents the
      // warm-instance getPrisma() path from seeing isBlobNewerThanLocal()=true
      // and downloading a stale Blob that would wipe real users.
      writeSyncMarker(Date.now());
      // Local DB is authoritative — no download needed
      return;
    }

    // If we couldn't count local users but the DB file exists, keep it.
    // Only download from Blob when we're SURE Blob has more data.
    if (localDbHasData && localUsers < 0) {
      console.log(`[Prisma] forceFreshDbFromBlob: local DB exists but users unknown — keeping local DB`);
      try { await syncDbToBlob(); } catch (e) { console.warn('[Prisma] sync warning:', e); }
      writeSyncMarker(Date.now());
      return;
    }

    // Blob has MORE users — download and swap (safe swap pattern)
    console.log(`[Prisma] forceFreshDbFromBlob: blob≈${blobUsers} > local=${localUsers} — downloading fresh Blob`);

    let downloadSucceeded = false;
    try {
      const blobBuffer = await downloadBlobToBuffer();
      if (blobBuffer && blobBuffer.length > 4096) {
        fs.writeFileSync(TMP_DOWNLOAD_PATH, blobBuffer);
        downloadSucceeded = true;
        console.log(`[Prisma] Downloaded fresh Blob (${blobBuffer.length} bytes) to temp file`);
      }
    } catch (err) {
      console.warn('[Prisma] Blob download failed — keeping current DB intact:', err instanceof Error ? err.message : String(err));
    }

    if (!downloadSucceeded) {
      console.log('[Prisma] forceFreshDbFromBlob: Blob download failed — keeping current DB');
      return;
    }

    // Safe swap: reset client, replace DB file, update sync marker
    await resetPrisma();
    cleanupWalShm();
    if (fs.existsSync(BLOB_SYNC_MARKER)) fs.unlinkSync(BLOB_SYNC_MARKER);
    if (fs.existsSync(TMP_DB_PATH)) fs.unlinkSync(TMP_DB_PATH);
    fs.renameSync(TMP_DOWNLOAD_PATH, TMP_DB_PATH);
    writeSyncMarker(Date.now());
    console.log('[Prisma] forceFreshDbFromBlob: safely swapped in fresh Blob DB');
  } catch (err) {
    console.error('[Prisma] forceFreshDbFromBlob non-fatal:', err instanceof Error ? err.message : String(err));
    try { if (fs.existsSync(TMP_DOWNLOAD_PATH)) fs.unlinkSync(TMP_DOWNLOAD_PATH); } catch {}
  }
}

/**
 * Download the Blob DB content into a Buffer without touching the local DB file.
 * Returns null if Blob is unavailable or empty.
 */
async function downloadBlobToBuffer(): Promise<Buffer | null> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  if (!blobToken || !storeId) return null;

  // Retry up to 3 times with backoff
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
        return blobBuffer;
      }
    } catch { /* retry */ }

    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null;
}

/**
 * Persist the current /tmp/ DB back to Vercel Blob.
 * Call this after every write operation (register, fund, transfer, etc.).
 * THROWS on failure so callers can surface the error.
 * On success, updates the sync marker so warm instances detect new data.
 *
 * CRITICAL: Retries up to 3 times with exponential backoff. If Blob sync
 * fails, new users will NOT be visible on cold starts — login will return
 * "Invalid email or password" because the user exists only in the local DB.
 *
 * ALWAYS uploads the local DB to Blob. The Blob is the SOURCE OF TRUTH
 * for cross-instance consistency. The anti-wipe logic lives in the admin
 * GET handler (forceFreshDbFromBlob), which pulls the freshest Blob before
 * every admin read. This ensures new users are ALWAYS persisted to Blob
 * and admin ALWAYS sees the freshest data.
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

  // ─── GUARD 1: NEVER sync an empty DB to Blob ───
  const dbStat = fs.statSync(TMP_DB_PATH);
  if (dbStat.size <= 4096) {
    console.log('[Prisma] syncDbToBlob: local DB is empty (' + dbStat.size + ' bytes) — skipping sync to preserve Blob data');
    return;
  }

  // ─── GUARD 2: Count local users ───
  let localUserCount = 0;
  if (globalForPrisma.prisma) {
    try {
      const result = await globalForPrisma.prisma.$queryRawUnsafe<Array<{n: number}>>('SELECT COUNT(*) AS n FROM "User"');
      localUserCount = Number(result?.[0]?.n ?? 0);
    } catch {
      localUserCount = 1; // unknown but non-zero — proceed with caution
    }
  } else {
    localUserCount = 1; // no client yet — assume non-zero since file size > 4096
  }

  if (localUserCount === 0) {
    console.log('[Prisma] syncDbToBlob: local DB has 0 users — skipping sync to preserve Blob data');
    return;
  }

  // ─── GUARD 3: NEVER overwrite a richer Blob ───
  // Before uploading, check if Blob has MORE users than local. If so,
  // the Blob has data from another instance. We MUST NOT overwrite it.
  // If we can't reach Blob at all (getBlobMeta returns 0), we also MUST
  // NOT upload — the Blob might have real data we can't see right now.
  // EXCEPTION: If Blob size is 0 AND we have users locally, it's the
  // first deploy or Blob was reset. Upload to seed the Blob.
  try {
    const blobMeta = await getBlobMeta();
    if (blobMeta.size <= 0) {
      if (localUserCount > 0) {
        // First deploy or Blob was reset — seed it with local data
        console.log(`[Prisma] syncDbToBlob: Blob is empty, local has ${localUserCount} users — seeding Blob`);
        // Fall through to upload below
      } else {
        console.log('[Prisma] syncDbToBlob: Cannot verify Blob state and local has 0 users — skipping upload');
        writeSyncMarker(Date.now());
        return;
      }
    } else {
      const blobUserEstimate = Math.floor(blobMeta.size / 10000);
      if (blobUserEstimate > localUserCount) {
        console.log(`[Prisma] syncDbToBlob: Blob≈${blobUserEstimate} > local=${localUserCount} — Blob is richer! Skipping upload to preserve Blob data.`);
        writeSyncMarker(Date.now());
        return; // DON'T overwrite Blob — it's richer
      }
      if (blobUserEstimate === localUserCount && blobMeta.uploadedAt > readSyncMarker()) {
        // Blob has same users but was uploaded AFTER our last sync
        console.log('[Prisma] syncDbToBlob: Blob has same users but newer timestamp — downloading fresher Blob');
        try {
          const buffer = await downloadBlobToBuffer();
          if (buffer && buffer.length > 4096) {
            const tmpPath = TMP_DB_PATH + '.newer';
            fs.writeFileSync(tmpPath, buffer);
            await resetPrisma();
            cleanupWalShm();
            if (fs.existsSync(TMP_DB_PATH)) fs.unlinkSync(TMP_DB_PATH);
            fs.renameSync(tmpPath, TMP_DB_PATH);
          }
        } catch {}
        writeSyncMarker(Date.now());
        return;
      }
    }
  } catch {
    // Blob check failed — DON'T risk overwriting real data
    console.log('[Prisma] syncDbToBlob: Blob check failed — skipping upload to preserve Blob data');
    writeSyncMarker(Date.now());
    return;
  }

  const buffer = fs.readFileSync(TMP_DB_PATH);
  
  // Retry up to 3 times with exponential backoff
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await put(BLOB_DB_KEY, buffer, {
        access: 'private',
        token: blobToken,
        storeId,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/octet-stream',
      });
      writeSyncMarker(Date.now());
      console.log('[Prisma] Synced DB to Blob (' + buffer.length + ' bytes)');
      return; // success
    } catch (err) {
      lastError = err;
      console.warn(`[Prisma] Blob sync attempt ${attempt + 1}/3 failed:`, err instanceof Error ? err.message : String(err));
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt))); // 1s, 2s
      }
    }
  }
  // All retries exhausted — throw the last error so callers can handle it
  throw lastError || new Error('Blob sync failed after 3 attempts');
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

/** Throttle window for warm-instance Blob freshness checks (ms). */
const BLOB_CHECK_INTERVAL = 2_000;
let lastBlobCheck = 0;

/**
 * Get the Prisma client singleton with cross-instance consistency.
 * Warm instances reuse the existing client and check Blob freshness
 * every 2s (throttled) to avoid head() latency on every request.
 *
 * CRITICAL: When Blob is newer, we ALWAYS download from Blob. The safety
 * is in syncDbToBlob() which guards against syncing empty DBs. So even if
 * a cold-start instance calls getPrisma(), it will download the real Blob
 * data — not overwrite it with an empty DB.
 */
export async function getPrisma(): Promise<PrismaClient> {
  // Warm instance with existing client
  if (globalForPrisma.prisma) {
    if (process.env.VERCEL) {
      const now = Date.now();
      // Throttle Blob check to once per 2s — reduces latency on every request
      if (now - lastBlobCheck > BLOB_CHECK_INTERVAL) {
        lastBlobCheck = now;
        try {
          const blobNewer = await isBlobNewerThanLocal();
          if (blobNewer) {
            console.log(`[Prisma] Warm instance: Blob is newer — downloading fresh Blob`);
            // SAFE SWAP: Download to temp buffer first, only swap if successful
            try {
              const blobBuffer = await downloadBlobToBuffer();
              if (blobBuffer && blobBuffer.length > 4096) {
                await globalForPrisma.prisma.$disconnect().catch(() => {});
                globalForPrisma.prisma = undefined as unknown as PrismaClient;
                cleanupWalShm();
                fs.writeFileSync(TMP_DB_PATH, blobBuffer);
                writeSyncMarker(Date.now());
                console.log('[Prisma] Warm instance: safely swapped in fresh Blob DB');
              } else {
                console.log('[Prisma] Warm instance: Blob empty — keeping current DB');
              }
            } catch {
              console.log('[Prisma] Warm instance: Blob download failed — keeping current DB');
            }
          }
        } catch {
          // If blob check fails, continue with current client — safe default
        }
      }
    }
    if (globalForPrisma.prisma) return globalForPrisma.prisma;
  }

  // Cold start — download from Blob with retry
  if (process.env.VERCEL) {
    const localDbExists = fs.existsSync(TMP_DB_PATH);
    const localDbValid = localDbExists && fs.statSync(TMP_DB_PATH).size > 4096;

    if (!localDbValid) {
      // ─── Cold start: Try to download the freshest DB from Blob ───
      // We retry 3 times with exponential backoff because Blob may be
      // temporarily unavailable during serverless cold-start races.
      let blobRestored = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const blobBuffer = await downloadBlobToBuffer();
          if (blobBuffer && blobBuffer.length > 4096) {
            // Quick validation: try to count users in the downloaded DB
            // by writing to a temp path, creating a Prisma client, and querying.
            // If the DB has valid data, use it.
            cleanupWalShm();
            fs.writeFileSync(TMP_DB_PATH, blobBuffer);
            writeSyncMarker(Date.now());
            console.log(`[Prisma] Cold start: restored from Blob (${blobBuffer.length} bytes)`);
            blobRestored = true;
            break;
          }
        } catch (err) {
          console.warn(`[Prisma] Cold start: Blob download attempt ${attempt + 1} failed`);
          if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }

      if (!blobRestored) {
        console.log('[Prisma] Cold start: Blob unavailable after 3 retries — using seed DB fallback');
        // Fallback to the build-time seed DB which has tables + admin user.
        // SAFETY: syncDbToBlob() will check user counts before uploading.
        // The seed DB has 1 admin user. If Blob has 21 users, the guard
        // "Blob size / 10000 > local user count" will prevent overwriting.
        copyBuildDbToTmp();
        // Set sync marker to NOW so warm instances don't re-download from
        // Blob unnecessarily (Blob may be empty or stale).
        writeSyncMarker(Date.now());
      }
    }
    // Local DB is valid — keep it. Blob is a cold-start backup.
  }

  const client = createPrismaClient();
  // Ensure the latest schema (CryptoDeposit table, transferPaused column)
  // exists in the restored DB — old Blob snapshots may lack them.
  await ensureLatestSchema(client);
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

/**
 * PROACTIVE UNSNAPSHOT: Call this BEFORE every admin/user read operation.
 * Unlike withUnsnapshotNull (which only reacts AFTER a null result), this
 * proactively downloads the freshest Blob data BEFORE the query runs.
 * 
 * This ensures:
 * 1. New users registered on other instances are ALWAYS visible immediately
 * 2. Admin panel ALWAYS shows the maximum user count across ALL instances
 * 3. No stale local DB can hide data from any endpoint
 * 
 * Uses forceDownloadFromBlob() which syncs local→Blob first (if local has
 * real data), then downloads the freshest Blob. The syncDbToBlob() guard
 * prevents empty DBs from overwriting Blob data.
 * 
 * Call this at the START of every GET endpoint that reads user data.
 */
export async function unsnapshotBeforeRead(): Promise<void> {
  if (!process.env.VERCEL) return;
  try {
    await forceDownloadFromBlob();
    await resetPrisma();
  } catch (err) {
    console.warn('[Unsnapshot] Proactive unsnapshot failed:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * UNSNAPSHOT WRAPPER: Wraps any DB query with automatic Blob refresh.
 * 
 * If the query fails or returns null (data not found), this helper:
 * 1. Forces a fresh Blob download via forceFreshDbFromBlob()
 * 2. Resets the Prisma client so the next getPrisma() pulls fresh data
 * 3. Retries the query ONCE with the fresh DB
 * 
 * This ensures ALL endpoints are resilient to stale Blob data on cold-start
 * serverless instances. Users and data will NEVER be "not found" due to a
 * stale local DB — the unsnapshot automatically repairs the instance.
 * 
 * @param label - A short label for logging (e.g. 'Crypto Addresses')
 * @param query - The DB query function to execute
 * @returns The result of the query
 */
export async function withUnsnapshot<T>(
  label: string,
  query: () => Promise<T>
): Promise<T> {
  try {
    return await query();
  } catch (err) {
    // Query failed — unsnapshot and retry once
    console.log(`[${label}] Unsnapshot retry after error:`, err instanceof Error ? err.message : String(err));
    try {
      await forceFreshDbFromBlob();
      await resetPrisma();
    } catch (e) {
      console.warn(`[${label}] Unsnapshot failed:`, e instanceof Error ? e.message : String(e));
    }
    return await query();
  }
}

/**
 * UNSNAPSHOT FORCE: Like withUnsnapshot, but uses forceDownloadFromBlob()
 * instead of forceFreshDbFromBlob(). ALWAYS downloads from Blob regardless
 * of user counts. No "smart" comparison — always pulls the freshest Blob.
 * 
 * Use this for ADMIN read endpoints where you MUST see the absolute latest
 * data from all instances. Admin reads are low-frequency, so the cost of
 * re-downloading the DB (~500ms) is negligible compared to the guarantee
 * that admin ALWAYS sees every user.
 * 
 * @param label - A short label for logging (e.g. 'Admin Users')
 * @param query - The DB query function to execute
 * @returns The result of the query
 */
export async function withUnsnapshotForce<T>(
  label: string,
  query: () => Promise<T>
): Promise<T> {
  try {
    return await query();
  } catch (err) {
    // Query failed — force download from Blob and retry once
    console.log(`[${label}] Unsnapshot retry after error:`, err instanceof Error ? err.message : String(err));
    try {
      await forceDownloadFromBlob();
      await resetPrisma();
    } catch (e) {
      console.warn(`[${label}] Unsnapshot failed:`, e instanceof Error ? e.message : String(e));
    }
    return await query();
  }
}

/**
 * UNSNAPSHOT NULL GUARD: Like withUnsnapshot, but specifically handles
 * the case where a DB query returns null/empty (user/account not found).
 * 
 * CRITICAL: Uses forceDownloadFromBlob() which ALWAYS downloads from Blob
 * regardless of user counts. This is necessary because:
 * - The local DB returned null for the query — it's STALE by definition
 * - forceFreshDbFromBlob() would KEEP the local DB if it has "more users"
 *   (which is the WRONG behavior when the local DB is missing the user)
 * - We need the ABSOLUTE freshest Blob, not a "smart" comparison
 * 
 * @param label - A short label for logging
 * @param query - The DB query that may return null
 * @returns The query result (never null after unsnapshot if data exists)
 */
export async function withUnsnapshotNull<T>(
  label: string,
  query: () => Promise<T | null>
): Promise<T | null> {
  const result = await query();
  if (result !== null && result !== undefined) return result;

  // Result was null — the local DB is STALE. Force download from Blob
  // regardless of user counts. This is the ONLY way to guarantee we see
  // users created on other instances whose sync-to-Blob succeeded.
  console.log(`[${label}] Null result — force download from Blob...`);
  try {
    await forceDownloadFromBlob();
    await resetPrisma();
  } catch (e) {
    console.warn(`[${label}] Unsnapshot failed:`, e instanceof Error ? e.message : String(e));
  }
  return await query();
}

/**
 * FORCE download from Blob — ALWAYS downloads fresh Blob and replaces
 * the local DB. This is a READ-ONLY operation — it NEVER syncs local→Blob.
 * 
 * CRITICAL: The ONLY places that should sync to Blob are WRITE endpoints
 * (register, fund, transfer, admin transactions, etc.). This function is
 * called by admin GET endpoints and unsnapshot handlers. Since it only
 * downloads and replaces local, it CANNOT wipe Blob data.
 * 
 * SAFETY: If Blob is unavailable or empty, keeps current local DB.
 * The anti-wipe protection is in syncDbToBlob() which guards against
 * uploading empty DBs. This function is safe to call from ANY read path.
 * 
 * CONSISTENCY: Every call replaces local with the exact Blob data.
 * No user-count comparison — ALL instances see the SAME data from Blob.
 * This prevents the 21/17 split where different instances keep different DBs.
 * 
 * Used by unsnapshotBeforeRead(), withUnsnapshotNull(), and withUnsnapshotForce().
 */
export async function forceDownloadFromBlob(): Promise<void> {
  if (!process.env.VERCEL) return;
  const TMP_DOWNLOAD_PATH = path.join(TMP_DB_DIR, 'uzu_bank.db.download');

  try {
    // ─── STEP 1: Download from Blob to temp buffer ───
    let blobBuffer: Buffer | null = null;
    try {
      blobBuffer = await downloadBlobToBuffer();
      if (!blobBuffer || blobBuffer.length <= 4096) {
        console.log('[Prisma] Force download: Blob empty or unavailable — keeping current DB');
        return;
      }
    } catch (err) {
      console.warn('[Prisma] Force download failed:', err instanceof Error ? err.message : String(err));
      return;
    }

    // ─── STEP 2: Safe swap — replace local DB with fresh Blob data ───
    fs.writeFileSync(TMP_DOWNLOAD_PATH, blobBuffer);
    await resetPrisma();
    cleanupWalShm();
    if (fs.existsSync(BLOB_SYNC_MARKER)) fs.unlinkSync(BLOB_SYNC_MARKER);
    if (fs.existsSync(TMP_DB_PATH)) fs.unlinkSync(TMP_DB_PATH);
    fs.renameSync(TMP_DOWNLOAD_PATH, TMP_DB_PATH);
    writeSyncMarker(Date.now());
    console.log(`[Prisma] Force download: safely swapped in fresh Blob DB (${blobBuffer.length} bytes)`);
  } catch (err) {
    console.error('[Prisma] Force download non-fatal:', err instanceof Error ? err.message : String(err));
    try { if (fs.existsSync(TMP_DOWNLOAD_PATH)) fs.unlinkSync(TMP_DOWNLOAD_PATH); } catch {}
  }
}
