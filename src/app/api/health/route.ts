import { NextResponse } from 'next/server';
import { getPrisma, checkDbHealth, forceSyncDbToBlob, unsnapshotBeforeRead } from '@/lib/prisma';

export async function GET() {
  // First, download freshest Blob so health reflects ALL instances
  await unsnapshotBeforeRead();

  // Initialize Prisma and count records
  let userCount = 0;
  let accountCount = 0;
  let adminCount = 0;
  let dbError: string | undefined;

  try {
    const prisma = await getPrisma();
    userCount = await prisma.user.count();
    accountCount = await prisma.account.count();
    adminCount = await prisma.admin.count();
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  // Then check health (after Prisma has potentially restored the DB)
  const health = await checkDbHealth();

  return NextResponse.json({
    status: dbError ? 'error' : 'ok',
    database: {
      ...health,
      userCount,
      accountCount,
      adminCount,
      error: dbError,
    },
  });
}

export async function POST() {
  // Force sync DB to Blob
  const result = await forceSyncDbToBlob();
  return NextResponse.json(result);
}