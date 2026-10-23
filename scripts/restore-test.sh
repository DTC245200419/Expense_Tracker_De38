#!/usr/bin/env bash
# Kiem tra phuc hoi: nhap dump vao database rieng expense_restore_test, so sanh so dong va checksum,
# KHONG dong vao database dang phuc vu website.
# Chay:  sh scripts/restore-test.sh backups/expense-YYYYMMDD-HHMMSS.sql
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DUMP="${1:?Can duong dan file dump .sql}"
TEST_DB="expense_restore_test"
DC=(docker compose --project-directory "$ROOT" -f "$ROOT/compose.yaml")

# Chay lenh psql/createdb trong container voi mat khau tu env POSTGRES_PASSWORD
pg() { "${DC[@]}" exec -T postgres sh -c 'export PGPASSWORD="$POSTGRES_PASSWORD"; '"$*"; }
sql() { pg "psql -U postgres -d $1 -Atc \"$2\""; }

exists=$(sql postgres "SELECT 1 FROM pg_database WHERE datname='$TEST_DB'")
if [ "$exists" = "1" ]; then
  echo "Database $TEST_DB da ton tai. Xoa truoc bang: sh scripts/restore-test.sh --drop" >&2
  exit 1
fi

pg "createdb -U postgres $TEST_DB"
pg "psql -U postgres -d $TEST_DB -q -v ON_ERROR_STOP=1" < "$DUMP"

echo "== So sanh so dong: nguon (expense) vs phuc hoi ($TEST_DB) =="
for t in users categories transactions; do
  src=$(sql expense "SELECT COUNT(*) FROM $t")
  dst=$(sql "$TEST_DB" "SELECT COUNT(*) FROM $t")
  status=$([ "$src" = "$dst" ] && echo OK || echo KHAC)
  printf "%-14s nguon=%-6s phuc_hoi=%-6s %s\n" "$t" "$src" "$dst" "$status"
done

echo "== Checksum noi dung (md5 toan bo bang, sap xep theo id) =="
for t in users categories transactions; do
  src=$(sql expense "SELECT md5(string_agg(t::text, '|' ORDER BY id)) FROM $t t")
  dst=$(sql "$TEST_DB" "SELECT md5(string_agg(t::text, '|' ORDER BY id)) FROM $t t")
  status=$([ "$src" = "$dst" ] && echo OK || echo KHAC)
  printf "%-14s %s  %s\n" "$t" "$status" "$src"
done

pg "dropdb -U postgres $TEST_DB"
echo "Da xoa database thu $TEST_DB. Kiem tra phuc hoi hoan tat."
