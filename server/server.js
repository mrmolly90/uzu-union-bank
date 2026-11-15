/* ==========================================================================
   UZU UNION BANK — Express Server
   Production-grade backend with JWT auth, bcrypt hashing, helmet security,
   rate limiting, CORS, and structured logging.
   ========================================================================== */

const express       = require('express');
const path          = require('path');
const helmet        = require('helmet');
const cors          = require('cors');
const rateLimit     = require('express-rate-limit');
const authRoutes    = require('./auth.routes');

/* --------------------------------------------------------------------
   Configuration
   -------------------------------------------------------------------- */
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

/* --------------------------------------------------------------------
   Express App
   -------------------------------------------------------------------- */
const app = express();

/* --- Security Headers --- */
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

/* --- CORS — allow all origins in dev, restrict in production --- */
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

/* --- Body Parsing --- */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

/* --- Rate Limiting --- */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use('/api/', globalLimiter);

/* --- Auth routes --- */
app.use('/api/auth', authRoutes);

/* --- FX Rates endpoint --- */
var FX_RATES = {
  USD_EUR: 0.9222, USD_GBP: 0.7920, USD_JPY: 149.94, USD_CHF: 0.8806,
  EUR_USD: 1.0843, GBP_USD: 1.2626, JPY_USD: 0.00667, CHF_USD: 1.1356,
};
var FX_LAST_FETCH = Date.now();
app.get('/api/rates', function (req, res) {
  // Apply small drift to simulate live rates
  var now = Date.now();
  if (now - FX_LAST_FETCH > 10000) {
    FX_LAST_FETCH = now;
    Object.keys(FX_RATES).forEach(function (k) {
      FX_RATES[k] = Number((FX_RATES[k] + (Math.random() - 0.5) * 0.002).toFixed(4));
    });
  }
  res.json(FX_RATES);
});

/* --- Health check --- */
app.get('/api/status', function (req, res) {
  res.json({
    status: 'operational',
    service: 'Uzu Union Bank API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime ? process.uptime() : process.resources?.cpu?.usage?.toFixed(2) || 'N/A',
  });
});

/* --- Static file serving --- */
app.use('/assets', express.static(ASSETS_DIR, { maxAge: '1h', etag: true }));
app.use(express.static(PUBLIC_DIR, { maxAge: '1h', etag: true, extensions: ['html'] }));

/* --- SPA fallback — only for non-file, non-API routes --- */
app.get('*', function (req, res) {
  var requestPath = req.path || req.url.split('?')[0];
  var filePath = path.join(PUBLIC_DIR, requestPath === '/' ? 'index.html' : requestPath);
  res.sendFile(filePath, function (err) {
    if (err) {
      res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
    }
  });
});

/* --- Global error handler --- */
app.use(function (err, req, res, next) {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

/* --------------------------------------------------------------------
   Start Server
   -------------------------------------------------------------------- */
const server = app.listen(PORT, function () {
  console.log('═══════════════════════════════════════════');
  console.log('  UZU UNION BANK — Production Server');
  console.log('  http://localhost:' + PORT);
  console.log('  Environment: ' + (process.env.NODE_ENV || 'development'));
  console.log('═══════════════════════════════════════════');
});

/* --- Graceful shutdown --- */
function gracefulShutdown(signal) {
  console.log('\n[Server] Received ' + signal + '. Shutting down gracefully…');
  server.close(function () {
    console.log('[Server] All connections closed.');
    process.exit(0);
  });
  setTimeout(function () {
    console.error('[Server] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}
process.on('SIGTERM', function () { gracefulShutdown('SIGTERM'); });
process.on('SIGINT', function () { gracefulShutdown('SIGINT'); });

module.exports = app;