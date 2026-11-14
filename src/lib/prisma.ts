import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // On Vercel serverless, SQLite must use /tmp directory
  const url = process.env.DATABASE_URL || 'file:./prisma/uzu_bank.db';
  const isVercel = process.env.VERCEL === '1';
  
  // For Vercel, use /tmp for writable SQLite storage
  const finalUrl = isVercel && url.startsWith('file:') 
    ? url.replace('file:', 'file:/tmp/')
    : url;

  // Override DATABASE_URL for this process
  if (isVercel) {
    process.env.DATABASE_URL = finalUrl;
  }

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: isVercel ? { db: { url: finalUrl } } : undefined,
  });
  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;