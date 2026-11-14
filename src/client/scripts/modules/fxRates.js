/* ==========================================================================
   UZU UNION BANK — FX Rates Module
   Fetches live rates from backend API with simulated fallback for demo.
   ========================================================================== */

const FxRates = (() => {
  const PAIRS = [
    { id: 'fx-eur', base: 0.9222, spread: 0.0008, decimals: 4, label: 'USD/EUR' },
    { id: 'fx-gbp', base: 0.7920, spread: 0.0006, decimals: 4, label: 'USD/GBP' },
    { id: 'fx-jpy', base: 149.94, spread: 0.12,   decimals: 2, label: 'USD/JPY' },
    { id: 'fx-chf', base: 0.8806, spread: 0.0007, decimals: 4, label: 'USD/CHF' },
  ];

  const UPDATE_MS = 3000;
  const MAX_DRIFT = 0.0005;
  const API_URL = '/api/rates';
  let intervalId = null;
  let currentRates = {};
  let useApi = true;

  function jitter(base, spread, decimals) {
    const change = base * MAX_DRIFT * (Math.random() * 2 - 1);
    const clamped = Math.max(base - spread, Math.min(base + spread, base + change));
    return Number(clamped.toFixed(decimals));
  }

  function renderPair(pairId, value, decimals) {
    const el = document.getElementById(pairId);
    if (!el) return;
    const oldVal = currentRates[pairId];
    currentRates[pairId] = value;

    const direction = oldVal !== undefined
      ? (value > oldVal ? 'up' : value < oldVal ? 'down' : '')
      : '';
    const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '';
    const color = direction === 'up' ? 'text-uzu-emerald' : direction === 'down' ? 'text-red-400' : '';

    el.textContent = value.toFixed(decimals);
    el.className = `text-sm font-bold text-white mt-0.5 ${color}`;

    const deltaEl = el.parentElement?.querySelector('.fx-delta');
    if (deltaEl) {
      const diff = Math.abs(value - (PAIRS.find(p => p.id === pairId)?.base ?? value)).toFixed(decimals);
      deltaEl.textContent = `${arrow} ${diff}`;
      deltaEl.className = `fx-delta text-[9px] mt-0.5 ${color}`;
    }
  }

  async function fetchFromApi() {
    try {
      const res = await fetch(API_URL, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data && typeof data === 'object') {
        PAIRS.forEach(p => {
          const key = p.label.replace('/', '_');
          if (data[key] != null) {
            renderPair(p.id, Number(data[key]), p.decimals);
          }
        });
        return true;
      }
    } catch (err) {
      console.warn('[FX] API unavailable, using simulated rates:', err.message);
    }
    return false;
  }

  function tick() {
    if (useApi) {
      fetchFromApi().then(ok => {
        if (!ok) {
          useApi = false;
          PAIRS.forEach(p => { currentRates[p.id] = p.base; });
        }
      });
    } else {
      PAIRS.forEach(p => {
        const oldVal = currentRates[p.id] ?? p.base;
        const newVal = jitter(oldVal, p.spread, p.decimals);
        renderPair(p.id, newVal, p.decimals);
      });
    }
  }

  function init() {
    destroy();
    PAIRS.forEach(p => { currentRates[p.id] = p.base; });
    useApi = true;
    fetchFromApi().then(ok => {
      if (!ok) {
        useApi = false;
        PAIRS.forEach(p => renderPair(p.id, p.base, p.decimals));
      }
    });
    intervalId = setInterval(tick, UPDATE_MS);
  }

  function destroy() {
    if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
  }

  return { init, destroy };
})();