/* ==========================================================================
   UZU UNION BANK — Auth Validator
   Input validation and sanitization for authentication endpoints.
   ========================================================================== */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class AuthValidator {
  /* Validate registration payload */
  validateRegister(body) {
    const errors = [];
    const { email, password, bankPin, fullName, country } = body || {};

    if (!email || typeof email !== 'string') {
      errors.push({ field: 'email', message: 'Email is required.' });
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.push({ field: 'email', message: 'Invalid email format.' });
    }

    if (!password || typeof password !== 'string') {
      errors.push({ field: 'password', message: 'Password is required.' });
    } else if (password.length < 5) {
      errors.push({ field: 'password', message: 'Password must be at least 5 characters.' });
    }

    if (!bankPin || typeof bankPin !== 'string' || !/^\d{4}$/.test(bankPin)) {
      errors.push({ field: 'bankPin', message: 'Bank PIN must be exactly 4 digits.' });
    }

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      errors.push({ field: 'fullName', message: 'Full name is required.' });
    }

    if (!country || typeof country !== 'string' || !country.trim()) {
      errors.push({ field: 'country', message: 'Country is required.' });
    }

    return {
      valid: errors.length === 0,
      errors,
      data: errors.length === 0 ? {
        email: email.trim().toLowerCase(),
        password,
        bankPin,
        fullName: fullName.trim(),
        country: country.trim(),
      } : null,
    };
  }

  /* Validate login payload */
  validateLogin(body) {
    const errors = [];
    const { email, password } = body || {};

    if (!email || typeof email !== 'string') {
      errors.push({ field: 'email', message: 'Email is required.' });
    }

    if (!password || typeof password !== 'string') {
      errors.push({ field: 'password', message: 'Password is required.' });
    }

    return {
      valid: errors.length === 0,
      errors,
      data: errors.length === 0 ? {
        email: email.trim().toLowerCase(),
        password,
      } : null,
    };
  }
}

module.exports = new AuthValidator();