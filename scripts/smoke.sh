#!/usr/bin/env bash
# Smoke test chuc nang + bao mat qua Nginx bang curl.
#   sh scripts/smoke.sh                                   # HTTP  http://127.0.0.1:8080
#   sh scripts/smoke.sh https://127.0.0.1:8443 certs/server.crt   # HTTPS voi CA cuc bo
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${1:-http://127.0.0.1:8080}"
CA="${2:-}"
JAR="$(mktemp)"
CURL=(curl -s -o /dev/null --max-time 15 -c "$JAR" -b "$JAR")
[ -n "$CA" ] && CURL+=(--cacert "$CA")

envval() { grep -E "^$1=" "$ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r'; }
ADMIN_USERNAME="$(envval ADMIN_USERNAME)"; ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="$(envval ADMIN_PASSWORD)"

PASS=0; FAIL=0
check() { # check "ten" "ket qua mong doi" "ket qua thuc te"
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "PASS  $1 ($3)"; else FAIL=$((FAIL+1)); echo "FAIL  $1: mong doi [$2], nhan [$3]"; fi
}

echo "== Smoke test $BASE =="

code=$("${CURL[@]}" -w '%{http_code}' "$BASE/health")
check "GET /health" "200" "$code"
body=$(curl -s --max-time 15 ${CA:+--cacert "$CA"} "$BASE/health")
check "health database CONNECTED" "yes" "$(echo "$body" | grep -q CONNECTED && echo yes || echo no)"

hdr=$(curl -s -I --max-time 15 ${CA:+--cacert "$CA"} "$BASE/login" | tr -d '\r')
check "X-Content-Type-Options nosniff" "1" "$(echo "$hdr" | grep -ci '^x-content-type-options: nosniff')"
check "X-Frame-Options DENY" "1" "$(echo "$hdr" | grep -ci '^x-frame-options: deny')"
check "Content-Security-Policy co mat" "1" "$(echo "$hdr" | grep -ci '^content-security-policy:')"
check "Server header khong lo phien ban" "0" "$(echo "$hdr" | grep -ci '^server: nginx/')"

code=$("${CURL[@]}" -w '%{http_code}' "$BASE/not-found-demo")
check "GET /not-found-demo -> 404" "404" "$code"

code=$("${CURL[@]}" -w '%{http_code}' "$BASE/transactions")
check "GET /transactions chua dang nhap -> 302" "302" "$code"

code=$("${CURL[@]}" -w '%{http_code}' -X POST -d "username=$ADMIN_USERNAME&password=x" "$BASE/login")
check "POST /login thieu CSRF -> 403" "403" "$code"

token=$(curl -s --max-time 15 ${CA:+--cacert "$CA"} -c "$JAR" -b "$JAR" "$BASE/login" | grep -o 'name="_csrf" value="[a-f0-9]*"' | head -1 | sed 's/.*value="//;s/"//')
check "Lay duoc CSRF token" "yes" "$([ -n "$token" ] && echo yes || echo no)"

code=$("${CURL[@]}" -w '%{http_code}' -X POST --data-urlencode "_csrf=$token" --data-urlencode "username=$ADMIN_USERNAME" --data-urlencode "password=sai-mat-khau" "$BASE/login")
check "POST /login sai mat khau -> 401" "401" "$code"

if [ -n "$ADMIN_PASSWORD" ]; then
  code=$("${CURL[@]}" -w '%{http_code}' -X POST --data-urlencode "_csrf=$token" --data-urlencode "username=$ADMIN_USERNAME" --data-urlencode "password=$ADMIN_PASSWORD" "$BASE/login")
  check "POST /login dung -> 302" "302" "$code"
  code=$("${CURL[@]}" -w '%{http_code}' "$BASE/")
  check "GET / sau dang nhap -> 200" "200" "$code"
  code=$("${CURL[@]}" -w '%{http_code}' "$BASE/reports")
  check "GET /reports -> 200" "200" "$code"
  cookie_line=$(grep expense.sid "$JAR" | head -1)
  check "Cookie expense.sid HttpOnly" "yes" "$(echo "$cookie_line" | grep -q '#HttpOnly_' && echo yes || echo no)"
  if [[ "$BASE" == https://* ]]; then
    check "Cookie Secure (HTTPS)" "TRUE" "$(echo "$cookie_line" | awk '{print $4}')"
  fi
else
  echo "SKIP  dang nhap dung (khong tim thay ADMIN_PASSWORD trong .env)"
fi

rm -f "$JAR"
echo "== Ket qua: $PASS PASS, $FAIL FAIL =="
[ "$FAIL" -eq 0 ]
