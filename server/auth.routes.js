/* ==========================================================================
   UZU UNION BANK — Auth Routes
   POST /api/auth/login  — Authenticate user, return JWT
   POST /api/auth/register — Create new user, return JWT
   GET  /api/auth/me    — Validate token, return user profile
   ========================================================================== */

const express      = require('express');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const rateLimit    = require('express-rate-limit');
const fs           = require('fs');
const path         = require('path');

const router = express.Router();

/* --------------------------------------------------------------------
   Configuration
   -------------------------------------------------------------------- */
const JWT_SECRET  = process.env.JWT_SECRET || 'uzu-union-bank-dev-secret-key-change-in-production';
const JWT_EXPIRY  = process.env.JWT_EXPIRY || '2h';
const USERS_FILE  = path.join(__dirname, 'users.json');

/* --------------------------------------------------------------------
   Rate limiting: 5 attempts per 15 min on auth endpoints
   -------------------------------------------------------------------- */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
});
router.use(authLimiter);

/* --------------------------------------------------------------------
   Helper: read users from JSON file
   -------------------------------------------------------------------- */
function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    var data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('[Auth] Error reading users file:', err.message);
    return [];
  }
}

/* --------------------------------------------------------------------
   Helper: write users to JSON file
   -------------------------------------------------------------------- */
function writeUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Auth] Error writing users file:', err.message);
  }
}

/* --------------------------------------------------------------------
   POST /api/auth/register
   -------------------------------------------------------------------- */
router.post('/register', function (req, res) {
  try {
    var { email, password, bankPin, fullName, country } = req.body;

    // Validate required fields
    if (!email || !password || !bankPin || !fullName || !country) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    // Validate password strength
    if (password.length < 5) {
      return res.status(400).json({ error: 'Password must be at least 5 characters.' });
    }

    // Validate bank PIN (4 digits)
    if (!/^\d{4}$/.test(bankPin)) {
      return res.status(400).json({ error: 'Bank PIN must be exactly 4 digits.' });
    }

    // Check if user already exists
    var users = readUsers();
    var existing = users.find(function (u) { return u.email === email.toLowerCase(); });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password and PIN (bcrypt with 12 rounds)
    var salt = bcrypt.genSaltSync(12);
    var hash = bcrypt.hashSync(password, salt);
    var pinHash = bcrypt.hashSync(bankPin, salt);

    // Create user
    var newUser = {
      id: 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
      email: email.toLowerCase(),
      passwordHash: hash,
      bankPinHash: pinHash,
      fullName: fullName,
      country: country,
      createdAt: new Date().toISOString(),
      kycStatus: 'pending',
      role: 'user',
    };

    users.push(newUser);
    writeUsers(users);

    // Generate JWT
    var token = jwt.sign(
      { sub: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.status(201).json({
      message: 'Account created successfully.',
      token: token,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        country: newUser.country,
        kycStatus: newUser.kycStatus,
      },
    });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/* --------------------------------------------------------------------
   POST /api/auth/login
   -------------------------------------------------------------------- */
router.post('/login', function (req, res) {
  try {
    var { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    var users = readUsers();
    var user = users.find(function (u) { return u.email === email.toLowerCase(); });

    // Generic error to prevent user enumeration
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Generate JWT
    var token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({
      message: 'Authentication successful.',
      token: token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        country: user.country,
        kycStatus: user.kycStatus,
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/* --------------------------------------------------------------------
   POST /api/auth/pin — Verify bank PIN and return JWT
   -------------------------------------------------------------------- */
router.post('/pin', function (req, res) {
  try {
    var { email, bankPin } = req.body;

    if (!email || !bankPin) {
      return res.status(400).json({ error: 'Email and bank PIN are required.' });
    }

    if (!/^\d{4}$/.test(bankPin)) {
      return res.status(400).json({ error: 'Bank PIN must be exactly 4 digits.' });
    }

    var users = readUsers();
    var user = users.find(function (u) { return u.email === email.toLowerCase(); });

    if (!user || !user.bankPinHash || !bcrypt.compareSync(bankPin, user.bankPinHash)) {
      return res.status(401).json({ error: 'Invalid bank PIN.' });
    }

    // Generate JWT
    var token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({
      message: 'PIN verified successfully.',
      token: token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        country: user.country,
        kycStatus: user.kycStatus,
      },
    });
  } catch (err) {
    console.error('[Auth] PIN verify error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/* --------------------------------------------------------------------
   GET /api/auth/me — Validate token and return user profile
   -------------------------------------------------------------------- */
router.get('/me', function (req, res) {
  try {
    var authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided.' });
    }

    var token = authHeader.split(' ')[1];
    var decoded = jwt.verify(token, JWT_SECRET);

    var users = readUsers();
    var user = users.find(function (u) { return u.id === decoded.sub; });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        country: user.country,
        kycStatus: user.kycStatus,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
});

module.exports = router;