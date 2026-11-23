import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getPrisma, syncDbToBlob, resetPrisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/auth';

function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), getJwtSecret()) as any;
    // Customer access tokens are signed with the same secret but carry no role.
    if (!decoded || !decoded.role) return null;
    return decoded;
  } catch { return null; }
}

export async function PATCH(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const prisma = await getPrisma();
    const { accountId, isActive } = await req.json();

    if (!accountId || isActive === undefined) {
      return NextResponse.json({ error: 'accountId and isActive required' }, { status: 400 });
    }

    const account = await prisma.account.update({
      where: { id: accountId },
      data: { isActive },
    });

    // Notify the user
    await prisma.notification.create({
      data: {
        userId: account.userId,
        title: isActive ? 'Account Activated' : 'Account Deactivated',
        message: `Your ${account.accountType === 'CHECKING' ? 'Checking' : 'Savings'} account (${account.currency}) has been ${isActive ? 'activated' : 'deactivated'} by admin.`,
        type: 'INFO',
      },
    });

    // Persist DB to Blob so account status changes survive cold starts
    try {
      await syncDbToBlob();
      await resetPrisma();
    } catch (syncErr) {
      console.error('[Admin Account Status] Blob sync failed (non-fatal):', syncErr);
    }

    return NextResponse.json(account);
  } catch (err) {
    console.error('[Admin Account Status]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
