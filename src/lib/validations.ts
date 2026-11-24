import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(5, 'Password must be at least 5 characters'),
  bankPin: z
    .string()
    .regex(/^\d{4}$/, 'Bank PIN must be exactly 4 digits'),
  fullName: z.string().min(1, 'Full name is required'),
  countryCode: z.string().length(2, 'Country code must be 2 characters'),
});

export const transferSchema = z.object({
  sourceAccountId: z.string().cuid(),
  destinationBankSwift: z
    .string()
    // Accept ANY SWIFT/BIC-style input the user provides — no strict regex.
    // Normalize by trimming and uppercasing, but allow letters, digits,
    // spaces, dashes and dots so users can wire with any details they choose.
    .transform(v => v.trim().toUpperCase().replace(/\s+/g, ' '))
    .refine(v => v.length > 0, 'SWIFT/BIC code is required')
    .refine(v => /^[A-Z0-9 .-]+$/.test(v), 'SWIFT/BIC can only contain letters, numbers, spaces, dashes or dots')
    .refine(v => v.replace(/[ .-]/g, '').length >= 4, 'SWIFT/BIC must be at least 4 characters'),
  destinationBankName: z.string().optional().default(''),
  destinationIban: z
    .string()
    // Accept ANY IBAN-style input — no strict 2-letter/2-digit enforcement.
    .transform(v => v.trim().toUpperCase())
    .refine(v => v.length > 0, 'IBAN is required')
    .refine(v => /^[A-Z0-9 .-]+$/.test(v), 'IBAN can only contain letters, numbers, spaces, dashes or dots')
    .refine(v => v.replace(/[ .-]/g, '').length >= 5, 'IBAN must be at least 5 characters'),
  sourceAmount: z.number().positive('Amount must be positive'),
  fee: z.number().min(0).optional().default(0),
  destinationCurrency: z.enum([
    'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'SGD', 'AED', 'AFN', 'ALL', 'AMD',
    'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BGN',
    'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN',
    'BZD', 'CAD', 'CDF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CVE', 'CZK',
    'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'FJD', 'FKP', 'GEL',
    'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG',
    'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'KES',
    'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP',
    'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT',
    'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN',
    'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR',
    'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR',
    'SDG', 'SEK', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SVC', 'SYP',
    'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS',
    'UAH', 'UGX', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD',
    'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWL',
  ]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type TransferInput = z.infer<typeof transferSchema>;