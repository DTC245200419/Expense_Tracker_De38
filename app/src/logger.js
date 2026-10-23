'use strict';

// Logger JSON don gian: moi dong la mot JSON object, ghi ra file app.log va stdout.
// Khong ghi request body, mat khau, cookie hoac session id.
const fs = require('fs');
const path = require('path');

function createLogger(logDir) {
  let stream = null;
  try {
    fs.mkdirSync(logDir, { recursive: true });
    stream = fs.createWriteStream(path.join(logDir, 'app.log'), { flags: 'a' });
    stream.on('error', (err) => {
      process.stderr.write(`[logger] khong ghi duoc file log: ${err.message}\n`);
      stream = null;
    });
  } catch (err) {
    process.stderr.write(`[logger] khong tao duoc thu muc log: ${err.message}\n`);
  }

  function write(level, event, fields) {
    const entry = {
      time: new Date().toISOString(),
      level,
      service: 'expense-tracker',
      event,
      ...fields,
    };
    const line = JSON.stringify(entry);
    process.stdout.write(line + '\n');
    if (stream) stream.write(line + '\n');
  }

  return {
    info: (event, fields = {}) => write('info', event, fields),
    warn: (event, fields = {}) => write('warn', event, fields),
    error: (event, fields = {}) => write('error', event, fields),
  };
}

module.exports = { createLogger };
