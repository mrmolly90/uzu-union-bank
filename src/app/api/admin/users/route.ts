import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getPrisma } from '@/lib/prisma';
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

export async function GET(req: NextRequest) {
  const admin = verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prisma = await getPrisma();
  const users = await prisma.user.findMany({
    include: { accounts: true, notifications: { orderBy: { createdAt: 'desc' }, take: 5 } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(users);
}

// ❌ POST removed — admin funding is handled by /api/admin/transactions.
// The old handler duplicated logic and was never called by the frontend.
