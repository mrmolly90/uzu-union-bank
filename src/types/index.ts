export type KycStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export type TransactionStatus =
  | 'INITIATED'
  | 'HASHED'
  | 'MULTISIG_PENDING'
  | 'CLEARED'
  | 'SETTLED'
  | 'FAILED';

export type Currency = string;

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  countryCode: string;
  kycStatus: KycStatus;
  twoFactorEnabled: boolean;
  phone?: string;
  dob?: string;
  address?: string;
  occupation?: string;
  idNumber?: string;
  createdAt: string;
}

export interface AccountBalance {
  id: string;
  currency: Currency;
  balance: number;
  ledgerLockedBalance: number;
  accountNumber: string;
  accountType?: string;
}

export interface TransactionRecord {
  id: string;
  sourceAccountId: string;
  destinationBankSwift: string;
  destinationIban: string;
  sourceAmount: number;
  sourceCurrency: Currency;
  destinationAmount: number;
  destinationCurrency: Currency;
  exchangeRate: number;
  status: TransactionStatus;
  blockchainTxHash: string | null;
  createdAt: string;
}

export interface ExchangeRatePair {
  base: Currency;
  quote: Currency;
  rate: number;
  bid: number;
  ask: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}