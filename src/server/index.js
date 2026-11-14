/* ==========================================================================
   UZU UNION BANK — Server Entry Point
   Starts the HTTP server with graceful shutdown.
   ========================================================================== */

const createApp = require('./app');
const config = require('./config');

const app = createApp();
const server = app.listen(config.port, () => {
  console.log('═══════════════════════════════════════════');
  console.log('  UZU UNION BANK — Production Server');
  console.log(`  http://localhost:${config.port}`);
  console.log(`  Environment: ${config.env}`);
  console.log('═══════════════════════════════════════════');
});

/* --- Graceful shutdown --- */
function shutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully…`);
  server.close(() => {
    console.log('[Server] All connections closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;