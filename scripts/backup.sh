#!/usr/bin/env bash
# Backup PostgreSQL bang pg_dump trong container (khong can cai client tren host).
# Chay:  sh scripts/backup.sh    -> backups/expense-YYYYMMDD-HHMMSS.sql
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/backups"
OUT="$ROOT/backups/expense-$(date +%Y%m%d-%H%M%S).sql"

docker compose --project-directory "$ROOT" -f "$ROOT/compose.yaml" exec -T postgres \
  sh -c 'pg_dump -U postgres --no-owner --no-privileges "$POSTGRES_DB"' > "$OUT"

echo "Da backup: $OUT ($(wc -c < "$OUT") bytes)"
docker compose --project-directory "$ROOT" -f "$ROOT/compose.yaml" exec -T postgres \
  sh -c 'psql -U postgres -d "$POSTGRES_DB" -Atc "SELECT '"'"'transactions='"'"' || COUNT(*) FROM transactions UNION ALL SELECT '"'"'categories='"'"' || COUNT(*) FROM categories"'
