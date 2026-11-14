/* ==========================================================================
   UZU UNION BANK — Display formatting helpers (client + server safe)
   Account numbers are presented as 16-digit numbers in both the Checking and
   Savings IBAN boxes, regardless of how the value was stored historically.
   ========================================================================== */

import { CURRENCY_SYMBOLS } from '@/lib/countries';

/**
 * Strip everything that is not a digit and return the LAST 16 digits.
 * Works for both the new plain format (e.g. 4821930756124830) and legacy
 * values that were stored with prefixes (e.g. UZU-CHK-1000000100001001).
 */
export function to16Digits(value?: string | null): string {
  if (!value) return '';
  return String(value).replace(/\D/g, '').slice(-16);
}

/** Full 16-digit account number for the IBAN box. */
export function formatIbanDisplay(value?: string | null): string {
  const digits = to16Digits(value);
  return digits || '****';
}

/** Masked account number, e.g. ****4830 */
export function formatIbanShort(value?: string | null): string {
  const digits = to16Digits(value);
  return digits ? `****${digits.slice(-4)}` : '****';
}

/**
 * Exact monetary amount, always with 2 decimals and the currency code, so a
 * notification reads e.g. "$1,250.75 USD" instead of "$1,251".
 */
export function formatExactAmount(
  amount: number | string | null | undefined,
  currency: string
): string {
  const numeric = Number(amount);
  const safe = Number.isFinite(numeric) ? numeric : 0;
  const formatted = safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbol = CURRENCY_SYMBOLS[currency];
  return symbol ? `${symbol}${formatted} ${currency}` : `${formatted} ${currency}`;
}

/**
 * FX rate lookup table for converting between any two currencies.
 * Used for display purposes (total balance in user's preferred currency).
 */
const FX_RATES: Record<string, number> = {
  'USD': 1, 'EUR': 0.9222, 'GBP': 0.7920, 'JPY': 149.94, 'CHF': 0.8806,
  'SGD': 1.3245, 'AED': 3.6730, 'AUD': 1.5420, 'CAD': 1.3740, 'CNY': 7.2450,
  'HKD': 7.8200, 'INR': 83.45, 'KRW': 1325.0, 'MXN': 17.25, 'NGN': 1550.0,
  'NOK': 10.85, 'NZD': 1.6650, 'SEK': 10.52, 'TRY': 30.25, 'ZAR': 18.75,
  'BRL': 5.12, 'PHP': 56.20, 'THB': 35.80, 'MYR': 4.72, 'IDR': 15750,
  'VND': 25450, 'SAR': 3.75, 'QAR': 3.64, 'KWD': 0.308, 'OMR': 0.385,
  'BHD': 0.376, 'PLN': 4.02, 'DKK': 6.88,
  'CZK': 23.15, 'HUF': 362.5, 'RON': 4.62, 'BGN': 1.80, 'HRK': 6.95,
  'ISK': 138.5, 'RUB': 92.5, 'EGP': 30.90, 'KES': 145.0,
  'GHS': 12.85, 'TZS': 2520, 'UGX': 3800, 'ETB': 56.50, 'MAD': 10.15,
  'DZD': 135.0, 'TND': 3.12, 'PKR': 278.5, 'BDT': 109.5, 'LKR': 310.0,
  'NPR': 133.5, 'AFN': 72.5, 'ALL': 95.0, 'AMD': 390.0, 'AOA': 825.0,
  'AZN': 1.70, 'BIF': 2850, 'BND': 1.35, 'BOB': 6.92,
  'BSD': 1.0, 'BTN': 83.45, 'BWP': 13.65, 'BYN': 3.25, 'BZD': 2.02,
  'CDF': 2750, 'CLP': 915, 'COP': 3925, 'CRC': 515, 'CUP': 24.0,
  'CVE': 102.5, 'DJF': 178, 'DOP': 58.5, 'ERN': 15.0, 'FJD': 2.25,
  'FKP': 0.792, 'GEL': 2.68, 'GIP': 0.792, 'GMD': 67.5, 'GNF': 8600,
  'GTQ': 7.78, 'GYD': 209, 'HNL': 24.7, 'HTG': 132, 'IQD': 1310,
  'IRR': 42000, 'JMD': 155, 'JOD': 0.709, 'KGS': 89.5, 'KHR': 4100,
  'KMF': 455, 'KPW': 900, 'KYD': 0.833, 'KZT': 450, 'LAK': 20750,
  'LBP': 15000, 'LRD': 192, 'LSL': 18.75, 'LYD': 4.82, 'MGA': 4520,
  'MKD': 57.0, 'MMK': 2100, 'MNT': 3450, 'MOP': 8.06, 'MRU': 39.5,
  'MUR': 46.2, 'MVR': 15.4, 'MWK': 1725, 'MZN': 63.8, 'NAD': 18.75,
  'NIO': 36.7, 'PAB': 1.0, 'PEN': 3.72, 'PGK': 3.82, 'PYG': 7450,
  'RSD': 108.5, 'RWF': 1300, 'SBD': 8.42, 'SCR': 13.8, 'SDG': 600,
  'SHP': 0.792, 'SLE': 22.5, 'SOS': 570, 'SRD': 36.2, 'SSP': 130,
  'STN': 24.5, 'SVC': 8.75, 'SYP': 13000, 'SZL': 18.75, 'TJS': 10.95,
  'TMT': 3.50, 'TOP': 2.35, 'TTD': 6.78, 'TWD': 32.15, 'UAH': 38.5,
  'UYU': 39.2, 'UZS': 12600, 'VES': 36.2, 'VUV': 120, 'WST': 2.72,
  'XAF': 605, 'XCD': 2.70, 'XOF': 605, 'XPF': 110, 'YER': 250,
  'ZMW': 25.5, 'ZWL': 322,
};

/**
 * Convert an amount from one currency to another using the internal rate table.
 * All rates are quoted as 1 USD = X local. Returns the converted amount.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  if (fromCurrency === toCurrency) return amount;
  const usdAmount = fromCurrency === 'USD' ? amount : amount / (FX_RATES[fromCurrency] || 1);
  const converted = toCurrency === 'USD' ? usdAmount : usdAmount * (FX_RATES[toCurrency] || 1);
  return converted;
}

/**
 * Format an amount in a user's preferred display currency, converting if needed.
 * Shows the original currency code as a subscript indicator.
 */
export function formatConvertedAmount(
  amount: number,
  originalCurrency: string,
  displayCurrency: string
): string {
  const converted = convertCurrency(amount, originalCurrency, displayCurrency);
  const symbol = CURRENCY_SYMBOLS[displayCurrency] || '$';
  const formatted = converted.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

