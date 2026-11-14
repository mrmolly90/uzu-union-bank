/* ==========================================================================
   UZU UNION BANK — Auth Service
   Business logic for authentication. Orchestrates validation, hashing,
   token generation, and repository calls.
   ========================================================================== */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const userRepo = require('../repositories/userRepository');
const authValidator = require('../validators/authValidator');

class AuthService {
  /* Register a new user */
  register(body) {
    // 1. Validate input
    const validation = authValidator.validateRegister(body);
    if (!validation.valid) {
      const err = new Error(validation.errors.map(e => e.message).join(' '));
      err.status = 400;
      err.expose = true;
      throw err;
    }

    const { email, password, bankPin, fullName, country } = validation.data;

    // 2. Check for existing user
    const existing = userRepo.findByEmail(email);
    if (existing) {
      const err = new Error('An account with this email already exists.');
      err.status = 409;
      err.expose = true;
      throw err;
    }

    // 3. Hash password and PIN
    const salt = bcrypt.genSaltSync(config.bcrypt.rounds);
    const passwordHash = bcrypt.hashSync(password, salt);
    const bankPinHash = bcrypt.hashSync(bankPin, salt);

    // 4. Persist user
    const newUser = userRepo.create({
      email,
      passwordHash,
      bankPinHash,
      fullName,
      country,
    });

    // 5. Generate JWT
    const token = this._generateToken(newUser);

    return {
      message: 'Account created successfully.',
      token,
      user: this._sanitizeUser(newUser),
    };
  }

  /* Authenticate a user */
  login(body) {
    // 1. Validate input
    const validation = authValidator.validateLogin(body);
    if (!validation.valid) {
      const err = new Error('Email and password are required.');
      err.status = 400;
      err.expose = true;
      throw err;
    }

    const { email, password } = validation.data;

    // 2. Find user
    const user = userRepo.findByEmail(email);

    // 3. Verify password (generic error to prevent enumeration)
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      const err = new Error('Invalid credentials.');
      err.status = 401;
      err.expose = true;
      throw err;
    }

    // 4. Generate JWT
    const token = this._generateToken(user);

    return {
      message: 'Authentication successful.',
      token,
      user: this._sanitizeUser(user),
    };
  }

  /* Verify bank PIN */
  verifyPin(body) {
    const { email, bankPin } = body || {};

    if (!email || !bankPin) {
      const err = new Error('Email and bank PIN are required.');
      err.status = 400;
      err.expose = true;
      throw err;
    }

    if (!/^\d{4}$/.test(bankPin)) {
      const err = new Error('Bank PIN must be exactly 4 digits.');
      err.status = 400;
      err.expose = true;
      throw err;
    }

    const user = userRepo.findByEmail(email);

    if (!user || !user.bankPinHash || !bcrypt.compareSync(bankPin, user.bankPinHash)) {
      const err = new Error('Invalid bank PIN.');
      err.status = 401;
      err.expose = true;
      throw err;
    }

    const token = this._generateToken(user);

    return {
      message: 'PIN verified successfully.',
      token,
      user: this._sanitizeUser(user),
    };
  }

  /* Get user profile from token */
  getProfile(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = userRepo.findById(decoded.sub);
      if (!user) {
        const err = new Error('User not found.');
        err.status = 404;
        err.expose = true;
        throw err;
      }
      return { user: this._sanitizeUser(user) };
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        const e = new Error('Token expired.');
        e.status = 401;
        e.expose = true;
        throw e;
      }
      if (err.status) throw err;
      const e = new Error('Invalid token.');
      e.status = 401;
      e.expose = true;
      throw e;
    }
  }

  /* Generate JWT for a user */
  _generateToken(user) {
    return jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiry, issuer: config.jwt.issuer }
    );
  }

  /* Strip sensitive fields before returning to client */
  _sanitizeUser(user) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      country: user.country,
      kycStatus: user.kycStatus,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}

module.exports = new AuthService();