'use strict';

const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const {
  hashPassword,
  verifyPassword,
  ensureCsrfToken,
  csrfProtection,
  createLoginRateLimiter,
} = require('./security');
const {
  validateTransaction,
  validateCategory,
  validateMonth,
  parseId,
  KINDS,
} = require('./validation');

const PAGE_SIZE = 20;

function formatMoney(value) {
  const n = Number(value) || 0;
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n)} ₫`;
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function kindLabel(kind) {
  return kind === 'income' ? 'Thu' : 'Chi';
}

function currentMonth() {
  return validateMonth('');
}

function createApp({ repo, logger, config, sessionStore }) {
  const app = express();
  const loginLimiter = createLoginRateLimiter(config.loginRateLimit);

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // ---------- Security headers ----------
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          // Chi ep nang cap HTTPS khi dang chay sau TLS; o HTTP localhost se lam hong tai CSS
          upgradeInsecureRequests: config.session.cookieSecure ? [] : null,
        },
      },
      frameguard: { action: 'deny' },
      hsts: config.session.cookieSecure ? { maxAge: 86400, includeSubDomains: true } : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginEmbedderPolicy: false,
    })
  );

  // ---------- Body, static ----------
  app.use(express.urlencoded({ extended: false, limit: '16kb' }));
  app.use('/static', express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));

  // ---------- Health (khong can session) ----------
  app.get('/health', async (req, res) => {
    try {
      const ok = await repo.healthCheck();
      res.json({ status: ok ? 'UP' : 'DOWN', database: ok ? 'CONNECTED' : 'ERROR' });
    } catch (err) {
      logger.error('health_check_failed', { error: err.message });
      res.status(503).json({ status: 'DOWN', database: 'DISCONNECTED' });
    }
  });

  // ---------- Session ----------
  app.use(
    session({
      name: 'expense.sid',
      secret: config.session.secret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.session.cookieSecure,
        maxAge: config.session.ttlSeconds * 1000,
      },
    })
  );

  // ---------- Request logging ----------
  app.use((req, res, next) => {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      logger.info('http_request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: Math.round(durationMs * 100) / 100,
        ip: req.ip,
        user: req.session && req.session.user ? req.session.user.username : null,
      });
    });
    next();
  });

  // ---------- Locals cho view ----------
  app.use((req, res, next) => {
    res.locals.csrfToken = ensureCsrfToken(req.session);
    res.locals.currentUser = req.session.user || null;
    res.locals.currentPath = req.path;
    res.locals.formatMoney = formatMoney;
    res.locals.formatDate = formatDate;
    res.locals.kindLabel = kindLabel;
    res.locals.flash = req.session.flash || null;
    delete req.session.flash;
    next();
  });

  app.use(csrfProtection(logger));

  function requireAuth(req, res, next) {
    if (req.session.user) return next();
    logger.warn('access_denied', { path: req.path, ip: req.ip });
    req.session.flash = { type: 'warn', text: 'Vui lòng đăng nhập để tiếp tục.' };
    return res.redirect('/login');
  }

  function setFlash(req, type, text) {
    req.session.flash = { type, text };
  }

  // ---------- Auth ----------
  app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('login', { title: 'Đăng nhập', error: null, username: '' });
  });

  app.post('/login', async (req, res, next) => {
    try {
      const username = String(req.body.username || '').trim().slice(0, 64);
      const password = String(req.body.password || '').slice(0, 256);

      if (loginLimiter.isBlocked(req.ip, username)) {
        logger.warn('login_rate_limited', { username, ip: req.ip });
        return res.status(429).render('login', {
          title: 'Đăng nhập',
          error: 'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau vài phút.',
          username,
        });
      }

      const user = username ? await repo.findUserByUsername(username) : null;
      const valid = user ? verifyPassword(password, user.password_hash) : false;

      if (!valid) {
        loginLimiter.recordFailure(req.ip, username);
        logger.warn('login_failed', { username, ip: req.ip });
        return res.status(401).render('login', {
          title: 'Đăng nhập',
          error: 'Tên đăng nhập hoặc mật khẩu không đúng.',
          username,
        });
      }

      loginLimiter.reset(req.ip, username);
      // Regenerate session de tranh session fixation
      req.session.regenerate((err) => {
        if (err) return next(err);
        req.session.user = { id: user.id, username: user.username, displayName: user.display_name };
        ensureCsrfToken(req.session);
        logger.info('login_success', { username: user.username, ip: req.ip });
        req.session.save((err2) => {
          if (err2) return next(err2);
          res.redirect('/');
        });
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/logout', (req, res, next) => {
    const username = req.session.user ? req.session.user.username : null;
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('expense.sid');
      logger.info('logout', { username, ip: req.ip });
      res.redirect('/login');
    });
  });

  // ---------- Dashboard ----------
  app.get('/', requireAuth, async (req, res, next) => {
    try {
      const month = currentMonth();
      const [summary, byCategory, recent, trend] = await Promise.all([
        repo.monthlySummary(month),
        repo.summaryByCategory(month),
        repo.recentTransactions(8),
        repo.monthlyTrend(6),
      ]);
      const topExpense = byCategory.filter((c) => c.kind === 'expense').slice(0, 5);
      res.render('dashboard', {
        title: 'Tổng quan',
        month,
        summary,
        topExpense,
        recent,
        trend: buildTrendChart(trend),
      });
    } catch (err) {
      next(err);
    }
  });

  // ---------- Transactions ----------
  app.get('/transactions', requireAuth, async (req, res, next) => {
    try {
      const month = req.query.month === 'all' ? null : validateMonth(req.query.month);
      const kind = KINDS.includes(req.query.kind) ? req.query.kind : null;
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const filter = { month, kind, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };
      const [items, total, categories] = await Promise.all([
        repo.listTransactions(filter),
        repo.countTransactions(filter),
        repo.listCategories(),
      ]);
      res.render('transactions', {
        title: 'Giao dịch',
        items,
        total,
        page,
        pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
        month: month || 'all',
        kind: kind || '',
        categories,
        form: { kind: 'expense', occurred_on: new Date().toISOString().slice(0, 10) },
        errors: [],
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/transactions', requireAuth, async (req, res, next) => {
    try {
      const { errors, value } = validateTransaction(req.body);
      if (errors.length) {
        setFlash(req, 'error', errors.join(' '));
        return res.redirect('/transactions');
      }
      const id = await repo.createTransaction({ userId: req.session.user.id, ...value });
      logger.info('transaction_created', {
        id,
        kind: value.kind,
        amount: value.amount,
        user: req.session.user.username,
      });
      setFlash(req, 'ok', 'Đã thêm giao dịch.');
      res.redirect('/transactions');
    } catch (err) {
      next(err);
    }
  });

  app.get('/transactions/:id/edit', requireAuth, async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const item = id ? await repo.getTransaction(id) : null;
      if (!item) return notFound(req, res);
      const categories = await repo.listCategories();
      res.render('transaction_edit', { title: 'Sửa giao dịch', item, categories, errors: [] });
    } catch (err) {
      next(err);
    }
  });

  app.post('/transactions/:id', requireAuth, async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return notFound(req, res);
      const { errors, value } = validateTransaction(req.body);
      if (errors.length) {
        const categories = await repo.listCategories();
        return res.status(400).render('transaction_edit', {
          title: 'Sửa giao dịch',
          item: { id, ...req.body },
          categories,
          errors,
        });
      }
      const ok = await repo.updateTransaction(id, value);
      if (!ok) return notFound(req, res);
      logger.info('transaction_updated', { id, user: req.session.user.username });
      setFlash(req, 'ok', 'Đã cập nhật giao dịch.');
      res.redirect('/transactions');
    } catch (err) {
      next(err);
    }
  });

  app.post('/transactions/:id/delete', requireAuth, async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const ok = id ? await repo.deleteTransaction(id) : false;
      if (!ok) return notFound(req, res);
      logger.info('transaction_deleted', { id, user: req.session.user.username });
      setFlash(req, 'ok', 'Đã xóa giao dịch.');
      res.redirect('/transactions');
    } catch (err) {
      next(err);
    }
  });

  // ---------- Categories ----------
  app.get('/categories', requireAuth, async (req, res, next) => {
    try {
      const categories = await repo.listCategories();
      res.render('categories', { title: 'Danh mục', categories });
    } catch (err) {
      next(err);
    }
  });

  app.post('/categories', requireAuth, async (req, res, next) => {
    try {
      const { errors, value } = validateCategory(req.body);
      if (errors.length) {
        setFlash(req, 'error', errors.join(' '));
        return res.redirect('/categories');
      }
      const created = await repo.createCategory(value);
      if (!created) {
        setFlash(req, 'warn', 'Danh mục này đã tồn tại.');
      } else {
        logger.info('category_created', { id: created.id, name: value.name, kind: value.kind });
        setFlash(req, 'ok', 'Đã thêm danh mục.');
      }
      res.redirect('/categories');
    } catch (err) {
      next(err);
    }
  });

  app.post('/categories/:id/delete', requireAuth, async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return notFound(req, res);
      const ok = await repo.deleteCategory(id);
      if (!ok) return notFound(req, res);
      logger.info('category_deleted', { id, user: req.session.user.username });
      setFlash(req, 'ok', 'Đã xóa danh mục.');
      res.redirect('/categories');
    } catch (err) {
      if (err.code === '23503') {
        setFlash(req, 'error', 'Không thể xóa: danh mục đang được dùng bởi giao dịch.');
        return res.redirect('/categories');
      }
      next(err);
    }
  });

  // ---------- Reports ----------
  app.get('/reports', requireAuth, async (req, res, next) => {
    try {
      const month = validateMonth(req.query.month);
      const [summary, byCategory, trend] = await Promise.all([
        repo.monthlySummary(month),
        repo.summaryByCategory(month),
        repo.monthlyTrend(6),
      ]);
      const expense = byCategory.filter((c) => c.kind === 'expense');
      const income = byCategory.filter((c) => c.kind === 'income');
      res.render('reports', {
        title: 'Báo cáo',
        month,
        summary,
        expense: buildBars(expense),
        income: buildBars(income),
        trend: buildTrendChart(trend),
      });
    } catch (err) {
      next(err);
    }
  });

  // ---------- Account ----------
  app.get('/account/password', requireAuth, (req, res) => {
    res.render('password', { title: 'Đổi mật khẩu', errors: [] });
  });

  app.post('/account/password', requireAuth, async (req, res, next) => {
    try {
      const current = String(req.body.current_password || '');
      const nextPw = String(req.body.new_password || '');
      const confirm = String(req.body.confirm_password || '');
      const errors = [];
      const user = await repo.findUserByUsername(req.session.user.username);
      if (!user || !verifyPassword(current, user.password_hash)) errors.push('Mật khẩu hiện tại không đúng.');
      if (nextPw.length < 12) errors.push('Mật khẩu mới phải có ít nhất 12 ký tự.');
      if (nextPw !== confirm) errors.push('Xác nhận mật khẩu không khớp.');
      if (errors.length) {
        return res.status(400).render('password', { title: 'Đổi mật khẩu', errors });
      }
      await repo.updatePassword(user.id, hashPassword(nextPw));
      logger.info('password_changed', { username: user.username, ip: req.ip });
      req.session.destroy(() => {
        res.clearCookie('expense.sid');
        res.redirect('/login');
      });
    } catch (err) {
      next(err);
    }
  });

  // ---------- 404 & errors ----------
  function notFound(req, res) {
    res.status(404).render('error', {
      title: 'Không tìm thấy',
      status: 404,
      message: 'Trang hoặc tài nguyên bạn yêu cầu không tồn tại.',
    });
  }
  app.use(notFound);

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    logger.error('unhandled_error', { path: req.path, error: err.message });
    res.status(500).render('error', {
      title: 'Lỗi máy chủ',
      status: 500,
      message: 'Đã xảy ra lỗi. Vui lòng thử lại sau.',
    });
  });

  return app;
}

// Chuan bi du lieu ve bieu do cot (SVG) cho bao cao theo danh muc
function buildBars(rows) {
  const max = rows.reduce((m, r) => Math.max(m, Number(r.total)), 0) || 1;
  const total = rows.reduce((s, r) => s + Number(r.total), 0);
  return {
    total,
    rows: rows.map((r) => ({
      ...r,
      width: Math.max(2, Math.round((Number(r.total) / max) * 100)),
      percent: total ? Math.round((Number(r.total) / total) * 1000) / 10 : 0,
    })),
  };
}

// Chuan bi du lieu bieu do xu huong 6 thang (thu vs chi)
function buildTrendChart(rows) {
  const max = rows.reduce((m, r) => Math.max(m, Number(r.income), Number(r.expense)), 0) || 1;
  const height = 120;
  return {
    max,
    height,
    rows: rows.map((r) => ({
      month: r.month,
      income: Number(r.income),
      expense: Number(r.expense),
      incomeH: Math.round((Number(r.income) / max) * height),
      expenseH: Math.round((Number(r.expense) / max) * height),
    })),
  };
}

module.exports = { createApp, formatMoney, buildBars, buildTrendChart };
