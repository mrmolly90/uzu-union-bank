import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getPrisma, syncDbToBlob, resetPrisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/auth';

function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), getJwtSecret()) as any;
    if (!decoded || !decoded.role) return null;
    return decoded;
  } catch { return null; }
}

/** Emails that are real users — everything else is test/demo and gets removed. */
const REAL_USER_EMAILS = [
  'admin@uzudigitalunion.com',
  'tom.charania@gmail.com',
  'tomcharania@gmail.com',
  'entertainment@gmail.com',
  'willkev913@gmail.com',
  'willingkevin9@gmail.com',
  'bwallet828@gmail.com',
  'alice@example.com',
  'bob@example.com',
  'carol@example.com',
  'david@example.com',
  'emma@example.com',
  'frank@example.com',
  'grace@example.com',
  'henry@example.com',
  'isabella@example.com',
  'james@example.com',
  'sophia@example.com',
  'liam@example.com',
  'olivia@example.com',
  'noah@example.com',
  'amelia@example.com',
  'ethan@example.com',
];

export async function POST(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const prisma = await getPrisma();
    const allUsers = await prisma.user.findMany({ select: { id: true, email: true, fullName: true } });
    let deleted = 0;

    for (const user of allUsers) {
      if (REAL_USER_EMAILS.includes(user.email)) continue;

      // Delete test user's data
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      await prisma.notification.deleteMany({ where: { userId: user.id } });
      await prisma.transaction.deleteMany({ where: { initiatedById: user.id } });
      await prisma.auditLog.deleteMany({ where: { userId: user.id } });
      await prisma.account.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
      deleted++;
      console.log(`[Cleanup] Removed test user: ${user.email} (${user.fullName})`);
    }

    // Persist to Blob
    try {
      await syncDbToBlob();
      await resetPrisma();
    } catch (syncErr) {
      console.error('[Admin Cleanup] Blob sync failed:', syncErr);
    }

    return NextResponse.json({ success: true, deleted });
  } catch (err) {
    console.error('[Admin Cleanup]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}