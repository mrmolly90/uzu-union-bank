/* ==========================================================================
   TEMPORARY patch runner — applies the reviewed fixes, then is deleted.
   Every replacement asserts its occurrence count so nothing silently no-ops.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const root = process.cwd();
const done = [];

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);

/** Exact-string replace on an LF-normalised copy (tolerates CRLF sources). */
function rep(file, oldStr, newStr, expect = 1) {
  let src = read(file).replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
  const count = src.split(oldStr).length - 1;
  if (count !== expect) {
    throw new Error(
      `[${file}] expected ${expect} match(es), found ${count} for:\n---\n${oldStr}\n---`
    );
  }
  write(file, src.split(oldStr).join(newStr));
  done.push(`${file} :: ${count}x "${oldStr.split('\n')[0].slice(0, 62)}"`);
}

/* -------------------------------------------------------------------------- */
/* 1. SEED — admin password must be admin@2026 and must survive a re-seed      */
/* -------------------------------------------------------------------------- */

rep(
  'prisma/seed.ts',
  "const adminHash = await bcrypt.hash('Admin@2026', 12);",
  "const adminHash = await bcrypt.hash('admin@2026', 12);"
);

rep(
  'prisma/seed.ts',
  `  await prisma.admin.upsert({
    where: { email: 'admin@uzudigitalunion.com' },
    update: {},
    create: {
      email: 'admin@uzudigitalunion.com',
      passwordHash: adminHash,
      fullName: 'System Administrator',
      role: 'SUPER_ADMIN',
    },
  });`,
  `  await prisma.admin.upsert({
    where: { email: 'admin@uzudigitalunion.com' },
    // Update the hash as well: with \`update: {}\` a re-seed left a stale
    // password in the database, so 'admin@2026' could never authenticate.
    update: { passwordHash: adminHash, role: 'SUPER_ADMIN' },
    create: {
      email: 'admin@uzudigitalunion.com',
      passwordHash: adminHash,
      fullName: 'System Administrator',
      role: 'SUPER_ADMIN',
    },
  });`
);

rep(
  'prisma/seed.ts',
  'Admin created: admin@uzudigitalunion.com / Admin@2026',
  'Admin ready: admin@uzudigitalunion.com / admin@2026'
);

/* Demo accounts: plain 16-digit numbers, no UZU-CHK-/UZU-SAV- prefixes. */
const seedAccounts = [
  ["UZU-CHK-1000000100001001", "1000000100001001"],
  ["UZU-CHK-1000000100001002", "1000000100001002"],
  ["UZU-CHK-1000000100001003", "1000000100001003"],
  ["UZU-SAV-2000000100001001", "2000000100001001"],
  ["UZU-SAV-2000000100001002", "2000000100001002"],
  ["UZU-SAV-2000000100001003", "2000000100001003"],
  ["UZU-SAV-2000000100001004", "2000000100001004"],
];
for (const [oldNum, newNum] of seedAccounts) {
  rep(`prisma/seed.ts`, `accountNumber: '${oldNum}'`, `accountNumber: '${newNum}'`);
}

/* -------------------------------------------------------------------------- */
/* 2. TRANSFER PAGE — restore Checking/Savings detection + 16-digit IBANs      */
/* -------------------------------------------------------------------------- */

rep(
  'src/app/(dashboard)/transfer/page.tsx',
  `  const checkingAccounts = accounts.filter(a => a.accountNumber?.includes('CHK'));
  const savingsAccounts = accounts.filter(a => a.accountNumber?.includes('SAV'));`,
  `  // Account type is authoritative. New accounts carry plain 16-digit numbers
  // with no CHK/SAV marker, so filtering on the string alone emptied both
  // columns and broke the whole transfer flow. \`includes\` stays as a fallback
  // for legacy rows still stored as UZU-CHK-…/UZU-SAV-….
  const checkingAccounts = accounts.filter(a => a.accountType === 'CHECKING' || a.accountNumber?.includes('CHK'));
  const savingsAccounts = accounts.filter(a => a.accountType === 'SAVINGS' || a.accountNumber?.includes('SAV'));`
);

rep(
  'src/app/(dashboard)/transfer/page.tsx',
  `import type { AccountBalance } from '@/types';`,
  `import type { AccountBalance } from '@/types';
import { formatIbanDisplay as ibanFull, formatIbanShort as ibanShort } from '@/lib/format';`
);

rep(
  'src/app/(dashboard)/transfer/page.tsx',
  `const formatIbanShort = (num: string) => {
  if (!num) return '****';
  const last4 = num.slice(-4);
  return \`****\${last4}\`;
};`,
  `// Single source of truth (src/lib/format.ts): last 4 digits, legacy-safe.
const formatIbanShort = (num: string) => ibanShort(num);`
);

/* Full 16-digit number on both "From Account" cards. */
rep(
  'src/app/(dashboard)/transfer/page.tsx',
  `                        <p className="text-[9px] text-gray-500 font-mono">{formatIbanShort(primaryChecking?.accountNumber || '')}</p>`,
  `                        <p className="text-[9px] text-gray-500 font-mono">{ibanFull(primaryChecking?.accountNumber || '')}</p>`
);
rep(
  'src/app/(dashboard)/transfer/page.tsx',
  `                        <p className="text-[9px] text-gray-500 font-mono">{formatIbanShort(primarySavings?.accountNumber || '')}</p>`,
  `                        <p className="text-[9px] text-gray-500 font-mono">{ibanFull(primarySavings?.accountNumber || '')}</p>`
);

/* Pluralisation bug: "currencyies". */
rep(
  'src/app/(dashboard)/transfer/page.tsx',
  `{checkingAccounts.length} currency{checkingAccounts.length !== 1 ? 'ies' : ''}`,
  `{checkingAccounts.length} {checkingAccounts.length === 1 ? 'currency' : 'currencies'}`
);
rep(
  'src/app/(dashboard)/transfer/page.tsx',
  `{savingsAccounts.length} currency{savingsAccounts.length !== 1 ? 'ies' : ''}`,
  `{savingsAccounts.length} {savingsAccounts.length === 1 ? 'currency' : 'currencies'}`
);

/* Refresh balances after a successful wire. */
rep(
  'src/app/(dashboard)/transfer/page.tsx',
  `      setReceiptRef(\`UZU-WIRE-\${Date.now().toString(36).toUpperCase()}\`);
      setSuccess(true);`,
  `      setReceiptRef(\`UZU-WIRE-\${Date.now().toString(36).toUpperCase()}\`);
      setSuccess(true);
      fetchAccounts();`
);

/* -------------------------------------------------------------------------- */
/* 3. DASHBOARD — IBAN boxes use the shared 16-digit formatter                 */
/* -------------------------------------------------------------------------- */

rep(
  'src/app/(dashboard)/dashboard/page.tsx',
  `import { COUNTRIES, CURRENCY_SYMBOLS, getCountryName, getCurrencyByCountryCode } from '@/lib/countries';`,
  `import { COUNTRIES, CURRENCY_SYMBOLS, getCountryName, getCurrencyByCountryCode } from '@/lib/countries';
import { formatIbanDisplay as ibanFull, formatIbanShort as ibanShort } from '@/lib/format';`
);

rep(
  'src/app/(dashboard)/dashboard/page.tsx',
  `  const maskAccount = (num: string) => {
    if (!num) return '****';
    const last4 = num.slice(-4);
    return \`****\${last4}\`;
  };

  const formatIbanDisplay = (num: string) => {
    if (!num) return '****';
    // Extract the numeric part between the hyphens and show last 16 digits
    const parts = num.split('-');
    const numericPart = parts.length >= 2 ? parts[1] : num;
    const last16 = numericPart.slice(-16);
    return \`\${last16}\`;
  };

  const formatIbanShort = (num: string) => {
    if (!num) return '****';
    const last4 = num.slice(-4);
    return \`****\${last4}\`;
  };`,
  `  // IBAN boxes show exactly 16 digits for BOTH checking and savings.
  // The old local version split on '-' and returned only 13 digits for legacy
  // UZU-CHK-10000001 rows; src/lib/format.ts strips non-digits then takes 16.
  const maskAccount = (num: string) => ibanShort(num);
  const formatIbanDisplay = (num: string) => ibanFull(num);
  const formatIbanShort = (num: string) => ibanShort(num);`
);

/* -------------------------------------------------------------------------- */
/* 4. ADMIN LOGIN — normalise the email so casing/whitespace can't fail it     */
/* -------------------------------------------------------------------------- */

rep(
  'src/app/api/admin/login/route.ts',
  `    const admin = await prisma.admin.findUnique({ where: { email } });`,
  `    const normalizedEmail = String(email).trim().toLowerCase();
    const admin = await prisma.admin.findUnique({ where: { email: normalizedEmail } });`
);

/* -------------------------------------------------------------------------- */
/* 5. ADMIN APIs — reject ordinary customer tokens (they share JWT_SECRET)     */
/* -------------------------------------------------------------------------- */

const adminRoutes = [
  'src/app/api/admin/users/route.ts',
  'src/app/api/admin/accounts/route.ts',
  'src/app/api/admin/transactions/route.ts',
  'src/app/api/admin/transactions/status/route.ts',
];

for (const file of adminRoutes) {
  rep(
    file,
    `    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as any;
    return decoded;`,
    `    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as any;
    // Customer access tokens are signed with the same secret but carry no role.
    if (!decoded || !decoded.role) return null;
    return decoded;`
  );
}

/* -------------------------------------------------------------------------- */
/* 6. .env — SmartSupp key moves out of source                             */
/* -------------------------------------------------------------------------- */

{
  const envPath = path.join(root, '.env');
  let env = fs.readFileSync(envPath, 'utf8');
  if (!env.includes('NEXT_PUBLIC_SMARTSUPP_KEY')) {
    env = env.replace(/\s*$/, '') +
      '\r\n\r\n# --- SmartSupp live chat (support widget) ---\r\n' +
      '# Paste the key from Dashboard > Settings > Chat widget > Installation code.\r\n' +
      '# The widget is not rendered while this is empty.\r\n' +
      'NEXT_PUBLIC_SMARTSUPP_KEY=""\r\n';
    fs.writeFileSync(envPath, env);
    done.push('.env :: appended NEXT_PUBLIC_SMARTSUPP_KEY');
  } else {
    done.push('.env :: NEXT_PUBLIC_SMARTSUPP_KEY already present');
  }
}

console.log('APPLIED ' + done.length + ' PATCH(ES):');
for (const line of done) console.log('  OK ' + line);
