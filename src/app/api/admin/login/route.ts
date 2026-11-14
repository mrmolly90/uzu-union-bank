import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'uzu-production-secret-change-me';

export async function POST(req: NextRequest) {
  try {
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
      JWT_SECRET,
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