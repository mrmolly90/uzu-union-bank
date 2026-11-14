/* ==========================================================================
   UZU UNION BANK — Security Middleware
   Helmet, CORS, rate limiting, and request sanitization.
   ========================================================================== */

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('../config');

/* --- Helmet security headers --- */
function setupHelmet(app) {
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
}

/* --- CORS --- */
function setupCors(app) {
  app.use(cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
  }));
}

/* --- Global rate limiter --- */
function setupGlobalRateLimit(app) {
  const limiter = rateLimit({
    ...config.rateLimit.global,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
  });
  app.use('/api/', limiter);
}

/* --- Auth-specific rate limiter (returns middleware) --- */
function createAuthRateLimiter() {
  return rateLimit({
    ...config.rateLimit.auth,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
  });
}

/* --- Body parsing --- */
function setupBodyParser(app) {
  app.use(require('express').json({ limit: config.bodyLimit }));
  app.use(require('express').urlencoded({ extended: true, limit: config.bodyLimit }));
}

/* --- Global error handler --- */
function setupErrorHandler(app) {
  app.use((err, req, res, next) => {
    console.error(`[Error] ${err.message}`);
    res.status(err.status || 500).json({
      error: err.expose ? err.message : 'Internal server error',
      requestId: req.id,
    });
  });
}

module.exports = {
  setupHelmet,
  setupCors,
  setupGlobalRateLimit,
  createAuthRateLimiter,
  setupBodyParser,
  setupErrorHandler,
};