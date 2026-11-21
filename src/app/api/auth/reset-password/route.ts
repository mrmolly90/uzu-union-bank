import { NextRequest, NextResponse } from 'next/server';
import { getPrisma, syncDbToBlob, resetPrisma } from '@/lib/prisma';
import { hashPassword, verifyAccessToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // Require authentication to reset password
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const decoded = verifyAccessToken(authHeader.slice(7));
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
    }

    const { password, bankPin } = await req.json();
    
    if (!password) {
      return NextResponse.json({ error: 'Password required.' }, { status: 400 });
    }

    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const passwordHash = await hashPassword(password);
    const bankPinHash = bankPin ? await hashPassword(bankPin) : user.bankPinHash;

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, bankPinHash },
    });

    // Persist password change to Blob
    try {
      await syncDbToBlob();
      await resetPrisma();
    } catch (syncErr) {
      console.error('[Reset Password] Blob sync failed (non-fatal):', syncErr);
    }

    return NextResponse.json({ success: true, message: 'Password updated.' });
  } catch (err) {
    console.error('[Reset Password]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}