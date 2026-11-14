/* ==========================================================================
   UZU UNION BANK — FX Rates Ticker Simulator
   Simulates live foreign exchange rate updates with realistic spread
   movements. No real market data — architected as if connected to a
   real FX pricing feed.
   ========================================================================== */

var FxRates = (function () {
  'use strict';

  /* --------------------------------------------------------------------
     Configuration
     -------------------------------------------------------------------- */
  var PAIRS = [
    { id: 'rate-usd-eur', base: 0.9222, spread: 0.0008, decimals: 4 },
    { id: 'rate-usd-gbp', base: 0.7920, spread: 0.0006, decimals: 4 },
    { id: 'rate-usd-jpy', base: 149.94, spread: 0.12,   decimals: 2 },
    { id: 'rate-usd-chf', base: 0.8806, spread: 0.0007, decimals: 4 }
  ];

  var UPDATE_INTERVAL_MS = 3000; // update every 3 seconds
  var MAX_CHANGE_PCT     = 0.0005; // max ±0.05% per tick (drift)

  /* --------------------------------------------------------------------
     Internal state
     -------------------------------------------------------------------- */
  var currentRates = {};
  var intervalId   = null;

  /* --------------------------------------------------------------------
     Generate a realistic random rate movement
     -------------------------------------------------------------------- */
  function jitter(base, spread, decimals) {
    var change = base * MAX_CHANGE_PCT * (Math.random() * 2 - 1);
    var raw    = base + change;
    // Keep within spread bounds
    var min    = base - spread;
    var max    = base + spread;
    var clamped = Math.max(min, Math.min(max, raw));
    return Number(clamped.toFixed(decimals));
  }

  /* --------------------------------------------------------------------
     Update a single rate element in the DOM
     -------------------------------------------------------------------- */
  function updateRateElement(pair) {
    var el = document.getElementById(pair.id);
    if (!el) return;

    var oldVal = currentRates[pair.id];
    var newVal = jitter(pair.base, pair.spread, pair.decimals);
    currentRates[pair.id] = newVal;

    // Determine direction for visual styling
    var directionClass = '';
    if (oldVal !== undefined) {
      if (newVal > oldVal) {
        directionClass = 'fx-ticker__rate--up';
      } else if (newVal < oldVal) {
        directionClass = 'fx-ticker__rate--down';
      }
    }

    el.textContent = newVal.toFixed(pair.decimals);
    el.className   = 'fx-ticker__rate ' + directionClass;
  }

  /* --------------------------------------------------------------------
     Tick — update all pairs
     -------------------------------------------------------------------- */
  function tick() {
    try {
      PAIRS.forEach(function (pair) {
        updateRateElement(pair);
      });
    } catch (err) {
      console.error('[FxRates] tick error:', err);
    }
  }

  /* --------------------------------------------------------------------
     Public API
     -------------------------------------------------------------------- */

  /**
   * Initialise the FX rate ticker. Starts updating rates on an interval.
   * Safe to call multiple times — will clear any existing interval first.
   */
  function init() {
    try {
      // Clear any existing interval
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }

      // Set initial rates
      PAIRS.forEach(function (pair) {
        currentRates[pair.id] = pair.base;
        var el = document.getElementById(pair.id);
        if (el) {
          el.textContent = pair.base.toFixed(pair.decimals);
          el.className   = 'fx-ticker__rate';
        }
      });

      // Start ticker
      intervalId = setInterval(tick, UPDATE_INTERVAL_MS);
    } catch (err) {
      console.error('[FxRates] init error:', err);
    }
  }

  /**
   * Stop the ticker and clean up.
   */
  function destroy() {
    try {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    } catch (err) {
      console.error('[FxRates] destroy error:', err);
    }
  }

  /* --------------------------------------------------------------------
     Export
     -------------------------------------------------------------------- */
  return {
    init: init,
    destroy: destroy
  };
})();