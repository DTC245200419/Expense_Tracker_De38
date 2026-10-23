#!/usr/bin/env bash
# Tao luu luong de dashboard/log co du lieu: trang chu, health, CSS, 404,
# POST thieu CSRF (csrf_denied) va dang nhap sai co CSRF hop le (login_failed).
# Chay:  sh scripts/make-traffic.sh [base_url] [so_vong]
set -uo pipefail
BASE="${1:-http://127.0.0.1:8080}"
ROUNDS="${2:-20}"
JAR="$(mktemp)"
C=(curl -s -o /dev/null -k --max-time 10)
for i in $(seq 1 "$ROUNDS"); do
  "${C[@]}" "$BASE/login"
  "${C[@]}" "$BASE/health"
  "${C[@]}" "$BASE/static/style.css"
  "${C[@]}" "$BASE/not-found-demo"
  "${C[@]}" "$BASE/transactions"
  "${C[@]}" -X POST -d "username=admin&password=wrong" "$BASE/login"
  token=$(curl -s -k --max-time 10 -c "$JAR" -b "$JAR" "$BASE/login" | grep -o 'name="_csrf" value="[a-f0-9]*"' | head -1 | sed 's/.*value="//;s/"//')
  [ -n "$token" ] && "${C[@]}" -c "$JAR" -b "$JAR" -X POST --data-urlencode "_csrf=$token" --data-urlencode "username=admin" --data-urlencode "password=sai-mat-khau-$i" "$BASE/login"
  sleep 0.5
done
rm -f "$JAR"
echo "Da tao khoang $((ROUNDS * 8)) request toi $BASE"
