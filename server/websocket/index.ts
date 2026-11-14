/* ==========================================================================
   UZU UNION BANK — WebSocket Server
   Real-time FX rate broadcasting and transaction status updates.
   ========================================================================== */

import { createServer } from 'http';
import { Server } from 'socket.io';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// Simulated FX rates engine
const PAIRS = [
  { base: 'USD', quote: 'EUR', rate: 0.9222, bid: 0.9218, ask: 0.9226 },
  { base: 'USD', quote: 'GBP', rate: 0.7920, bid: 0.7916, ask: 0.7924 },
  { base: 'USD', quote: 'JPY', rate: 149.94, bid: 149.88, ask: 150.00 },
  { base: 'USD', quote: 'CHF', rate: 0.8806, bid: 0.8802, ask: 0.8810 },
  { base: 'EUR', quote: 'USD', rate: 1.0843, bid: 1.0839, ask: 1.0847 },
  { base: 'GBP', quote: 'USD', rate: 1.2626, bid: 1.2622, ask: 1.2630 },
];

function jitter(value: number, spread: number): number {
  const change = value * 0.0003 * (Math.random() * 2 - 1);
  return Number((value + change).toFixed(4));
}

function broadcastRates() {
  const rates = PAIRS.map((p) => ({
    ...p,
    rate: jitter(p.rate, 0.0005),
    bid: jitter(p.bid, 0.0005),
    ask: jitter(p.ask, 0.0005),
  }));
  io.emit('rates:update', rates);
}

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // Send initial rates
  socket.emit('rates:initial', PAIRS);

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// Broadcast rates every 1 second
setInterval(broadcastRates, 1000);

const PORT = parseInt(process.env.WS_PORT || '3001', 10);
httpServer.listen(PORT, () => {
  console.log(`[WS] Real-time server running on port ${PORT}`);
});