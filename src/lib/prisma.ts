import { PrismaClient } from '@prisma/client';
import path from 'path';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const isVercel = process.env.VERCEL === '1';
  
  // On Vercel, SQLite must use /tmp for writable storage
  let url = process.env.DATABASE_URL || 'file:./prisma/uzu_bank.db';
  
  if (isVercel && url.startsWith('file:')) {
    // Use /tmp for writable SQLite storage on Vercel
    const dbPath = path.join('/tmp', 'uzu_bank.db');
    url = `file:${dbPath}`;
    process.env.DATABASE_URL = url;
  }

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: isVercel ? { db: { url } } : undefined,
  });
  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;