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

export async function POST(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const prisma = await getPrisma();
    const { userId, kycStatus } = await req.json();

    if (!userId || !kycStatus) {
      return NextResponse.json({ error: 'userId and kycStatus are required.' }, { status: 400 });
    }

    if (!['VERIFIED', 'PENDING', 'REJECTED'].includes(kycStatus)) {
      return NextResponse.json({ error: 'kycStatus must be VERIFIED, PENDING, or REJECTED.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { kycStatus },
    });

    // Create notification for the user
    await prisma.notification.create({
      data: {
        userId,
        title: kycStatus === 'VERIFIED' ? 'KYC Approved' : kycStatus === 'REJECTED' ? 'KYC Rejected' : 'KYC Status Updated',
        message: kycStatus === 'VERIFIED'
          ? 'Your identity has been verified. You now have full access to all banking features.'
          : kycStatus === 'REJECTED'
            ? 'Your KYC verification was not approved. Please contact support for more information.'
            : 'Your KYC status has been updated.',
        type: kycStatus === 'VERIFIED' ? 'SUCCESS' : 'WARNING',
      },
    });

    // Persist DB to Blob
    try {
      await syncDbToBlob();
      await resetPrisma();
    } catch (syncErr) {
      console.error('[Admin KYC] Blob sync failed (non-fatal):', syncErr);
    }

    return NextResponse.json({ success: true, user: { id: updated.id, email: updated.email, fullName: updated.fullName, kycStatus: updated.kycStatus } });
  } catch (err) {
    console.error('[Admin KYC]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}