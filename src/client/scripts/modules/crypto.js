/* ==========================================================================
   UZU UNION BANK — Crypto Utilities
   SHA-256 hashing via Web Crypto API, multi-signature, ledger fingerprinting.
   ========================================================================== */

const CryptoUtils = (() => {
  const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

  function bufToHex(buf) {
    const bytes = new Uint8Array(buf);
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
      out += HEX[bytes[i]];
    }
    return out;
  }

  async function generateHash(input) {
    try {
      const str = String(input ?? '');
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuf = await crypto.subtle.digest('SHA-256', data);
      return '0x' + bufToHex(hashBuf);
    } catch (err) {
      console.error('[Crypto] generateHash error:', err);
      return '0x' + '0'.repeat(64);
    }
  }

  async function generateTxHash() {
    const entropy = 'tx-' + Date.now() + '-' + crypto.randomUUID();
    return generateHash(entropy);
  }

  async function generateMultiSig(txHash, signers) {
    if (!txHash || !Array.isArray(signers) || signers.length < 3) return null;
    const combined = `${txHash}|${[...signers].sort().join(',')}|${Date.now()}|${crypto.randomUUID()}`;
    return generateHash(combined);
  }

  async function generateLedgerFingerprint(prevHash, txData) {
    const raw = `${prevHash || '0x0'}|${JSON.stringify(txData)}|${Date.now()}|${crypto.randomUUID()}`;
    return generateHash(raw);
  }

  function isValidHash(str) {
    return typeof str === 'string' && /^0x[0-9a-f]{64}$/i.test(str);
  }

  function shortHash(hash) {
    if (!hash || hash.length < 10) return hash;
    return hash.substring(0, 6) + '…' + hash.substring(hash.length - 4);
  }

  return {
    generateHash,
    generateTxHash,
    generateMultiSig,
    generateLedgerFingerprint,
    isValidHash,
    shortHash,
  };
})();