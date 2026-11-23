/* ==========================================================================
   UZU UNION BANK — Database Snapshot Utility
   Takes a point-in-time snapshot of user state from the database to verify
   and display user store info instantly. Acts as a "verified checkpoint"
   for data integrity across ALL system functions.
   
   The snapshot captures:
   - User profile (from DB, not cached store) including transferPaused status
   - All accounts with current balances
   - Full transaction history (last 50)
   - Crypto deposit addresses (live from DB when admin adds them)
   - Unread notifications
   - Account totals and verification hashes
   - Balance reflection after admin funding
   ========================================================================== */

import { getPrisma } from './prisma';

export interface DbSnapshot {
  /** ISO timestamp when the snapshot was taken */
  timestamp: string;
  /** User profile data directly from DB */
  user: {
    id: string;
    email: string;
    fullName: string;
    countryCode: string;
    kycStatus: string;
    twoFactorEnabled: boolean;
    transferPaused: boolean;
    phone: string | null;
    dob: string | null;
    address: string | null;
    occupation: string | null;
    idNumber: string | null;
    createdAt: string;
  };
  /** All accounts with current balances */
  accounts: Array<{
    id: string;
    accountNumber: string;
    accountType: string;
    currency: string;
    balance: number;
    ledgerLockedBalance: number;
    isActive: boolean;
  }>;
  /** Account summary by type */
  summary: {
    checking: { count: number; totalBalance: number; currencies: string[] };
    savings: { count: number; totalBalance: number; currencies: string[] };
    totalPortfolio: number;
    homeCurrency: string;
  };
  /** Full transaction history (last 50) */
  recentTransactions: Array<{
    id: string;
    sourceAmount: number;
    sourceCurrency: string;
    destinationAmount: number;
    destinationCurrency: string;
    status: string;
    createdAt: string;
  }>;
  /** Crypto deposit addresses — live from DB, reflects admin additions instantly */
  cryptoAddresses: Array<{
    symbol: string;
    name: string;
    network: string;
    address: string;
    minDeposit: string;
    isActive: boolean;
  }>;
  /** User's crypto deposit requests — live from DB */
  cryptoDeposits: Array<{
    id: string;
    symbol: string;
    amount: string;
    blockchainTxHash: string;
    status: string;
    createdAt: string;
  }>;
  /** Unread notifications count */
  unreadNotifications: number;
  /** Verification hash for data integrity */
  verificationHash: string;
  /** System health indicators */
  health: {
    dbConnected: boolean;
    blobSynced: boolean;
    lastSyncTime: string | null;
  };
}

/**
 * Take a database snapshot for a user — a verified point-in-time capture
 * of all user state from the database, bypassing any cached/stale store data.
 * This is the "unsnapshot" mechanism that displays live DB state.
 */
export async function takeUserSnapshot(userId: string, homeCurrency?: string): Promise<DbSnapshot> {
  const prisma = await getPrisma();
  const timestamp = new Date().toISOString();

  // Fetch all user data in parallel — including crypto addresses, deposits, and full tx history
  const [user, accounts, recentTransactions, unreadCount, cryptoAddresses, cryptoDeposits] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, fullName: true, countryCode: true,
        kycStatus: true, twoFactorEnabled: true, transferPaused: true,
        phone: true, dob: true, address: true, occupation: true,
        idNumber: true, createdAt: true,
      },
    }),
    prisma.account.findMany({
      where: { userId },
      orderBy: [{ accountType: 'asc' }, { currency: 'asc' }],
    }),
    prisma.transaction.findMany({
      where: { initiatedById: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, sourceAmount: true, sourceCurrency: true,
        destinationAmount: true, destinationCurrency: true,
        status: true, createdAt: true,
      },
    }),
    prisma.notification.count({
      where: { userId, read: false },
    }),
    prisma.cryptoAddress.findMany({
      where: { isActive: true },
      orderBy: { symbol: 'asc' },
    }),
    prisma.cryptoDeposit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  if (!user) {
    throw new Error('User not found in database');
  }

  const effectiveHomeCurrency = homeCurrency || 'USD';

  // Build account summary
  const checkingAccounts = accounts.filter(a => a.accountType === 'CHECKING');
  const savingsAccounts = accounts.filter(a => a.accountType === 'SAVINGS');

  const checkingCurrencies: string[] = [];
  checkingAccounts.forEach(a => { if (!checkingCurrencies.includes(a.currency)) checkingCurrencies.push(a.currency); });
  const savingsCurrencies: string[] = [];
  savingsAccounts.forEach(a => { if (!savingsCurrencies.includes(a.currency)) savingsCurrencies.push(a.currency); });

  const summary = {
    checking: {
      count: checkingAccounts.length,
      totalBalance: checkingAccounts.reduce((s, a) => s + Number(a.balance), 0),
      currencies: checkingCurrencies,
    },
    savings: {
      count: savingsAccounts.length,
      totalBalance: savingsAccounts.reduce((s, a) => s + Number(a.balance), 0),
      currencies: savingsCurrencies,
    },
    totalPortfolio: accounts.reduce((s, a) => s + Number(a.balance), 0),
    homeCurrency: effectiveHomeCurrency,
  };

  // Generate verification hash from data
  const rawForHash = [
    userId,
    accounts.map(a => `${a.id}:${a.balance}:${a.currency}`).join('|'),
    recentTransactions.length,
    unreadCount,
    timestamp,
  ].join('::');

  // Simple SHA-256 hash using Web Crypto via Node
  const { createHash } = await import('crypto');
  const verificationHash = createHash('sha256').update(rawForHash).digest('hex').slice(0, 16);

  return {
    timestamp,
    user: {
      ...user,
      transferPaused: user.transferPaused ?? false,
      createdAt: user.createdAt.toISOString(),
    },
    accounts: accounts.map(a => ({
      id: a.id,
      accountNumber: a.accountNumber,
      accountType: a.accountType,
      currency: a.currency,
      balance: Number(a.balance),
      ledgerLockedBalance: Number(a.ledgerLockedBalance),
      isActive: a.isActive,
    })),
    summary,
    recentTransactions: recentTransactions.map(t => ({
      id: t.id,
      sourceAmount: Number(t.sourceAmount),
      sourceCurrency: t.sourceCurrency,
      destinationAmount: Number(t.destinationAmount),
      destinationCurrency: t.destinationCurrency,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
    })),
    cryptoAddresses: cryptoAddresses.map(c => ({
      symbol: c.symbol,
      name: c.name,
      network: c.network,
      address: c.address,
      minDeposit: c.minDeposit,
      isActive: c.isActive,
    })),
    cryptoDeposits: cryptoDeposits.map(d => ({
      id: d.id,
      symbol: d.symbol,
      amount: d.amount,
      blockchainTxHash: d.blockchainTxHash,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
    })),
    unreadNotifications: unreadCount,
    verificationHash,
    health: {
      dbConnected: true,
      blobSynced: !!process.env.VERCEL && !!process.env.BLOB_READ_WRITE_TOKEN,
      lastSyncTime: timestamp,
    },
  };
}

/**
 * AdminSnapshot — a system-wide view of all users with their accounts and balances.
 * Used by the admin panel to display all registered users from the live DB.
 * This is the "unsnapshot" mechanism for admin: reads directly from DB,
 * bypassing any cached data, so new users appear instantly.
 */
export interface AdminSnapshot {
  timestamp: string;
  users: Array<{
    id: string;
    email: string;
    fullName: string;
    countryCode: string;
    kycStatus: string;
    transferPaused: boolean;
    createdAt: string;
    accounts: Array<{
      id: string;
      accountNumber: string;
      accountType: string;
      currency: string;
      balance: number;
      isActive: boolean;
    }>;
    totalBalance: number;
    checkingBalance: number;
    savingsBalance: number;
    notificationCount: number;
  }>;
  stats: {
    totalUsers: number;
    totalBalance: number;
    totalChecking: number;
    totalSavings: number;
    pendingTransactions: number;
    settledTransactions: number;
    verifiedKyc: number;
  };
  verificationHash: string;
}

/**
 * Take a system-wide admin snapshot — ALL users with their accounts,
 * balances, and stats. Reads directly from DB for instant verification.
 * This ensures admin always sees every registered user.
 */
export async function takeAdminSnapshot(): Promise<AdminSnapshot> {
  const prisma = await getPrisma();
  const timestamp = new Date().toISOString();

  // Fetch all users with accounts and notification counts in parallel
  const [allUsers, pendingTxCount, settledTxCount] = await Promise.all([
    prisma.user.findMany({
      include: {
        accounts: {
          select: {
            id: true, accountNumber: true, accountType: true,
            currency: true, balance: true, isActive: true,
          },
        },
        _count: { select: { notifications: { where: { read: false } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.transaction.count({
      where: { status: { in: ['INITIATED', 'HASHED', 'MULTISIG_PENDING'] } },
    }),
    prisma.transaction.count({
      where: { status: 'SETTLED' },
    }),
  ]);

  const users = allUsers.map(u => {
    const accounts = u.accounts.map(a => ({
      id: a.id,
      accountNumber: a.accountNumber,
      accountType: a.accountType,
      currency: a.currency,
      balance: Number(a.balance),
      isActive: a.isActive,
    }));
    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const checkingBalance = accounts
      .filter(a => a.accountType === 'CHECKING')
      .reduce((s, a) => s + a.balance, 0);
    const savingsBalance = accounts
      .filter(a => a.accountType === 'SAVINGS')
      .reduce((s, a) => s + a.balance, 0);

    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      countryCode: u.countryCode,
      kycStatus: u.kycStatus,
      transferPaused: u.transferPaused ?? false,
      createdAt: u.createdAt.toISOString(),
      accounts,
      totalBalance,
      checkingBalance,
      savingsBalance,
      notificationCount: u._count.notifications,
    };
  });

  const stats = {
    totalUsers: users.length,
    totalBalance: users.reduce((s, u) => s + u.totalBalance, 0),
    totalChecking: users.reduce((s, u) => s + u.checkingBalance, 0),
    totalSavings: users.reduce((s, u) => s + u.savingsBalance, 0),
    pendingTransactions: pendingTxCount,
    settledTransactions: settledTxCount,
    verifiedKyc: users.filter(u => u.kycStatus === 'VERIFIED').length,
  };

  // Generate verification hash
  const { createHash } = await import('crypto');
  const rawForHash = [
    users.length,
    users.map(u => `${u.id}:${u.totalBalance}`).join('|'),
    timestamp,
  ].join('::');
  const verificationHash = createHash('sha256').update(rawForHash).digest('hex').slice(0, 16);

  return { timestamp, users, stats, verificationHash };
}

/**
 * Verify that the snapshot's data is still consistent with the database.
 * Returns true if the verification hash matches a fresh snapshot.
 */
export async function verifySnapshot(snapshot: DbSnapshot): Promise<{
  valid: boolean;
  fresh: DbSnapshot | null;
  discrepancies: string[];
}> {
  try {
    const fresh = await takeUserSnapshot(snapshot.user.id, snapshot.summary.homeCurrency);
    const discrepancies: string[] = [];

    // Compare key values
    if (fresh.verificationHash !== snapshot.verificationHash) {
      // Check specific fields for discrepancies
      for (const account of fresh.accounts) {
        const oldAccount = snapshot.accounts.find(a => a.id === account.id);
        if (oldAccount && oldAccount.balance !== account.balance) {
          discrepancies.push(
            `Account ${account.currency}(${account.accountType}): balance changed from ${oldAccount.balance} to ${account.balance}`
          );
        }
      }
      if (fresh.unreadNotifications !== snapshot.unreadNotifications) {
        discrepancies.push(
          `Notifications: ${snapshot.unreadNotifications} → ${fresh.unreadNotifications}`
        );
      }
      if (fresh.recentTransactions.length !== snapshot.recentTransactions.length) {
        discrepancies.push(
          `Transactions: ${snapshot.recentTransactions.length} → ${fresh.recentTransactions.length}`
        );
      }
    }

    return {
      valid: discrepancies.length === 0,
      fresh,
      discrepancies,
    };
  } catch (err) {
    return {
      valid: false,
      fresh: null,
      discrepancies: [`Verification failed: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}