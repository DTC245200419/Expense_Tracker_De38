'use strict';

const path = require('path');

function env(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (fallback === undefined) {
      throw new Error(`Thieu bien moi truong bat buoc: ${name}`);
    }
    return fallback;
  }
  return value;
}

const config = {
  port: Number(env('PORT', '3000')),
  nodeEnv: env('NODE_ENV', 'development'),
  database: {
    host: env('DB_HOST', 'postgres'),
    port: Number(env('DB_PORT', '5432')),
    name: env('DB_NAME', 'expense'),
    user: env('DB_USER', 'expense_app'),
    password: env('DB_PASSWORD', ''),
  },
  session: {
    secret: env('SESSION_SECRET', 'dev-only-secret-change-me'),
    cookieSecure: env('COOKIE_SECURE', 'false') === 'true',
    ttlSeconds: Number(env('SESSION_TTL_SECONDS', '3600')),
  },
  admin: {
    username: env('ADMIN_USERNAME', 'admin'),
    password: env('ADMIN_PASSWORD', ''),
    displayName: env('ADMIN_DISPLAY_NAME', 'Quan tri vien'),
  },
  logDir: env('LOG_DIR', path.join(__dirname, '..', 'logs')),
  loginRateLimit: {
    maxAttempts: Number(env('LOGIN_MAX_ATTEMPTS', '5')),
    windowMs: Number(env('LOGIN_WINDOW_SECONDS', '300')) * 1000,
  },
};

module.exports = config;
