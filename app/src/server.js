'use strict';

const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);

const config = require('./config');
const { createPool } = require('./db');
const { createRepository } = require('./repository');
const { createLogger } = require('./logger');
const { createApp } = require('./app');
const { hashPassword } = require('./security');

const logger = createLogger(config.logDir);
const pool = createPool(config.database);
const repo = createRepository(pool);

async function waitForDatabase(retries = 20, delayMs = 3000) {
  for (let i = 1; i <= retries; i += 1) {
    try {
      await repo.healthCheck();
      logger.info('database_connected', { host: config.database.host, db: config.database.name });
      return;
    } catch (err) {
      logger.warn('database_unavailable', { attempt: i, error: err.message });
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Khong ket noi duoc PostgreSQL sau nhieu lan thu');
}

// Tao tai khoan quan tri tu bien moi truong neu bang users con trong.
async function ensureAdminUser() {
  const count = await repo.countUsers();
  if (count > 0) return;
  if (!config.admin.password || config.admin.password.length < 12) {
    throw new Error('ADMIN_PASSWORD phai co it nhat 12 ky tu de tao tai khoan quan tri');
  }
  await repo.createUser({
    username: config.admin.username,
    passwordHash: hashPassword(config.admin.password),
    displayName: config.admin.displayName,
  });
  logger.info('admin_user_created', { username: config.admin.username });
}

async function main() {
  await waitForDatabase();
  await ensureAdminUser();

  const sessionStore = new PgSession({
    pool,
    tableName: 'sessions',
    createTableIfMissing: false,
    pruneSessionInterval: 300, // don session het han moi 5 phut
  });

  const app = createApp({ repo, logger, config, sessionStore });
  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info('server_started', { port: config.port, env: config.nodeEnv });
  });

  const shutdown = (signal) => {
    logger.info('server_stopping', { signal });
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('startup_failed', { error: err.message });
  process.exit(1);
});
