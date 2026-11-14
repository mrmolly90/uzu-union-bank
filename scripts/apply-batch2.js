/* ==========================================================================
   TEMPORARY patch runner #2 — currency-aware totals, admin crypto control,
   admin-managed deposit addresses. Every replacement asserts its occurrence
   count so nothing silently no-ops. Deleted after a verified run.
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
  done.push(`${file} :: ${count}x "${oldStr.split('\n')[0].slice(0, 58)}"`);
}

const DASH = 'src/app/(dashboard)/dashboard/page.tsx';
const ADMIN = 'src/app/(admin)/admin/page.tsx';

/* ========================================================================== */
/* 1. DASHBOARD — totals convert into the active currency, symbols follow it  */
/* ========================================================================== */

/* Totals become genuinely denominated in the active display currency. */
rep(
  DASH,
  `  const totalChecking = checkingAccounts.reduce((s, a) => s + Number(a.balance), 0);
  const totalSavings = savingsAccounts.reduce((s, a) => s + Number(a.balance), 0);
  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);`,
  `  // Convert an amount from its own currency into the active display currency.
  // Order: direct pair -> inverse pair -> cross via USD -> unchanged fallback.
  const convertToActive = (amount: number, currency: string): number => {
    const n = Number(amount) || 0;
    if (!currency || currency === activeAccount) return n;
    const direct = Number(rates?.[\`\${currency}/\${activeAccount}\`]?.rate);
    if (direct) return n * direct;
    const inverse = Number(rates?.[\`\${activeAccount}/\${currency}\`]?.rate);
    if (inverse) return n / inverse;
    const toUsd = currency === 'USD' ? 1 : Number(rates?.[\`USD/\${currency}\`]?.rate);
    const fromUsd = activeAccount === 'USD' ? 1 : Number(rates?.[\`\${activeAccount}/USD\`]?.rate);
    if (toUsd && fromUsd) return (n / toUsd) * fromUsd;
    return n;
  };

  // Checking/Savings/Total are summed in the active currency so the symbol we
  // print next to them is always the correct one.
  const totalChecking = checkingAccounts.reduce((s, a) => s + convertToActive(a.balance, a.currency), 0);
  const totalSavings = savingsAccounts.reduce((s, a) => s + convertToActive(a.balance, a.currency), 0);
  const totalBalance = accounts.reduce((s, a) => s + convertToActive(a.balance, a.currency), 0);`
);

/* Currency switcher on the Total Balance card. */
rep(
  DASH,
  `                    <button onClick={() => setShowBalance(!showBalance)} className="p-0.5 rounded text-gray-500 hover:text-bybit-yellow transition-colors">
                      {showBalance ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>`,
  `                    <button onClick={() => setShowBalance(!showBalance)} className="p-0.5 rounded text-gray-500 hover:text-bybit-yellow transition-colors">
                      {showBalance ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    {/* Display currency — every fiat total below follows this */}
                    <select
                      value={activeAccount}
                      onChange={(e) => setActiveAccount(e.target.value)}
                      title="Display currency"
                      className="ml-1 px-1.5 py-0.5 rounded bg-bybit-bg/60 border border-bybit-border text-[10px] font-semibold text-gray-300 focus:outline-none focus:border-bybit-yellow/50 cursor-pointer"
                    >
                      {Array.from(new Set(accounts.map(a => a.currency))).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      {accounts.length === 0 && <option value={activeAccount}>{activeAccount}</option>}
                    </select>`
);

/* Header balances button (compact, 0 decimals). */
rep(
  DASH,
  '<span className="text-blue-300 font-semibold">${totalChecking.toLocaleString(\'en-US\', {minimumFractionDigits:0})}</span>',
  '<span className="text-blue-300 font-semibold">{getCurrencySymbol(activeAccount)}{totalChecking.toLocaleString(\'en-US\', {minimumFractionDigits:0})}</span>'
);
rep(
  DASH,
  '<span className="text-emerald-300 font-semibold">${totalSavings.toLocaleString(\'en-US\', {minimumFractionDigits:0})}</span>',
  '<span className="text-emerald-300 font-semibold">{getCurrencySymbol(activeAccount)}{totalSavings.toLocaleString(\'en-US\', {minimumFractionDigits:0})}</span>'
);

/* Total Balance card: Checking / Savings split. */
rep(
  DASH,
  '<p className="text-xs font-semibold text-white">${totalChecking.toLocaleString(\'en-US\', {minimumFractionDigits:0})}</p>',
  '<p className="text-xs font-semibold text-white">{getCurrencySymbol(activeAccount)}{totalChecking.toLocaleString(\'en-US\', {minimumFractionDigits:0})}</p>'
);
rep(
  DASH,
  '<p className="text-xs font-semibold text-bybit-yellow">${totalSavings.toLocaleString(\'en-US\', {minimumFractionDigits:0})}</p>',
  '<p className="text-xs font-semibold text-bybit-yellow">{getCurrencySymbol(activeAccount)}{totalSavings.toLocaleString(\'en-US\', {minimumFractionDigits:0})}</p>'
);

/* Quick stats row (2 decimals). Anchored on the label so it stays unique. */
rep(
  DASH,
  'Checking</p><p className="text-sm font-bold text-white">${totalChecking.toLocaleString(\'en-US\', {minimumFractionDigits:2})}</p>',
  'Checking</p><p className="text-sm font-bold text-white">{getCurrencySymbol(activeAccount)}{totalChecking.toLocaleString(\'en-US\', {minimumFractionDigits:2})}</p>'
);
rep(
  DASH,
  'Savings</p><p className="text-sm font-bold text-bybit-yellow">${totalSavings.toLocaleString(\'en-US\', {minimumFractionDigits:2})}</p>',
  'Savings</p><p className="text-sm font-bold text-bybit-yellow">{getCurrencySymbol(activeAccount)}{totalSavings.toLocaleString(\'en-US\', {minimumFractionDigits:2})}</p>'
);

/* Balances modal cards. */
rep(
  DASH,
  '<p className="text-lg font-bold text-white">${Number(totalChecking).toLocaleString(\'en-US\', {minimumFractionDigits:2})}</p>',
  '<p className="text-lg font-bold text-white">{getCurrencySymbol(activeAccount)}{Number(totalChecking).toLocaleString(\'en-US\', {minimumFractionDigits:2})}</p>'
);
rep(
  DASH,
  '<p className="text-lg font-bold text-bybit-yellow">${Number(totalSavings).toLocaleString(\'en-US\', {minimumFractionDigits:2})}</p>',
  '<p className="text-lg font-bold text-bybit-yellow">{getCurrencySymbol(activeAccount)}{Number(totalSavings).toLocaleString(\'en-US\', {minimumFractionDigits:2})}</p>'
);

/* Hidden-balance bullets (avoid matching the bullet glyphs themselves). */
rep(
  DASH,
  "`$${totalBalance.toLocaleString('en-US', {minimumFractionDigits:2})}`",
  "`${getCurrencySymbol(activeAccount)}${totalBalance.toLocaleString('en-US', {minimumFractionDigits:2})}`"
);
rep(
  DASH,
  "`$${Number(totalChecking).toLocaleString('en-US', {minimumFractionDigits:2})}`",
  "`${getCurrencySymbol(activeAccount)}${Number(totalChecking).toLocaleString('en-US', {minimumFractionDigits:2})}`"
);
rep(
  DASH,
  "`$${Number(totalSavings).toLocaleString('en-US', {minimumFractionDigits:2})}`",
  "`${getCurrencySymbol(activeAccount)}${Number(totalSavings).toLocaleString('en-US', {minimumFractionDigits:2})}`"
);

/* Domestic transfer modal. */
rep(
  DASH,
  '<p className="text-xs font-bold text-white">${Number(totalChecking).toLocaleString(\'en-US\', {minimumFractionDigits:2})}</p>',
  '<p className="text-xs font-bold text-white">{getCurrencySymbol(activeAccount)}{Number(totalChecking).toLocaleString(\'en-US\', {minimumFractionDigits:2})}</p>'
);
rep(
  DASH,
  '<p className="text-xs font-bold text-bybit-yellow">${Number(totalSavings).toLocaleString(\'en-US\', {minimumFractionDigits:2})}</p>',
  '<p className="text-xs font-bold text-bybit-yellow">{getCurrencySymbol(activeAccount)}{Number(totalSavings).toLocaleString(\'en-US\', {minimumFractionDigits:2})}</p>'
);

/* Remaining totals (transfer/settings modals). */
rep(
  DASH,
  '<p className="text-sm font-bold text-white">${totalChecking.toLocaleString(\'en-US\', {minimumFractionDigits:2})}</p>',
  '<p className="text-sm font-bold text-white">{getCurrencySymbol(activeAccount)}{totalChecking.toLocaleString(\'en-US\', {minimumFractionDigits:2})}</p>'
);
rep(
  DASH,
  '<p className="text-sm font-bold text-bybit-yellow">${totalSavings.toLocaleString(\'en-US\', {minimumFractionDigits:2})}</p>',
  '<p className="text-sm font-bold text-bybit-yellow">{getCurrencySymbol(activeAccount)}{totalSavings.toLocaleString(\'en-US\', {minimumFractionDigits:2})}</p>'
);

/* Amount input prefixes. */
rep(
  DASH,
  '<span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>',
  '<span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{getCurrencySymbol(activeAccount)}</span>'
);
rep(
  DASH,
  '<span className="text-sm font-bold text-bybit-yellow">$</span>',
  '<span className="text-sm font-bold text-bybit-yellow">{getCurrencySymbol(activeAccount)}</span>'
);

/* Domestic transfer button + available-balance hint. */
rep(
  DASH,
  '<><Send size={16} /> Transfer ${parseFloat(domesticAmount || \'0\').toLocaleString()} to',
  '<><Send size={16} /> Transfer {getCurrencySymbol(activeAccount)}{parseFloat(domesticAmount || \'0\').toLocaleString()} to'
);
rep(
  DASH,
  'Available: <span className="text-white font-medium">${totalBalance.toLocaleString(\'en-US\', {minimumFractionDigits:2})}</span>',
  'Available: <span className="text-white font-medium">{getCurrencySymbol(activeAccount)}{totalBalance.toLocaleString(\'en-US\', {minimumFractionDigits:2})}</span>'
);

/* Success toast must not print a "$" over a EUR/GBP transfer. */
rep(
  DASH,
  "      setDomesticSuccess(`Successfully transferred $${parseFloat(domesticAmount).toLocaleString()} from ${domesticFrom === 'checking' ? 'Checking' : 'Savings'} to ${domesticFrom === 'checking' ? 'Savings' : 'Checking'}`);",
  "      setDomesticSuccess(`Successfully transferred ${getCurrencySymbol(activeAccount)}${parseFloat(domesticAmount).toLocaleString()} from ${domesticFrom === 'checking' ? 'Checking' : 'Savings'} to ${domesticFrom === 'checking' ? 'Savings' : 'Checking'}`);"
);

/* The two big account cards show a single account: use THAT account's currency. */
rep(
  DASH,
  "`${getCurrencySymbol(activeAccount)}${Number(primaryChecking?.balance || 0).toLocaleString('en-US', {minimumFractionDigits:2})}`",
  "`${getCurrencySymbol(primaryChecking?.currency || activeAccount)}${Number(primaryChecking?.balance || 0).toLocaleString('en-US', {minimumFractionDigits:2})}`"
);
rep(
  DASH,
  "`${getCurrencySymbol(activeAccount)}${Number(primarySavings?.balance || 0).toLocaleString('en-US', {minimumFractionDigits:2})}`",
  "`${getCurrencySymbol(primarySavings?.currency || activeAccount)}${Number(primarySavings?.balance || 0).toLocaleString('en-US', {minimumFractionDigits:2})}`"
);

/* ========================================================================== */
/* 2. DASHBOARD — deposit addresses come from the admin, not from source      */
/* ========================================================================== */

rep(
  DASH,
  `  const [receiptTx, setReceiptTx] = useState<TransactionRecord | null>(null);`,
  `  const [receiptTx, setReceiptTx] = useState<TransactionRecord | null>(null);
  // Deposit addresses are admin-controlled (see /api/crypto/addresses).
  const [cryptoAddresses, setCryptoAddresses] = useState<Record<string, { address: string; network: string; minDeposit: string }>>({});`
);

rep(
  DASH,
  `  useEffect(() => {
    if (!hydrated) return; // Wait for Zustand to hydrate from localStorage
    if (!isAuthenticated) { router.push('/login'); return; }
    fetchData();
  }, [isAuthenticated, hydrated, router, fetchData]);`,
  `  useEffect(() => {
    if (!hydrated) return; // Wait for Zustand to hydrate from localStorage
    if (!isAuthenticated) { router.push('/login'); return; }
    fetchData();
  }, [isAuthenticated, hydrated, router, fetchData]);

  // Admin-managed crypto deposit addresses.
  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    const { tokens } = useAuthStore.getState();
    if (!tokens?.accessToken) return;
    fetch('/api/crypto/addresses', { headers: { Authorization: \`Bearer \${tokens.accessToken}\` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: any[]) => {
        const map: Record<string, { address: string; network: string; minDeposit: string }> = {};
        for (const row of rows || []) {
          map[row.symbol] = { address: row.address, network: row.network, minDeposit: row.minDeposit };
        }
        setCryptoAddresses(map);
      })
      .catch(() => {});
  }, [hydrated, isAuthenticated]);`
);

rep(
  DASH,
  `                  {selectedCrypto.symbol === 'BTC' ? 'bc1qar0s8r5x9v8z4k6m2n3p7q9t2w5x8y0z3a6b' :
                   selectedCrypto.symbol === 'ETH' ? '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18' :
                   selectedCrypto.symbol === 'SOL' ? '7v9Kp7X5y3Qz2W8r4M6n1B9c3D5f7G8h0J2k4L6' :
                   '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18'}`,
  `                  {cryptoAddresses[selectedCrypto.symbol]?.address || 'Address not configured by administrator'}`
);

rep(
  DASH,
  `                <button onClick={() => copyToClipboard(
                  selectedCrypto.symbol === 'BTC' ? 'bc1qar0s8r5x9v8z4k6m2n3p7q9t2w5x8y0z3a6b' :
                  selectedCrypto.symbol === 'ETH' ? '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18' :
                  selectedCrypto.symbol === 'SOL' ? '7v9Kp7X5y3Qz2W8r4M6n1B9c3D5f7G8h0J2k4L6' :
                  '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18', 'crypto-deposit')}`,
  `                <button onClick={() => copyToClipboard(cryptoAddresses[selectedCrypto.symbol]?.address || '', 'crypto-deposit')}`
);

/* Stale hardcoded account reference in the deposit notice. */
rep(
  DASH,
  `All crypto deposits are automatically converted to USD and credited to your Checking Account (UZU-CHK-****0001). Estimated conversion: 10-30 minutes after network confirmation.`,
  `All crypto deposits are automatically converted to USD and credited to your Checking Account ({formatIbanShort(primaryChecking?.accountNumber || '')}). Estimated conversion: 10-30 minutes after network confirmation.`
);

/* ========================================================================== */
/* 3. ADMIN PANEL — Crypto Control tab                                        */
/* ========================================================================== */

rep(
  ADMIN,
  `RotateCcw } from 'lucide-react';`,
  `RotateCcw, Bitcoin, Copy } from 'lucide-react';`
);

rep(
  ADMIN,
  `  const [txSearch, setTxSearch] = useState('');`,
  `  const [txSearch, setTxSearch] = useState('');
  const [cryptoRows, setCryptoRows] = useState<{ id: string; symbol: string; name: string; network: string; address: string; minDeposit: string; isActive: boolean }[]>([]);
  const [cryptoSaving, setCryptoSaving] = useState<string | null>(null);
  const [cryptoMessage, setCryptoMessage] = useState('');`
);

rep(
  ADMIN,
  `    fetchUsers(t);
    fetchTransactions(t);
  }, [router]);`,
  `    fetchUsers(t);
    fetchTransactions(t);
    fetchCryptoAddresses(t);
  }, [router]);`
);

rep(
  ADMIN,
  `  const logout = () => {`,
  `  /** Load the admin-managed crypto deposit addresses. */
  const fetchCryptoAddresses = async (t: string) => {
    try {
      const res = await fetch('/api/admin/crypto-addresses', { headers: { Authorization: \`Bearer \${t}\` } });
      if (res.ok) setCryptoRows(await res.json());
    } catch {}
  };

  const handleCryptoAddressSave = async (row: { symbol: string; network: string; address: string; minDeposit: string }) => {
    if (!token) return;
    setCryptoSaving(row.symbol);
    setCryptoMessage('');
    try {
      const res = await fetch('/api/admin/crypto-addresses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
        body: JSON.stringify(row),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Save failed');
      }
      setCryptoMessage(\`\${row.symbol} deposit address updated — users copying from their wallet now receive this address.\`);
      fetchCryptoAddresses(token);
    } catch (err: any) {
      setCryptoMessage(err.message || 'Save failed');
    } finally {
      setCryptoSaving(null);
    }
  };

  const logout = () => {`
);

rep(
  ADMIN,
  `            { id: 'accounts', label: 'Accounts', icon: Building2 },
          ].map(tab => (`,
  `            { id: 'accounts', label: 'Accounts', icon: Building2 },
            { id: 'crypto', label: 'Crypto Control', icon: Bitcoin },
          ].map(tab => (`
);

/* New tab content, inserted just before the closing wrappers. */
rep(
  ADMIN,
  `                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}`,
  `                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Crypto Control Tab — addresses users copy in their wallet */}
        {activeTab === 'crypto' && (
          <div className="space-y-4">
            <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-5">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <Bitcoin size={16} className="text-amber-400" /> Crypto Deposit Addresses
              </h3>
              <p className="text-[11px] text-slate-500 mb-4">
                These are the addresses customers copy from their Crypto Wallet deposit screen.
                Saving here updates every user immediately — no redeploy required.
              </p>

              {cryptoMessage && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs mb-4">
                  <Check size={14} /> {cryptoMessage}
                </div>
              )}

              <div className="space-y-3">
                {cryptoRows.length === 0 && (
                  <p className="text-sm text-slate-500 py-6 text-center">
                    No crypto addresses configured yet. Run \`npm run db:seed\` to create the defaults, then edit them here.
                  </p>
                )}
                {cryptoRows.map((row) => (
                  <div key={row.symbol} className="p-4 rounded-xl bg-slate-900/50 border border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{row.symbol}</span>
                        <span className="text-[10px] text-slate-500">{row.name}</span>
                        <span className={\`text-[9px] px-1.5 py-0.5 rounded-full \${row.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}\`}>
                          {row.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <button
                        onClick={() => navigator.clipboard?.writeText(row.address)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                        title="Copy address"
                      >
                        <Copy size={12} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase">Network</label>
                        <input
                          type="text"
                          defaultValue={row.network}
                          id={\`crypto-network-\${row.symbol}\`}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-xs focus:border-amber-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase">Min Deposit</label>
                        <input
                          type="text"
                          defaultValue={row.minDeposit}
                          id={\`crypto-min-\${row.symbol}\`}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-xs focus:border-amber-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase">Status</label>
                        <select
                          defaultValue={row.isActive ? 'active' : 'disabled'}
                          id={\`crypto-active-\${row.symbol}\`}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-xs focus:border-amber-500 outline-none"
                        >
                          <option value="active">Active</option>
                          <option value="disabled">Disabled</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase">Deposit Address</label>
                      <input
                        type="text"
                        defaultValue={row.address}
                        id={\`crypto-address-\${row.symbol}\`}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-xs font-mono focus:border-amber-500 outline-none"
                      />
                    </div>

                    <button
                      onClick={() => {
                        const val = (id: string, fallback: string) =>
                          (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value || fallback;
                        handleCryptoAddressSave({
                          symbol: row.symbol,
                          network: val(\`crypto-network-\${row.symbol}\`, row.network),
                          minDeposit: val(\`crypto-min-\${row.symbol}\`, row.minDeposit),
                          address: val(\`crypto-address-\${row.symbol}\`, row.address),
                          isActive: val(\`crypto-active-\${row.symbol}\`, row.isActive ? 'active' : 'disabled') === 'active',
                        } as any);
                      }}
                      disabled={cryptoSaving === row.symbol}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-900 font-bold text-xs hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      {cryptoSaving === row.symbol
                        ? <><div className="w-3 h-3 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" /> Saving…</>
                        : <><Check size={14} /> Save {row.symbol} Address</>}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}`
);

/* ========================================================================== */
/* 4. SEED — default crypto addresses (editable afterwards in the panel)      */
/* ========================================================================== */

rep(
  'prisma/seed.ts',
  `  console.log('Seeding complete.');`,
  `  // Default crypto deposit addresses. Admins can change these at runtime from
  // Admin Panel > Crypto Control; re-seeding restores the defaults below.
  const cryptoDefaults = [
    { symbol: 'BTC', name: 'Bitcoin', network: 'Bitcoin', address: 'bc1qar0s8r5x9v8z4k6m2n3p7q9t2w5x8y0z3a6b', minDeposit: '0.001 BTC' },
    { symbol: 'ETH', name: 'Ethereum', network: 'Ethereum (ERC-20)', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18', minDeposit: '0.01 ETH' },
    { symbol: 'USDC', name: 'USD Coin', network: 'Ethereum (ERC-20)', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18', minDeposit: '10 USDC' },
    { symbol: 'SOL', name: 'Solana', network: 'Solana', address: '7v9Kp7X5y3Qz2W8r4M6n1B9c3D5f7G8h0J2k4L6', minDeposit: '0.1 SOL' },
  ];

  for (const c of cryptoDefaults) {
    await prisma.cryptoAddress.upsert({
      where: { symbol: c.symbol },
      update: {},
      create: { ...c, isActive: true },
    });
  }

  console.log(\`  ✓ \${cryptoDefaults.length} crypto deposit addresses seeded\`);
  console.log('Seeding complete.');`
);

console.log('APPLIED ' + done.length + ' PATCH(ES):');
for (const line of done) console.log('  OK ' + line);
