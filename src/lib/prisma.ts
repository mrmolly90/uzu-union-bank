/* ==========================================================================
   UZU UNION BANK — Prisma Client
   
   Uses DATABASE_URL from environment. On Vercel, the build script creates
   the SQLite DB at prisma/uzu_bank.db. The global singleton ensures the
   same PrismaClient instance is reused within a serverless instance.
   ========================================================================== */

import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || 'file:./prisma/uzu_bank.db';
  
  if (!url.startsWith('file:')) return url;
  
  const filePath = url.replace('file:', '').trim();
  
  // If it's already an absolute path, use it directly
  if (path.isAbsolute(filePath)) {
    if (fs.existsSync(filePath)) {
      return `file:${filePath}`;
    }
    // File doesn't exist yet (first time), use the path anyway
    // Prisma will create it
    return `file:${filePath}`;
  }
  
  // Resolve relative path
  const absolutePath = path.resolve(filePath);
  return `file:${absolutePath}`;
}

// ─── Create Prisma client ──────────────────────────────────────────────────

function createPrismaClient() {
  const resolvedUrl = resolveDatabaseUrl();
  console.log('[Prisma] Using DATABASE_URL:', resolvedUrl);
  
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: { db: { url: resolvedUrl } },
  });
}

// ─── Get or create Prisma client ───────────────────────────────────────────

export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  
  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

// For backward compatibility
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;