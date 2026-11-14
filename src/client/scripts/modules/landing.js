/* ==========================================================================
   UZU UNION BANK — Landing Page Controller
   Initializes FX ticker, TX hash rotation, scroll reveal, validator status.
   Uses Web Crypto API for hashing, fetches live rates from backend.
   ========================================================================== */

const LandingController = (() => {
  let txInterval = null;

  function init() {
    setupTxHash();
    setupScrollReveal();
    initFxRates();
    console.log('[Uzu Bank] Landing initialized.');
  }

  async function setupTxHash() {
    const el = document.getElementById('tx-hash');
    if (!el) return;
    const update = async () => {
      try {
        if (typeof CryptoUtils !== 'undefined' && typeof CryptoUtils.generateTxHash === 'function') {
          const hash = await CryptoUtils.generateTxHash();
          el.textContent = CryptoUtils.shortHash(hash);
        } else {
          const bytes = crypto.getRandomValues(new Uint8Array(12));
          const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
          el.textContent = '0x' + hex.substring(0, 8) + '…' + hex.substring(hex.length - 4);
        }
      } catch (err) { console.error('[TX Hash]', err); }
    };
    await update();
    txInterval = setInterval(update, 8000);
  }

  function setupScrollReveal() {
    try {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
      );
      document.querySelectorAll('.reveal').forEach(el => {
        observer.observe(el);
      });
    } catch (err) { /* graceful fallback */ }
  }

  function initFxRates() {
    if (typeof FxRates !== 'undefined' && typeof FxRates.init === 'function') {
      try { FxRates.init(); } catch (e) { console.error('[FX]', e); }
    }
  }

  function destroy() {
    if (txInterval) clearInterval(txInterval);
    if (typeof FxRates !== 'undefined' && typeof FxRates.destroy === 'function') {
      try { FxRates.destroy(); } catch (e) { /* ignore */ }
    }
  }

  return { init, destroy };
})();

document.addEventListener('DOMContentLoaded', () => LandingController.init());