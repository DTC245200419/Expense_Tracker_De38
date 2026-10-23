#!/usr/bin/env bash
# Backup PostgreSQL bang pg_dump trong container (khong can cai client tren host).
# Chay:  sh scripts/backup.sh    -> backups/expense-YYYYMMDD-HHMMSS.sql
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/backups"
OUT="$ROOT/backups/expense-$(date +%Y%m%d-%H%M%S).sql"
DC=(docker compose --project-directory "$ROOT" -f "$ROOT/compose.yaml")

# Ket noi local cung yeu cau scram-sha-256 (auth-local) nen truyen PGPASSWORD tu env cua container
"${DC[@]}" exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U postgres --no-owner --no-privileges "$POSTGRES_DB"' > "$OUT"

echo "Da backup: $OUT ($(wc -c < "$OUT") bytes)"
"${DC[@]}" exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -d "$POSTGRES_DB" -Atc "SELECT '"'"'transactions='"'"' || COUNT(*) FROM transactions UNION ALL SELECT '"'"'categories='"'"' || COUNT(*) FROM categories UNION ALL SELECT '"'"'users='"'"' || COUNT(*) FROM users"'
