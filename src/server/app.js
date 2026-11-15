/* ==========================================================================
   UZU UNION BANK — Express Application
   Assembles middleware, routes, and static serving into a configured app.
   No server.listen() here — that belongs in index.js.
   ========================================================================== */

const express = require('express');
const path = require('path');
const config = require('./config');
const {
  setupHelmet,
  setupCors,
  setupGlobalRateLimit,
  setupBodyParser,
  setupErrorHandler,
} = require('./middleware/security');
const authRoutes = require('./routes/auth');

function createApp() {
  const app = express();

  // --- Security layer ---
  setupHelmet(app);
  setupCors(app);
  setupBodyParser(app);
  setupGlobalRateLimit(app);

  // --- API routes ---
  app.use('/api/auth', authRoutes);

  // --- FX Rates endpoint ---
  let fxRates = {
    USD_EUR: 0.9222, USD_GBP: 0.7920, USD_JPY: 149.94, USD_CHF: 0.8806,
    EUR_USD: 1.0843, GBP_USD: 1.2626, JPY_USD: 0.00667, CHF_USD: 1.1356,
  };
  let fxLastFetch = Date.now();
  app.get('/api/rates', (req, res) => {
    const now = Date.now();
    if (now - fxLastFetch > 10000) {
      fxLastFetch = now;
      Object.keys(fxRates).forEach((k) => {
        fxRates[k] = Number((fxRates[k] + (Math.random() - 0.5) * 0.002).toFixed(4));
      });
    }
    res.json(fxRates);
  });

  // --- Health check ---
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'operational',
      service: 'Uzu Union Bank API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? process.uptime() : process.resources?.cpu?.usage?.toFixed(2) || 'N/A',
    });
  });

  // --- Static file serving ---
  const clientDir = path.resolve(__dirname, '..', 'client');
  app.use('/assets', express.static(path.join(clientDir, 'scripts'), { maxAge: '1h', etag: true }));
  app.use('/assets/css', express.static(path.join(clientDir, 'styles'), { maxAge: '1h', etag: true }));
  app.use(express.static(path.join(clientDir, 'pages'), { maxAge: '1h', etag: true, extensions: ['html'] }));

  // --- SPA fallback ---
  app.get('*', (req, res) => {
    const requestPath = req.path || req.url.split('?')[0];
    const filePath = path.join(clientDir, 'pages', requestPath === '/' ? 'index.html' : requestPath);
    res.sendFile(filePath, (err) => {
      if (err) res.sendFile(path.join(clientDir, 'pages', 'index.html'));
    });
  });

  // --- Error handler (must be last) ---
  setupErrorHandler(app);

  return app;
}

module.exports = createApp;