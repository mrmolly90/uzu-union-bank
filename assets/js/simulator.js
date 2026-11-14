/* ==========================================================================
   UZU UNION BANK — Wire Route Simulator
   Real-time animated wire path with blockchain-style per-hop confirmations.
   Cycles through: New York (confirmed) → London (active) → Lagos (pending)
   → Tokyo (pending) with traveling pulse dots and hop status updates.
   ========================================================================== */

var WireSimulator = (function () {
  'use strict';

  /* --------------------------------------------------------------------
     Configuration
     -------------------------------------------------------------------- */
  var HOPS = [
    { id: 'NY',   label: 'New York',  statusEl: 'hopNY',   dotEl: null,   pathEl: null,     checkEl: null },
    { id: 'LON',  label: 'London',    statusEl: 'hopLondon',dotEl: 'dotLondon', pathEl: 'pathLondonLagos', checkEl: null },
    { id: 'LAG',  label: 'Lagos',     statusEl: 'hopLagos', dotEl: 'dotLagos',   pathEl: 'pathLagosTokyo',  checkEl: null },
    { id: 'TYO',  label: 'Tokyo',     statusEl: 'hopTokyo', dotEl: 'dotTokyo',   pathEl: null,              checkEl: null }
  ];

  var CYCLE_INTERVAL_MS = 6000; // time per hop cycle
  var CONFIRM_DELAY_MS  = 2000; // time to show "confirmed" before advancing

  /* --------------------------------------------------------------------
     State
     -------------------------------------------------------------------- */
  var currentHop   = 1; // 0 = NY (already confirmed), 1 = London, 2 = Lagos, 3 = Tokyo
  var intervalId   = null;
  var isAnimating  = false;

  /* --------------------------------------------------------------------
     Reset all hops to idle
     -------------------------------------------------------------------- */
  function resetAllHops() {
    HOPS.forEach(function (hop, index) {
      var statusEl = document.getElementById(hop.statusEl);
      if (!statusEl) return;

      // Remove all status classes
      statusEl.classList.remove(
        'hop-status__item--active',
        'hop-status__item--confirmed',
        'hop-status__item--pending'
      );

      // Reset dot appearance
      var dotEl = hop.dotEl ? document.getElementById(hop.dotEl) : null;
      if (dotEl) {
        dotEl.classList.remove(
          'wire-map__dot--active',
          'wire-map__dot--confirmed',
          'wire-map__dot--pending'
        );
        dotEl.setAttribute('r', '3');
      }

      // Reset path
      var pathEl = hop.pathEl ? document.getElementById(hop.pathEl) : null;
      if (pathEl) {
        pathEl.classList.remove(
          'wire-map__path--active',
          'wire-map__path--confirmed',
          'wire-map__path--pending'
        );
      }

      // Set hop 0 (NY) as confirmed
      if (index === 0) {
        statusEl.classList.add('hop-status__item--confirmed');
        if (dotEl) dotEl.classList.add('wire-map__dot--confirmed');
        if (pathEl) pathEl.classList.add('wire-map__path--confirmed');
      }
    });
  }

  /* --------------------------------------------------------------------
     Set a hop to a specific status
     -------------------------------------------------------------------- */
  function setHopStatus(hopIndex, status) {
    var hop = HOPS[hopIndex];
    if (!hop) return;

    var statusEl = document.getElementById(hop.statusEl);
    if (!statusEl) return;

    // Clear previous status
    statusEl.classList.remove(
      'hop-status__item--active',
      'hop-status__item--confirmed',
      'hop-status__item--pending'
    );

    var dotEl = hop.dotEl ? document.getElementById(hop.dotEl) : null;
    if (dotEl) {
      dotEl.classList.remove(
        'wire-map__dot--active',
        'wire-map__dot--confirmed',
        'wire-map__dot--pending'
      );
    }

    var pathEl = hop.pathEl ? document.getElementById(hop.pathEl) : null;
    if (pathEl) {
      pathEl.classList.remove(
        'wire-map__path--active',
        'wire-map__path--confirmed',
        'wire-map__path--pending'
      );
    }

    switch (status) {
      case 'active':
        statusEl.classList.add('hop-status__item--active');
        if (dotEl) dotEl.classList.add('wire-map__dot--active');
        if (pathEl) pathEl.classList.add('wire-map__path--active');
        // Update status icon to spinner
        statusEl.innerHTML = '<span class="spinner" style="width:8px;height:8px;border-width:1.5px;"></span> ' + hop.label;
        break;

      case 'confirmed':
        statusEl.classList.add('hop-status__item--confirmed');
        if (dotEl) dotEl.classList.add('wire-map__dot--confirmed');
        if (pathEl) pathEl.classList.add('wire-map__path--confirmed');
        statusEl.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> ' + hop.label;
        break;

      case 'pending':
      default:
        statusEl.classList.add('hop-status__item--pending');
        if (dotEl) dotEl.classList.add('wire-map__dot--pending');
        if (pathEl) pathEl.classList.add('wire-map__path--pending');
        statusEl.innerHTML = '<span class="pill-dot pill-dot--amber" style="width:6px;height:6px;"></span> ' + hop.label;
        break;
    }
  }

  /* --------------------------------------------------------------------
     Advance the wire one hop
     -------------------------------------------------------------------- */
  function advanceHop() {
    try {
      // Reset all hops
      resetAllHops();

      // Confirm all hops up to currentHop
      for (var i = 0; i <= currentHop; i++) {
        setHopStatus(i, 'confirmed');
      }

      // Set the next hop as active (if exists)
      if (currentHop + 1 < HOPS.length) {
        setHopStatus(currentHop + 1, 'active');
      }

      // Set remaining as pending
      for (var j = currentHop + 2; j < HOPS.length; j++) {
        setHopStatus(j, 'pending');
      }

      // Advance to next hop
      currentHop++;

      // If we've reached the end, reset to hop 1 (NY stays confirmed)
      if (currentHop >= HOPS.length) {
        // Show all confirmed momentarily
        setTimeout(function () {
          currentHop = 1;
          resetAllHops();
          setHopStatus(0, 'confirmed');
          setHopStatus(1, 'active');
          setHopStatus(2, 'pending');
          setHopStatus(3, 'pending');
        }, CONFIRM_DELAY_MS);
      }
    } catch (err) {
      console.error('[WireSimulator] advanceHop error:', err);
    }
  }

  /* --------------------------------------------------------------------
     Public API
     -------------------------------------------------------------------- */

  /**
   * Initialise the wire simulator. Starts cycling through wire hops.
   */
  function init() {
    try {
      // Clear existing interval
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }

      currentHop = 1;

      // Set initial state: NY confirmed, London active, rest pending
      resetAllHops();
      setHopStatus(0, 'confirmed');
      setHopStatus(1, 'active');
      setHopStatus(2, 'pending');
      setHopStatus(3, 'pending');

      // Start cycling
      intervalId = setInterval(advanceHop, CYCLE_INTERVAL_MS);
    } catch (err) {
      console.error('[WireSimulator] init error:', err);
    }
  }

  /**
   * Stop the simulator and clean up.
   */
  function destroy() {
    try {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    } catch (err) {
      console.error('[WireSimulator] destroy error:', err);
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