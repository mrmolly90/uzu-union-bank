import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
let schemaPushed = false;

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "bankPinHash" TEXT,
    "fullName" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "phone" TEXT,
    "dob" TEXT,
    "address" TEXT,
    "occupation" TEXT,
    "idNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "Admin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "Admin_email_key" ON "Admin"("email");

CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CryptoAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "minDeposit" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "CryptoAddress_symbol_key" ON "CryptoAddress"("symbol");

CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "balance" DECIMAL NOT NULL DEFAULT 0,
    "ledgerLockedBalance" DECIMAL NOT NULL DEFAULT 0,
    "accountNumber" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'CHECKING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Account_accountNumber_key" ON "Account"("accountNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Account_userId_currency_accountType_key" ON "Account"("userId", "currency", "accountType");

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
    CONSTRAINT "Transaction_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_token_key" ON "RefreshToken"("token");

CREATE TABLE IF NOT EXISTS "ExchangeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "rate" DECIMAL NOT NULL,
    "bid" DECIMAL NOT NULL,
    "ask" DECIMAL NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExchangeRate_base_quote_key" ON "ExchangeRate"("base", "quote");
`;

function ensureSchema() {
  if (schemaPushed) return;
  schemaPushed = true;
  
  const isVercel = process.env.VERCEL === '1';
  if (!isVercel) return;
  
  // On Vercel, the build creates the DB at /vercel/path0/prisma/uzu_bank.db
  // but runtime is at /var/task/ which is read-only.
  // We must copy the DB to /tmp/ which is writable.
  const sourceDb = path.resolve(process.cwd(), 'prisma', 'uzu_bank.db');
  const tmpDir = '/tmp/prisma';
  const tmpDb = path.join(tmpDir, 'uzu_bank.db');
  
  console.log('[Prisma] ensureSchema called');
  console.log('[Prisma] cwd:', process.cwd());
  console.log('[Prisma] source DB exists:', fs.existsSync(sourceDb));
  
  // Create tmp dir if needed
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  
  // Copy DB to /tmp if not already there
  if (fs.existsSync(sourceDb) && !fs.existsSync(tmpDb)) {
    fs.copyFileSync(sourceDb, tmpDb);
    console.log('[Prisma] Copied DB to /tmp');
  }
  
  // Update DATABASE_URL to point to /tmp
  process.env.DATABASE_URL = `file:${tmpDb}`;
  console.log('[Prisma] DATABASE_URL set to:', process.env.DATABASE_URL);
}

async function ensureTables(client: PrismaClient) {
  if (!process.env.VERCEL) return;
  
  try {
    // Check if tables exist
    await client.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name='User'");
    console.log('[Prisma] Tables already exist');
  } catch {
    // Tables don't exist, create them
    console.log('[Prisma] Creating tables...');
    const statements = CREATE_TABLES_SQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const stmt of statements) {
      try {
        await client.$executeRawUnsafe(stmt + ';');
      } catch (e: any) {
        console.error('[Prisma] Table creation error:', e.message);
      }
    }
    console.log('[Prisma] Tables created successfully');
  }
}

function createPrismaClient() {
  const isVercel = process.env.VERCEL === '1';
  let url = process.env.DATABASE_URL || 'file:./prisma/uzu_bank.db';

  // On Vercel, copy DB to /tmp and update URL before creating client
  if (isVercel) {
    ensureSchema();
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

const _prisma = globalForPrisma.prisma ?? createPrismaClient();

// On Vercel, ensure tables exist before first query using a proxy
export const prisma = new Proxy(_prisma, {
  get(target, prop, receiver) {
    // On first method call, ensure tables are created
    if (process.env.VERCEL === '1' && typeof prop === 'string' && prop.startsWith('$')) {
      const initPromise = (globalThis as any).__prismaInit;
      if (initPromise) {
        // Clear the promise so we only wait once
        delete (globalThis as any).__prismaInit;
        // Fire and forget - the table creation will complete before the query resolves
        // because Prisma queues queries internally
        initPromise.catch((e: any) => console.error('[Prisma] init error:', e));
      }
    }
    return Reflect.get(target, prop, receiver);
  }
});

// Start table initialization immediately
if (process.env.VERCEL === '1') {
  (globalThis as any).__prismaInit = ensureTables(_prisma);
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = _prisma;