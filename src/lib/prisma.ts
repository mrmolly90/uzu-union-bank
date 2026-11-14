import { PrismaClient } from '@prisma/client';
import path from 'path';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const isVercel = process.env.VERCEL === '1';
  
  // On Vercel, SQLite must use a path relative to the project root
  // The database is created during build via prisma db push
  let url = process.env.DATABASE_URL || 'file:./prisma/uzu_bank.db';
  
  // For Vercel, ensure the path resolves correctly
  if (isVercel && url.startsWith('file:')) {
    // Use the project root for the database file
    const dbPath = path.join(process.cwd(), 'prisma', 'uzu_bank.db');
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