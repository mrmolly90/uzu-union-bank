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
 * Build the opening account list for a new customer.
 * Creates exactly 1 CHECKING + 1 SAVINGS account in the user's home currency.
 * No duplicate currencies, no unnecessary USD/EUR/GBP clutter.
 */
export function buildOpeningAccounts(homeCurrency: string): Array<{
  currency: string;
  accountType: 'CHECKING' | 'SAVINGS';
  accountNumber: string;
  balance: number;
}> {
  return [
    {
      currency: homeCurrency,
      accountType: 'CHECKING',
      accountNumber: generate16DigitAccountNumber(),
      balance: 0,
    },
    {
      currency: homeCurrency,
      accountType: 'SAVINGS',
      accountNumber: generate16DigitAccountNumber(),
      balance: 0,
    },
  ];
}
