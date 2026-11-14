/* ==========================================================================
   UZU UNION BANK — Centralized Configuration
   Single source of truth for all environment-dependent values.
   ========================================================================== */

const path = require('path');

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  paths: {
    public: path.resolve(__dirname, '..', '..', 'client', 'pages'),
    assets: path.resolve(__dirname, '..', '..', 'client'),
    server: path.resolve(__dirname, '..'),
    data: path.resolve(__dirname, '..', 'data'),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'uzu-dev-secret-change-in-production',
    expiry: process.env.JWT_EXPIRY || '2h',
    issuer: 'uzu-union-bank',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },

  rateLimit: {
    global: { windowMs: 15 * 60 * 1000, max: 100 },
    auth: { windowMs: 15 * 60 * 1000, max: 5 },
  },

  bcrypt: {
    rounds: 12,
  },

  bodyLimit: '1mb',
};

module.exports = config;