#!/usr/bin/env bash
# Kiem tra phuc hoi: nhap dump vao database rieng expense_restore_test, so sanh so dong,
# KHONG dong vao database dang phuc vu website.
# Chay:  sh scripts/restore-test.sh backups/expense-YYYYMMDD-HHMMSS.sql
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DUMP="${1:?Can duong dan file dump .sql}"
TEST_DB="expense_restore_test"
DC=(docker compose --project-directory "$ROOT" -f "$ROOT/compose.yaml")

exists=$("${DC[@]}" exec -T postgres psql -U postgres -Atc "SELECT 1 FROM pg_database WHERE datname='$TEST_DB'")
if [ "$exists" = "1" ]; then
  echo "Database $TEST_DB da ton tai. Xoa truoc bang: docker compose exec postgres dropdb -U postgres $TEST_DB" >&2
  exit 1
fi

"${DC[@]}" exec -T postgres createdb -U postgres "$TEST_DB"
"${DC[@]}" exec -T postgres psql -U postgres -d "$TEST_DB" -q -v ON_ERROR_STOP=1 < "$DUMP"

echo "== So sanh so dong: nguon (expense) vs phuc hoi ($TEST_DB) =="
for t in users categories transactions; do
  src=$("${DC[@]}" exec -T postgres psql -U postgres -d expense -Atc "SELECT COUNT(*) FROM $t")
  dst=$("${DC[@]}" exec -T postgres psql -U postgres -d "$TEST_DB" -Atc "SELECT COUNT(*) FROM $t")
  status=$([ "$src" = "$dst" ] && echo OK || echo KHAC)
  printf "%-14s nguon=%-6s phuc_hoi=%-6s %s\n" "$t" "$src" "$dst" "$status"
done

echo "== Checksum noi dung (md5 cua toan bo bang, sap xep theo id) =="
for t in categories transactions; do
  src=$("${DC[@]}" exec -T postgres psql -U postgres -d expense -Atc "SELECT md5(string_agg(t::text, '|' ORDER BY id)) FROM $t t")
  dst=$("${DC[@]}" exec -T postgres psql -U postgres -d "$TEST_DB" -Atc "SELECT md5(string_agg(t::text, '|' ORDER BY id)) FROM $t t")
  status=$([ "$src" = "$dst" ] && echo OK || echo KHAC)
  printf "%-14s %s\n" "$t" "$status"
done

echo "Xong. Xoa database thu: docker compose exec postgres dropdb -U postgres $TEST_DB"
