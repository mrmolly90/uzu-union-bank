/* ==========================================================================
   UZU UNION BANK — Prisma Client
   Uses one lazy Prisma client and requires durable PostgreSQL in production.
   ========================================================================== */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function resolveDatabaseUrl(): string {
  const configuredUrl = process.env.DATABASE_URL?.trim();

  if (!configuredUrl) {
    throw new Error('DATABASE_URL must be configured before using the database.');
  }

  // In development, SQLite is used via prisma/schema.prisma
  // In production (Vercel), PostgreSQL is used via prisma/schema.vercel.prisma
  // The Prisma client is generated against the correct schema for each environment.
  return configuredUrl;
}

function createPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET?.trim()) {
    throw new Error('JWT_SECRET must be configured in production.');
  }

  const resolvedUrl = resolveDatabaseUrl();
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: { db: { url: resolvedUrl } },
  });
}

export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}
