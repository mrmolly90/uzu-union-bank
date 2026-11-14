/* ==========================================================================
   UZU UNION BANK — Client-Side Router Stub
   Manages SPA-style navigation between pages (Phase 1: index only).
   Phase 2 will add dashboard.html, Phase 3 will add transfer.html.
   ========================================================================== */

var AppRouter = (function () {
  'use strict';

  /* --------------------------------------------------------------------
     Configuration
     -------------------------------------------------------------------- */
  var ROUTES = {
    '/': {
      title: 'Uzu Union Bank — Global Wire Transfers',
      file:  '/public/index.html'
    }
    // Phase 2:
    // '/dashboard': { title: 'Dashboard — Uzu Union Bank', file: '/public/dashboard.html' },
    // Phase 3:
    // '/transfer':  { title: 'Wire Transfer — Uzu Union Bank', file: '/public/transfer.html' }
  };

  /* --------------------------------------------------------------------
     State
     -------------------------------------------------------------------- */
  var currentRoute = '/';

  /* --------------------------------------------------------------------
     Navigate to a route
     -------------------------------------------------------------------- */
  function navigate(path) {
    try {
      var route = ROUTES[path];
      if (!route) {
        console.warn('[Router] Unknown route:', path);
        path = '/';
        route = ROUTES[path];
      }

      currentRoute = path;
      document.title = route.title;

      // Update browser history
      if (window.history && window.history.pushState) {
        window.history.pushState({ route: path }, route.title, path);
      }

      // Dispatch a custom event for other modules to react
      var event = new CustomEvent('route-change', {
        detail: { path: path, route: route }
      });
      document.dispatchEvent(event);

    } catch (err) {
      console.error('[Router] navigate error:', err);
    }
  }

  /* --------------------------------------------------------------------
     Handle browser back/forward
     -------------------------------------------------------------------- */
  function handlePopState(e) {
    try {
      var state = e.state;
      if (state && state.route) {
        currentRoute = state.route;
        var route = ROUTES[currentRoute];
        if (route) {
          document.title = route.title;
        }
      }
    } catch (err) {
      console.error('[Router] popstate error:', err);
    }
  }

  /* --------------------------------------------------------------------
     Initialise router
     -------------------------------------------------------------------- */
  function init() {
    try {
      window.addEventListener('popstate', handlePopState);

      // Set initial route based on current path
      var path = window.location.pathname;
      if (ROUTES[path]) {
        currentRoute = path;
        var route = ROUTES[path];
        document.title = route.title;
      }
    } catch (err) {
      console.error('[Router] init error:', err);
    }
  }

  /* --------------------------------------------------------------------
     Export
     -------------------------------------------------------------------- */
  return {
    init: init,
    navigate: navigate,
    getCurrentRoute: function () { return currentRoute; }
  };
})();

// Auto-initialise on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    AppRouter.init();
  });
} else {
  AppRouter.init();
}