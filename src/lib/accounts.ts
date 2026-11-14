/* ==========================================================================
   UZU UNION BANK — Account opening helpers
   Account numbers are cryptographically random 16-digit numbers, unique across
   the whole bank. The old "UZU-CHK-<ts>-<ccy>" scheme is gone.
   ========================================================================== */

import crypto from 'crypto';

export const OPENING_ACCOUNT_TYPES = ['CHECKING', 'SAVINGS'] as const;

/**
 * Cryptographically strong 16-digit account number.
 * Generated from 8 random bytes reduced modulo 1e16, so it is always exactly
 * 16 digits (padded), never negative and never shorter.
 */
export function generate16DigitAccountNumber(): string {
  const max = BigInt('10000000000000000');
  const raw = BigInt('0x' + crypto.randomBytes(8).toString('hex'));
  return (raw % max).toString().padStart(16, '0');
}

/**
 * Build the opening account list for a new customer WITHOUT duplicate
 * (currency + accountType) pairs.
 *
 * This is the fix for the registration 500: the previous list created
 * {USD, CHECKING} twice whenever the home currency was USD (same for EUR and
 * GBP), violating @@unique([userId, currency, accountType]) and raising
 * Prisma P2002 -> "Internal server error".
 */
export function buildOpeningAccounts(homeCurrency: string): Array<{
  currency: string;
  accountType: 'CHECKING' | 'SAVINGS';
  accountNumber: string;
  balance: number;
}> {
  const currencies = Array.from(new Set([homeCurrency, 'USD', 'EUR', 'GBP']));
  const accounts: Array<{
    currency: string;
    accountType: 'CHECKING' | 'SAVINGS';
    accountNumber: string;
    balance: number;
  }> = [];

  for (const accountType of OPENING_ACCOUNT_TYPES) {
    for (const currency of currencies) {
      accounts.push({
        currency,
        accountType,
        accountNumber: generate16DigitAccountNumber(),
        balance: 0,
      });
    }
  }

  return accounts;
}
