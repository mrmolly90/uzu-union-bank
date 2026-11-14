/* ==========================================================================
   UZU UNION BANK — User Repository
   Data access layer for user persistence. Abstracts storage mechanism.
   Currently uses JSON file; swap to database without changing callers.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const config = require('../config');

const USERS_FILE = path.join(config.paths.data, 'users.json');

class UserRepository {
  constructor() {
    this.filePath = USERS_FILE;
  }

  /* Read all users from storage */
  findAll() {
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('[UserRepo] Read error:', err.message);
      return [];
    }
  }

  /* Find user by email (case-insensitive) */
  findByEmail(email) {
    if (!email) return null;
    const users = this.findAll();
    return users.find(u => u.email === email.toLowerCase()) || null;
  }

  /* Find user by ID */
  findById(id) {
    if (!id) return null;
    const users = this.findAll();
    return users.find(u => u.id === id) || null;
  }

  /* Create a new user */
  create(userData) {
    const users = this.findAll();
    const newUser = {
      id: `usr_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`,
      ...userData,
      email: userData.email.toLowerCase(),
      createdAt: new Date().toISOString(),
      kycStatus: 'pending',
      role: 'user',
    };
    users.push(newUser);
    this._persist(users);
    return newUser;
  }

  /* Persist users array to storage */
  _persist(users) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(users, null, 2), 'utf-8');
    } catch (err) {
      console.error('[UserRepo] Write error:', err.message);
    }
  }
}

// Singleton
module.exports = new UserRepository();