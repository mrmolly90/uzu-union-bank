import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { hashPassword, sanitizeUser } from '@/lib/auth';
import { registerSchema } from '@/lib/validations';
import { buildOpeningAccounts } from '@/lib/accounts';

const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD', GB: 'GBP', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR',
  JP: 'JPY', CH: 'CHF', SG: 'SGD', AE: 'AED', AU: 'AUD', CA: 'CAD', CN: 'CNY',
  HK: 'HKD', IN: 'INR', KR: 'KRW', MX: 'MXN', NG: 'NGN', ZA: 'ZAR', BR: 'BRL',
  SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', TR: 'TRY', RU: 'RUB',
  KE: 'KES', GH: 'GHS', EG: 'EGP', SA: 'SAR',
};

function getHomeCurrency(countryCode: string): string {
  return COUNTRY_CURRENCY[countryCode] || 'USD';
}

/** Prisma unique-constraint violation (P2002). */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

export async function POST(req: NextRequest) {
  try {
    const prisma = getPrisma();
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

        return NextResponse.json({ user: sanitizeUser(user) }, { status: 201 });
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
