-- Schema cho ung dung Expense Tracker (De 38)
-- Chay tu dong boi postgres entrypoint lan dau khoi tao volume.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(64)  NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(64) NOT NULL,
  kind  VARCHAR(10) NOT NULL CHECK (kind IN ('income', 'expense')),
  color VARCHAR(7)  NOT NULL DEFAULT '#4f46e5',
  UNIQUE (name, kind)
);

CREATE TABLE IF NOT EXISTS transactions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  kind        VARCHAR(10)   NOT NULL CHECK (kind IN ('income', 'expense')),
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  occurred_on DATE          NOT NULL,
  note        VARCHAR(255)  NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transactions_occurred_on ON transactions (occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category_id);

-- Bang session theo dinh dang cua connect-pg-simple
CREATE TABLE IF NOT EXISTS sessions (
  sid    VARCHAR      NOT NULL PRIMARY KEY,
  sess   JSON         NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions (expire);

-- Danh muc mau
INSERT INTO categories (name, kind, color) VALUES
  ('Ăn uống',      'expense', '#dc2626'),
  ('Đi lại',       'expense', '#ea580c'),
  ('Nhà ở',        'expense', '#d97706'),
  ('Hóa đơn',      'expense', '#7c3aed'),
  ('Mua sắm',      'expense', '#db2777'),
  ('Giải trí',     'expense', '#0891b2'),
  ('Học tập',      'expense', '#475569'),
  ('Lương',        'income',  '#059669'),
  ('Thưởng',       'income',  '#65a30d'),
  ('Thu khác',     'income',  '#4f46e5')
ON CONFLICT DO NOTHING;

-- Giao dich mau trong 3 thang gan nhat de dashboard va bao cao co du lieu
INSERT INTO transactions (category_id, kind, amount, occurred_on, note)
SELECT c.id, c.kind, s.amount, s.day, s.note
FROM (VALUES
  ('Lương',    'income',  15000000, date_trunc('month', CURRENT_DATE)::date + 4,                      'Lương tháng này'),
  ('Ăn uống',  'expense',   120000, CURRENT_DATE - 1,                                                  'Ăn trưa'),
  ('Ăn uống',  'expense',    85000, CURRENT_DATE - 3,                                                  'Cà phê với bạn'),
  ('Đi lại',   'expense',   250000, CURRENT_DATE - 2,                                                  'Đổ xăng'),
  ('Hóa đơn',  'expense',   650000, date_trunc('month', CURRENT_DATE)::date + 9,                      'Tiền điện'),
  ('Nhà ở',    'expense',  3500000, date_trunc('month', CURRENT_DATE)::date + 1,                      'Tiền thuê phòng'),
  ('Học tập',  'expense',   400000, CURRENT_DATE - 5,                                                  'Mua sách'),
  ('Lương',    'income',  15000000, (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date + 4, 'Lương tháng trước'),
  ('Thưởng',   'income',   2000000, (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date + 20,'Thưởng dự án'),
  ('Ăn uống',  'expense',  2800000, (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date + 15,'Ăn uống cả tháng'),
  ('Nhà ở',    'expense',  3500000, (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date + 1, 'Tiền thuê phòng'),
  ('Mua sắm',  'expense',  1200000, (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date + 22,'Quần áo'),
  ('Giải trí', 'expense',   300000, (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date + 18,'Xem phim'),
  ('Lương',    'income',  14500000, (date_trunc('month', CURRENT_DATE) - INTERVAL '2 month')::date + 4, 'Lương'),
  ('Ăn uống',  'expense',  2500000, (date_trunc('month', CURRENT_DATE) - INTERVAL '2 month')::date + 12,'Ăn uống cả tháng'),
  ('Nhà ở',    'expense',  3500000, (date_trunc('month', CURRENT_DATE) - INTERVAL '2 month')::date + 1, 'Tiền thuê phòng'),
  ('Hóa đơn',  'expense',   580000, (date_trunc('month', CURRENT_DATE) - INTERVAL '2 month')::date + 9, 'Tiền điện nước')
) AS s(cat, kind, amount, day, note)
JOIN categories c ON c.name = s.cat AND c.kind = s.kind;
