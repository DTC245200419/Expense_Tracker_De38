'use strict';

const crypto = require('crypto');

const SCRYPT_KEYLEN = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

// Bam mat khau bang scrypt voi salt ngau nhien 16 byte. Dinh dang: scrypt$salt$hash
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length, SCRYPT_OPTIONS);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

// CSRF token luu trong session (synchronizer token pattern)
function ensureCsrfToken(session) {
  if (!session.csrfToken) {
    session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  return session.csrfToken;
}

function csrfProtection(logger) {
  return function csrf(req, res, next) {
    const safe = ['GET', 'HEAD', 'OPTIONS'];
    if (safe.includes(req.method)) return next();
    const expected = req.session && req.session.csrfToken;
    const provided = (req.body && req.body._csrf) || req.get('x-csrf-token');
    if (
      expected &&
      typeof provided === 'string' &&
      provided.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
    ) {
      return next();
    }
    logger.warn('csrf_denied', { method: req.method, path: req.path, ip: req.ip });
    return res.status(403).render('error', {
      title: 'Tu choi yeu cau',
      status: 403,
      message: 'CSRF token khong hop le hoac thieu. Vui long tai lai trang va thu lai.',
    });
  };
}

// Gioi han dang nhap sai theo IP + username, luu trong bo nho cua mot instance.
function createLoginRateLimiter({ maxAttempts, windowMs }) {
  const attempts = new Map();

  function key(ip, username) {
    return `${ip}|${String(username || '').toLowerCase()}`;
  }

  function cleanup(now) {
    for (const [k, v] of attempts) {
      if (v.resetAt <= now) attempts.delete(k);
    }
  }

  return {
    isBlocked(ip, username) {
      const now = Date.now();
      cleanup(now);
      const entry = attempts.get(key(ip, username));
      return Boolean(entry && entry.count >= maxAttempts && entry.resetAt > now);
    },
    recordFailure(ip, username) {
      const now = Date.now();
      const k = key(ip, username);
      const entry = attempts.get(k);
      if (!entry || entry.resetAt <= now) {
        attempts.set(k, { count: 1, resetAt: now + windowMs });
      } else {
        entry.count += 1;
      }
    },
    reset(ip, username) {
      attempts.delete(key(ip, username));
    },
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  ensureCsrfToken,
  csrfProtection,
  createLoginRateLimiter,
};
