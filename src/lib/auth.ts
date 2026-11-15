import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getPrisma } from '@/lib/prisma';
import type { AuthTokens, UserProfile } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'uzu-production-secret-change-me';
const JWT_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7d';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(user: {
  id: string;
  email: string;
}): string {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function verifyAccessToken(
  token: string
): { sub: string; email: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
  } catch {
    return null;
  }
}

export async function createAuthTokens(
  user: { id: string; email: string }
): Promise<AuthTokens> {
  const prisma = await getPrisma();
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 minutes in seconds
  };
}

export async function refreshAccessToken(
  refreshTokenStr: string
): Promise<AuthTokens | null> {
  const prisma = await getPrisma();
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshTokenStr },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date()) {
    if (stored) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
    }
    return null;
  }

  // Rotate refresh token
  await prisma.refreshToken.delete({ where: { id: stored.id } });
  return createAuthTokens(stored.user);
}

export function sanitizeUser(user: {
  id: string;
  email: string;
  fullName: string;
  countryCode: string;
  kycStatus: string;
  twoFactorEnabled: boolean;
  createdAt: Date;
}): UserProfile {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    countryCode: user.countryCode,
    kycStatus: user.kycStatus as UserProfile['kycStatus'],
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt.toISOString(),
  };
}