#!/bin/sh
# Tao tai khoan ung dung (chi CRUD) va tai khoan exporter (chi doc metrics).
# Mat khau lay tu bien moi truong do scripts/setup.* sinh ra trong .env.
set -eu

: "${APP_DB_PASSWORD:?Thieu APP_DB_PASSWORD}"
: "${EXPORTER_DB_PASSWORD:?Thieu EXPORTER_DB_PASSWORD}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
  -- Tai khoan ung dung: least privilege, khong co CREATE/ALTER/DROP
  CREATE ROLE expense_app LOGIN PASSWORD '${APP_DB_PASSWORD}';
  GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO expense_app;
  GRANT USAGE ON SCHEMA public TO expense_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO expense_app;
  GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO expense_app;

  -- Tai khoan cho postgres-exporter: chi quyen giam sat
  CREATE ROLE expense_exporter LOGIN PASSWORD '${EXPORTER_DB_PASSWORD}';
  GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO expense_exporter;
  GRANT pg_monitor TO expense_exporter;

  -- Thu hoi quyen tao doi tuong tren schema public khoi PUBLIC
  REVOKE CREATE ON SCHEMA public FROM PUBLIC;
EOSQL

echo "[init] Da tao role expense_app va expense_exporter"
