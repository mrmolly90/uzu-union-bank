/* ==========================================================================
   UZU UNION BANK — Cryptographic Signature & Hash Utilities
   Simulates SHA-256 hashing, multi-signature generation, and ledger
   fingerprinting. No real cryptographic operations — architected as if
   backed by an HSM module.
   ========================================================================== */

var CryptoUtils = (function () {
  'use strict';

  /* --------------------------------------------------------------------
     Constants
     -------------------------------------------------------------------- */
  var HASH_ALPHABET = '0123456789abcdef';
  var HASH_LENGTH   = 64; // SHA-256 hex length

  /* --------------------------------------------------------------------
     Generate a deterministic-looking hex hash from an input string.
     Uses a simple FNV-1a-like algorithm to produce a 64-char hex string.
     Not cryptographically secure — for simulation only.
     -------------------------------------------------------------------- */
  function generateHash(input) {
    try {
      if (typeof input !== 'string') {
        input = String(input);
      }

      var hash = 0;
      var i, chr;

      // FNV-1a 32-bit mixing
      for (i = 0; i < input.length; i++) {
        chr = input.charCodeAt(i);
        hash = ((hash ^ chr) * 16777619) >>> 0;
      }

      // Seed a simple PRNG with the hash for deterministic output
      var seed = hash;
      var result = '';

      for (i = 0; i < HASH_LENGTH; i++) {
        seed = (seed * 1103515245 + 12345) >>> 0;
        result += HASH_ALPHABET[seed % 16];
      }

      return '0x' + result;
    } catch (err) {
      console.error('[CryptoUtils] generateHash error:', err);
      return '0x' + '0'.repeat(HASH_LENGTH);
    }
  }

  /* --------------------------------------------------------------------
     Generate a multi-signature approval hash
     Simulates a 3-of-5 multi-sig approval. Takes an array of signer IDs
     and returns a combined signature hash.
     -------------------------------------------------------------------- */
  function generateMultiSig(txHash, signers) {
    try {
      if (!txHash || !signers || !Array.isArray(signers) || signers.length < 3) {
        throw new Error('Multi-sig requires at least 3 signers');
      }

      var combined = txHash + '|' + signers.sort().join(',') + '|' + Date.now();
      return generateHash(combined);
    } catch (err) {
      console.error('[CryptoUtils] generateMultiSig error:', err);
      return null;
    }
  }

  /* --------------------------------------------------------------------
     Generate a ledger entry fingerprint
     Combines previous block hash, transaction data, and timestamp.
     -------------------------------------------------------------------- */
  function generateLedgerFingerprint(prevBlockHash, txData) {
    try {
      var raw = (prevBlockHash || '0x0') + '|' + JSON.stringify(txData) + '|' + Date.now();
      return generateHash(raw);
    } catch (err) {
      console.error('[CryptoUtils] generateLedgerFingerprint error:', err);
      return null;
    }
  }

  /* --------------------------------------------------------------------
     Validate a hash format (basic hex check)
     -------------------------------------------------------------------- */
  function isValidHash(str) {
    try {
      return typeof str === 'string' &&
        /^0x[0-9a-f]{64}$/i.test(str);
    } catch (err) {
      return false;
    }
  }

  /* --------------------------------------------------------------------
     Export
     -------------------------------------------------------------------- */
  return {
    generateHash: generateHash,
    generateMultiSig: generateMultiSig,
    generateLedgerFingerprint: generateLedgerFingerprint,
    isValidHash: isValidHash
  };
})();