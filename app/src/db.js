'use strict';

const { Pool } = require('pg');

function createPool(dbConfig) {
  const pool = new Pool({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.name,
    user: dbConfig.user,
    password: dbConfig.password,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    process.stderr.write(`[pg] loi ket noi idle client: ${err.message}\n`);
  });

  return pool;
}

module.exports = { createPool };
