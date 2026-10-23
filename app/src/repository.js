'use strict';

// Repository truy van PostgreSQL. Moi cau SQL dung tham so ($1, $2...) de tranh SQL injection.

function monthRange(month) {
  // month: 'YYYY-MM' -> [start, end) dang 'YYYY-MM-DD'
  const [y, m] = month.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return [start, next];
}

function createRepository(pool) {
  return {
    async healthCheck() {
      const { rows } = await pool.query('SELECT 1 AS ok');
      return rows[0].ok === 1;
    },

    // ---------- Users ----------
    async findUserByUsername(username) {
      const { rows } = await pool.query(
        'SELECT id, username, password_hash, display_name FROM users WHERE username = $1',
        [username]
      );
      return rows[0] || null;
    },

    async findUserById(id) {
      const { rows } = await pool.query(
        'SELECT id, username, display_name FROM users WHERE id = $1',
        [id]
      );
      return rows[0] || null;
    },

    async countUsers() {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
      return rows[0].n;
    },

    async createUser({ username, passwordHash, displayName }) {
      const { rows } = await pool.query(
        `INSERT INTO users (username, password_hash, display_name)
         VALUES ($1, $2, $3) RETURNING id, username, display_name`,
        [username, passwordHash, displayName]
      );
      return rows[0];
    },

    async updatePassword(userId, passwordHash) {
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    },

    // ---------- Categories ----------
    async listCategories() {
      const { rows } = await pool.query(
        'SELECT id, name, kind, color FROM categories ORDER BY kind, name'
      );
      return rows;
    },

    async createCategory({ name, kind, color }) {
      const { rows } = await pool.query(
        `INSERT INTO categories (name, kind, color) VALUES ($1, $2, $3)
         ON CONFLICT (name, kind) DO NOTHING RETURNING id`,
        [name, kind, color]
      );
      return rows[0] || null;
    },

    async deleteCategory(id) {
      const { rowCount } = await pool.query('DELETE FROM categories WHERE id = $1', [id]);
      return rowCount > 0;
    },

    // ---------- Transactions ----------
    async listTransactions({ month, kind, limit, offset }) {
      const where = [];
      const params = [];
      if (month) {
        const [start, next] = monthRange(month);
        params.push(start, next);
        where.push(`t.occurred_on >= $${params.length - 1} AND t.occurred_on < $${params.length}`);
      }
      if (kind) {
        params.push(kind);
        where.push(`t.kind = $${params.length}`);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      params.push(limit, offset);
      const { rows } = await pool.query(
        `SELECT t.id, t.kind, t.amount::float8 AS amount, t.occurred_on::text AS occurred_on,
                t.note, c.name AS category_name, c.color AS category_color,
                u.display_name AS created_by
         FROM transactions t
         JOIN categories c ON c.id = t.category_id
         LEFT JOIN users u ON u.id = t.user_id
         ${whereSql}
         ORDER BY t.occurred_on DESC, t.id DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    },

    async countTransactions({ month, kind }) {
      const where = [];
      const params = [];
      if (month) {
        const [start, next] = monthRange(month);
        params.push(start, next);
        where.push(`occurred_on >= $${params.length - 1} AND occurred_on < $${params.length}`);
      }
      if (kind) {
        params.push(kind);
        where.push(`kind = $${params.length}`);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM transactions ${whereSql}`,
        params
      );
      return rows[0].n;
    },

    async getTransaction(id) {
      const { rows } = await pool.query(
        `SELECT id, kind, amount::float8 AS amount, occurred_on::text AS occurred_on,
                note, category_id, user_id
         FROM transactions WHERE id = $1`,
        [id]
      );
      return rows[0] || null;
    },

    async createTransaction({ userId, categoryId, kind, amount, occurredOn, note }) {
      const { rows } = await pool.query(
        `INSERT INTO transactions (user_id, category_id, kind, amount, occurred_on, note)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [userId, categoryId, kind, amount, occurredOn, note]
      );
      return rows[0].id;
    },

    async updateTransaction(id, { categoryId, kind, amount, occurredOn, note }) {
      const { rowCount } = await pool.query(
        `UPDATE transactions
         SET category_id = $1, kind = $2, amount = $3, occurred_on = $4, note = $5
         WHERE id = $6`,
        [categoryId, kind, amount, occurredOn, note, id]
      );
      return rowCount > 0;
    },

    async deleteTransaction(id) {
      const { rowCount } = await pool.query('DELETE FROM transactions WHERE id = $1', [id]);
      return rowCount > 0;
    },

    async recentTransactions(limit) {
      return this.listTransactions({ limit, offset: 0 });
    },

    // ---------- Reports ----------
    async monthlySummary(month) {
      const [start, next] = monthRange(month);
      const { rows } = await pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN kind = 'income' THEN amount END), 0)::float8 AS income,
           COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount END), 0)::float8 AS expense,
           COUNT(*)::int AS count
         FROM transactions WHERE occurred_on >= $1 AND occurred_on < $2`,
        [start, next]
      );
      return rows[0];
    },

    async summaryByCategory(month) {
      const [start, next] = monthRange(month);
      const { rows } = await pool.query(
        `SELECT c.name, c.kind, c.color, SUM(t.amount)::float8 AS total, COUNT(*)::int AS count
         FROM transactions t JOIN categories c ON c.id = t.category_id
         WHERE t.occurred_on >= $1 AND t.occurred_on < $2
         GROUP BY c.id, c.name, c.kind, c.color
         ORDER BY c.kind, total DESC`,
        [start, next]
      );
      return rows;
    },

    async monthlyTrend(months) {
      const { rows } = await pool.query(
        `SELECT to_char(date_trunc('month', occurred_on), 'YYYY-MM') AS month,
                COALESCE(SUM(CASE WHEN kind = 'income' THEN amount END), 0)::float8 AS income,
                COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount END), 0)::float8 AS expense
         FROM transactions
         WHERE occurred_on >= date_trunc('month', CURRENT_DATE) - ($1::int - 1) * INTERVAL '1 month'
         GROUP BY 1 ORDER BY 1`,
        [months]
      );
      return rows;
    },
  };
}

module.exports = { createRepository };
