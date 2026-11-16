/* ==========================================================================
   UZU UNION BANK — Prisma Client
   Supports Turso (edge SQLite) on Vercel, with local SQLite fallback.
   On Vercel, copies the build-time seeded DB to /tmp/ for writable access.
   ========================================================================== */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@libsql/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import path from 'path';
import fs from 'fs';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

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

export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}
