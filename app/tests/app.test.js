'use strict';

// Kiem thu HTTP doc lap: dung repository gia (in-memory) va MemoryStore cho session.
// Chay: node --test tests/

const test = require('node:test');
const assert = require('node:assert/strict');
const session = require('express-session');

const { createApp } = require('../src/app');
const { hashPassword, verifyPassword } = require('../src/security');
const { validateTransaction, validateCategory } = require('../src/validation');

const ADMIN_PASSWORD = 'correct-horse-battery-staple';

function createFakeRepo() {
  const users = [
    { id: 1, username: 'admin', password_hash: hashPassword(ADMIN_PASSWORD), display_name: 'Admin' },
  ];
  const categories = [
    { id: 1, name: 'An uong', kind: 'expense', color: '#dc2626' },
    { id: 2, name: 'Luong', kind: 'income', color: '#059669' },
  ];
  let transactions = [];
  let nextId = 1;
  return {
    async healthCheck() { return true; },
    async findUserByUsername(u) { return users.find((x) => x.username === u) || null; },
    async findUserById(id) { return users.find((x) => x.id === id) || null; },
    async countUsers() { return users.length; },
    async createUser() { throw new Error('not used'); },
    async updatePassword(id, hash) { users.find((x) => x.id === id).password_hash = hash; },
    async listCategories() { return categories; },
    async getCategory(id) { return categories.find((c) => c.id === id) || null; },
    async createCategory(c) { const id = categories.length + 1; categories.push({ id, ...c }); return { id }; },
    async deleteCategory(id) {
      if (transactions.some((t) => t.category_id === id)) { const e = new Error('fk'); e.code = '23503'; throw e; }
      const i = categories.findIndex((c) => c.id === id); if (i < 0) return false; categories.splice(i, 1); return true;
    },
    async listTransactions() {
      return transactions.map((t) => ({ ...t, category_name: 'An uong', category_color: '#dc2626', created_by: 'Admin' }));
    },
    async countTransactions() { return transactions.length; },
    async getTransaction(id) { return transactions.find((t) => t.id === id) || null; },
    async createTransaction(t) { const id = nextId++; transactions.push({ id, category_id: t.categoryId, occurred_on: t.occurredOn, ...t }); return id; },
    async updateTransaction(id, t) { const x = transactions.find((y) => y.id === id); if (!x) return false; Object.assign(x, t); return true; },
    async deleteTransaction(id) { const n = transactions.length; transactions = transactions.filter((t) => t.id !== id); return transactions.length < n; },
    async recentTransactions() { return this.listTransactions(); },
    async monthlySummary() { return { income: 0, expense: 0, count: transactions.length }; },
    async summaryByCategory() { return []; },
    async monthlyTrend() { return []; },
  };
}

const silentLogger = { info() {}, warn() {}, error() {} };

const config = {
  session: { secret: 'test-secret', cookieSecure: false, ttlSeconds: 3600 },
  loginRateLimit: { maxAttempts: 3, windowMs: 60000 },
};

async function startServer() {
  const repo = createFakeRepo();
  const app = createApp({ repo, logger: silentLogger, config, sessionStore: new session.MemoryStore() });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, base, repo };
}

function cookieOf(res) {
  const raw = res.headers.get('set-cookie') || '';
  return raw.split(';')[0];
}

async function getCsrf(base, cookie) {
  const res = await fetch(`${base}/login`, { headers: cookie ? { cookie } : {}, redirect: 'manual' });
  const html = await res.text();
  const m = html.match(/name="_csrf" value="([a-f0-9]+)"/);
  return { token: m && m[1], cookie: cookie || cookieOf(res) };
}

async function login(base) {
  const { token, cookie } = await getCsrf(base);
  const res = await fetch(`${base}/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ _csrf: token, username: 'admin', password: ADMIN_PASSWORD }),
  });
  assert.equal(res.status, 302);
  const newCookie = cookieOf(res);
  const page = await fetch(`${base}/transactions`, { headers: { cookie: newCookie } });
  const html = await page.text();
  const m = html.match(/name="_csrf" value="([a-f0-9]+)"/);
  return { cookie: newCookie, token: m[1], setCookie: res.headers.get('set-cookie') };
}

test('scrypt hash va verify', () => {
  const h = hashPassword('abc12345');
  assert.ok(h.startsWith('scrypt$'));
  assert.equal(verifyPassword('abc12345', h), true);
  assert.equal(verifyPassword('wrong', h), false);
  assert.equal(verifyPassword('abc12345', 'garbage'), false);
});

test('validate giao dich: tu choi so am, ngay sai, danh muc sai', () => {
  const bad = validateTransaction({ kind: 'expense', amount: '-5', occurred_on: '2026-13-40', category_id: 'x' });
  assert.ok(bad.errors.length >= 3);
  const ok = validateTransaction({ kind: 'income', amount: '1,500,000', occurred_on: '2026-10-18', category_id: '2', note: 'Luong' });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.value.amount, 1500000);
});

test('validate danh muc', () => {
  assert.ok(validateCategory({ name: 'a', kind: 'x', color: 'red' }).errors.length === 3);
  assert.deepEqual(validateCategory({ name: 'Di lai', kind: 'expense', color: '#0891B2' }).errors, []);
});

test('health tra ve UP va CONNECTED', async () => {
  const { server, base } = await startServer();
  try {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'UP', database: 'CONNECTED' });
  } finally { server.close(); }
});

test('security headers co mat', async () => {
  const { server, base } = await startServer();
  try {
    const res = await fetch(`${base}/login`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(res.headers.get('x-powered-by'), null);
  } finally { server.close(); }
});

test('chua dang nhap bi chuyen huong ve /login', async () => {
  const { server, base } = await startServer();
  try {
    for (const p of ['/', '/transactions', '/categories', '/reports']) {
      const res = await fetch(`${base}${p}`, { redirect: 'manual' });
      assert.equal(res.status, 302, p);
      assert.equal(res.headers.get('location'), '/login');
    }
  } finally { server.close(); }
});

test('POST thieu CSRF token bi tu choi 403', async () => {
  const { server, base } = await startServer();
  try {
    const { cookie } = await getCsrf(base);
    const res = await fetch(`${base}/login`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: 'admin', password: ADMIN_PASSWORD }),
    });
    assert.equal(res.status, 403);
  } finally { server.close(); }
});

test('dang nhap sai -> 401, dang nhap dung -> 302 va cookie HttpOnly SameSite', async () => {
  const { server, base } = await startServer();
  try {
    const { token, cookie } = await getCsrf(base);
    const bad = await fetch(`${base}/login`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf: token, username: 'admin', password: 'sai-mat-khau' }),
    });
    assert.equal(bad.status, 401);
    const good = await login(base);
    assert.match(good.setCookie, /HttpOnly/);
    assert.match(good.setCookie, /SameSite=Lax/);
  } finally { server.close(); }
});

test('rate limit sau nhieu lan dang nhap sai', async () => {
  const { server, base } = await startServer();
  try {
    const { token, cookie } = await getCsrf(base);
    let last;
    for (let i = 0; i < 4; i += 1) {
      last = await fetch(`${base}/login`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ _csrf: token, username: 'admin', password: 'x' }),
      });
    }
    assert.equal(last.status, 429);
  } finally { server.close(); }
});

test('CRUD giao dich va escape XSS trong ghi chu', async () => {
  const { server, base, repo } = await startServer();
  try {
    const { cookie, token } = await login(base);
    const form = (extra) => ({
      method: 'POST',
      redirect: 'manual',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf: token, ...extra }),
    });
    const created = await fetch(`${base}/transactions`, form({
      kind: 'expense', amount: '25000', occurred_on: '2026-10-18', category_id: '1', note: '<script>alert(1)</script>',
    }));
    assert.equal(created.status, 302);
    assert.equal(await repo.countTransactions({}), 1);

    const list = await fetch(`${base}/transactions`, { headers: { cookie } });
    const html = await list.text();
    assert.ok(html.includes('&lt;script&gt;'), 'ghi chu phai duoc escape');
    assert.ok(!html.includes('<script>alert'), 'khong duoc render script tho');

    const updated = await fetch(`${base}/transactions/1`, form({
      kind: 'expense', amount: '30000', occurred_on: '2026-10-19', category_id: '1', note: 'sua',
    }));
    assert.equal(updated.status, 302);
    assert.equal((await repo.getTransaction(1)).amount, 30000);

    const invalid = await fetch(`${base}/transactions/1`, form({
      kind: 'expense', amount: '-1', occurred_on: '2026-10-19', category_id: '1',
    }));
    assert.equal(invalid.status, 400);

    const deleted = await fetch(`${base}/transactions/1/delete`, form({}));
    assert.equal(deleted.status, 302);
    assert.equal(await repo.countTransactions({}), 0);
  } finally { server.close(); }
});

test('trang khong ton tai tra 404', async () => {
  const { server, base } = await startServer();
  try {
    const res = await fetch(`${base}/not-found-demo`);
    assert.equal(res.status, 404);
  } finally { server.close(); }
});

test('logout huy session', async () => {
  const { server, base } = await startServer();
  try {
    const { cookie, token } = await login(base);
    const out = await fetch(`${base}/logout`, {
      method: 'POST', redirect: 'manual',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf: token }),
    });
    assert.equal(out.status, 302);
    const after = await fetch(`${base}/`, { headers: { cookie }, redirect: 'manual' });
    assert.equal(after.status, 302);
  } finally { server.close(); }
});
