import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password, bankPin } = await req.json();
    
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const passwordHash = await hashPassword(password);
    const bankPinHash = bankPin ? await hashPassword(bankPin) : user.bankPinHash;

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, bankPinHash },
    });

    return NextResponse.json({ success: true, message: 'Password updated.' });
  } catch (err) {
    console.error('[Reset Password]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}