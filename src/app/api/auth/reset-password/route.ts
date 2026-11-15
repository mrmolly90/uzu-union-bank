import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPrisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { email, newPassword } = await req.json();
    if (!email || !newPassword || newPassword.length < 5) {
      return NextResponse.json({ error: 'Email and password (min 5 chars) required.' }, { status: 400 });
    }

    const prisma = await getPrisma();
    const passwordHash = await bcrypt.hash(newPassword, 12);
    
    const user = await prisma.user.update({
      where: { email: email.trim().toLowerCase() },
      data: { passwordHash },
    });

    return NextResponse.json({ success: true, email: user.email });
  } catch (err) {
    console.error('[Reset Password]', err);
    return NextResponse.json({ error: 'User not found or internal error.' }, { status: 500 });
  }
}