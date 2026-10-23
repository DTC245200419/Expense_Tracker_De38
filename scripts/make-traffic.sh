#!/usr/bin/env bash
# Tao luu luong de dashboard/log co du lieu: trang chu, login, 404, dang nhap sai.
# Chay:  sh scripts/make-traffic.sh [base_url] [so_vong]
set -uo pipefail
BASE="${1:-http://127.0.0.1:8080}"
ROUNDS="${2:-20}"
for i in $(seq 1 "$ROUNDS"); do
  curl -s -o /dev/null -k --max-time 10 "$BASE/login"
  curl -s -o /dev/null -k --max-time 10 "$BASE/health"
  curl -s -o /dev/null -k --max-time 10 "$BASE/static/style.css"
  curl -s -o /dev/null -k --max-time 10 "$BASE/not-found-demo"
  curl -s -o /dev/null -k --max-time 10 -X POST -d "username=admin&password=wrong" "$BASE/login"
  sleep 0.5
done
echo "Da tao $((ROUNDS * 5)) request toi $BASE"
