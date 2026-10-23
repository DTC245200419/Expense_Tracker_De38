#!/usr/bin/env bash
# Sinh file .env voi mat khau ngau nhien (Linux/macOS/Git Bash).
# Chay:  sh scripts/setup.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

if [ -f "$ENV_FILE" ]; then
  echo "File .env da ton tai: $ENV_FILE" >&2
  echo "Xoa file nay neu muon sinh lai (database da khoi tao se giu mat khau cu)." >&2
  exit 1
fi

secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

cat > "$ENV_FILE" <<EOF
# Sinh tu dong boi scripts/setup.sh - KHONG commit file nay
DB_NAME=expense
POSTGRES_PASSWORD=$(secret 16)
APP_DB_PASSWORD=$(secret 16)
EXPORTER_DB_PASSWORD=$(secret 16)

SESSION_SECRET=$(secret 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$(secret 12)
ADMIN_DISPLAY_NAME=Quan tri vien
COOKIE_SECURE=false

PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=$(secret 12)

GRAFANA_ADMIN_PASSWORD=$(secret 12)

NGINX_HTTP_PORT=8080
NGINX_HTTPS_PORT=8443
PGADMIN_PORT=8081
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
EOF

echo "Da tao $ENV_FILE"
echo "Tai khoan web: admin / xem ADMIN_PASSWORD trong .env"
