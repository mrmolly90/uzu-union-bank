import { NextRequest, NextResponse } from 'next/server';
import { getPrisma, syncDbToBlob, resetPrisma, forceDownloadFromBlob, unsnapshotBeforeWrite } from '@/lib/prisma';
import { hashPassword, createAuthTokens, sanitizeUser } from '@/lib/auth';
import { registerSchema } from '@/lib/validations';
import { buildOpeningAccounts } from '@/lib/accounts';

import { getCurrencyByCountryCode } from '@/lib/countries';

function getHomeCurrency(countryCode: string): string {
  return getCurrencyByCountryCode(countryCode);
}

/** Prisma unique-constraint violation (P2002). */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

export async function POST(req: NextRequest) {
  try {
    // ─── STEP 0: Download freshest Blob BEFORE reading/writing ───
    // This ensures the email uniqueness check and user creation happen
    // on the MERGED data from ALL instances. Without this, Instance A
    // could have 23 users and Instance B could have 22 — and a register
    // on Instance B would create user #23 on a stale DB, then syncDbToBlob()
    // would OVERWRITE Instance A's user #23 with Instance B's user #23.
    // One user would be permanently destroyed.
    await unsnapshotBeforeWrite();

    const prisma = await getPrisma();
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map((e) => e.message).join(' ') },
        { status: 400 }
      );
    }

    const { email, password, bankPin, fullName, countryCode } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const bankPinHash = await hashPassword(bankPin);

    // Retry only on account-number collisions; never on the email constraint.
    const MAX_ATTEMPTS = 5;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const openingAccounts = buildOpeningAccounts(getHomeCurrency(countryCode));

      try {
        const user = await prisma.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            bankPinHash,
            fullName,
            countryCode,
            phone: typeof body.phone === 'string' ? body.phone.trim() || null : null,
            dob: typeof body.dob === 'string' ? body.dob || null : null,
            address: typeof body.address === 'string' ? body.address.trim() || null : null,
            occupation: typeof body.occupation === 'string' ? body.occupation.trim() || null : null,
            idNumber: typeof body.idNumber === 'string' ? body.idNumber.trim() || null : null,
            accounts: { create: openingAccounts },
          },
          include: { accounts: true },
        });

        // Non-critical: welcome notification (failure doesn't block registration)
        try {
          await prisma.notification.create({
            data: {
              userId: user.id,
              title: 'Welcome to UZU UNION',
              message:
                'Your account is ready. Checking and Savings accounts have been opened successfully.',
              type: 'INFO',
            },
          });
        } catch (notificationError) {
          console.error('[Register] welcome notification creation failed', notificationError);
        }

        // Auto-approve KYC for new registrations
        await prisma.user.update({
          where: { id: user.id },
          data: { kycStatus: 'VERIFIED' },
        });

        const tokens = await createAuthTokens(user);

        // Try to persist DB to Blob (best-effort — user data exists in local DB)
        try {
          await syncDbToBlob();
          // Force-download from Blob so ALL instances see the new user immediately.
          // This ensures the admin panel and other instances pick up the new user
          // on their next request, even if they have a stale local DB.
          try {
            await forceDownloadFromBlob();
          } catch {}
          await resetPrisma();
        } catch (syncErr) {
          console.error('[Register] Blob sync failed (non-fatal):', syncErr);
        }

        return NextResponse.json({ user: sanitizeUser(user), tokens }, { status: 201 });
      } catch (err) {
        lastError = err;
        if (!isUniqueViolation(err)) throw err;

        // Distinguish an email race from an account-number collision.
        const raced = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (raced) {
          return NextResponse.json(
            { error: 'An account with this email already exists.' },
            { status: 409 }
          );
        }

        // Account-number collision: regenerate the whole set and retry.
        continue;
      }
    }

    console.error('[Register] account number collisions exhausted', lastError);
    return NextResponse.json(
      { error: 'Could not open your accounts right now. Please try again.' },
      { status: 503 }
    );
  } catch (err) {
    console.error('[Register]', err);
    const message =
      process.env.NODE_ENV === 'development' && err instanceof Error
        ? `Registration failed: ${err.message}`
        : 'Internal server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
