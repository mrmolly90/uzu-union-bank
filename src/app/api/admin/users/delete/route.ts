import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getPrisma, syncDbToBlob, resetPrisma, withUnsnapshotNull } from '@/lib/prisma';
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

export async function POST(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const prisma = await getPrisma();
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    // Use unsnapshot to handle cold-start DB restore races
    const user = await withUnsnapshotNull('Admin Delete User', async () => {
      const p = await getPrisma();
      return p.user.findUnique({ where: { id: userId } });
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Delete all user data (cryptoDeposits first to satisfy FK constraints)
    await prisma.cryptoDeposit.deleteMany({ where: { userId } });
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.transaction.deleteMany({ where: { initiatedById: userId } });
    await prisma.auditLog.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    await syncDbToBlob();
    await resetPrisma();

    return NextResponse.json({ success: true, deletedEmail: user.email, deletedName: user.fullName });
  } catch (err) {
    console.error('[Admin Delete User]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}