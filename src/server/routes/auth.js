/* ==========================================================================
   UZU UNION BANK — Auth Routes
   Thin route handlers that delegate to AuthService.
   No business logic here — just HTTP concerns.
   ========================================================================== */

const { Router } = require('express');
const { createAuthRateLimiter } = require('../middleware/security');
const authService = require('../services/authService');

const router = Router();

// Apply auth-specific rate limiting
router.use(createAuthRateLimiter());

/* POST /api/auth/register */
router.post('/register', (req, res) => {
  try {
    const result = authService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.expose ? err.message : 'Internal server error.' });
  }
});

/* POST /api/auth/login */
router.post('/login', (req, res) => {
  try {
    const result = authService.login(req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.expose ? err.message : 'Internal server error.' });
  }
});

/* POST /api/auth/pin */
router.post('/pin', (req, res) => {
  try {
    const result = authService.verifyPin(req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.expose ? err.message : 'Internal server error.' });
  }
});

/* GET /api/auth/me */
router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided.' });
    }
    const token = authHeader.split(' ')[1];
    const result = authService.getProfile(token);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.expose ? err.message : 'Internal server error.' });
  }
});

module.exports = router;