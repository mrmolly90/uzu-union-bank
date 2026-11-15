import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPrisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const prisma = getPrisma();
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required.' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const admin = await prisma.admin.findUnique({ where: { email: normalizedEmail } });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const token = jwt.sign(
      { sub: admin.id, email: admin.email, role: admin.role },
      getJwtSecret(),
      { expiresIn: '8h' }
    );

    return NextResponse.json({
      admin: { id: admin.id, email: admin.email, fullName: admin.fullName, role: admin.role },
      token,
    });
  } catch (err) {
    console.error('[Admin Login]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
