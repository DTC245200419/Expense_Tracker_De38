#!/usr/bin/env bash
# Tao chung chi tu ky cho localhost / 127.0.0.1 (RSA 3072, SHA-256, 30 ngay).
# Dung openssl cuc bo neu co; neu khong, chay openssl trong container Alpine.
# Chay:  sh scripts/tls.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="$ROOT/certs"
mkdir -p "$CERT_DIR"

if [ -f "$CERT_DIR/server.crt" ] && [ -f "$CERT_DIR/server.key" ]; then
  echo "certs/server.crt va server.key da ton tai. Xoa chung neu muon tao lai." >&2
  exit 0
fi

SUBJ="/C=VN/ST=Thai Nguyen/O=ICTU De 38/CN=localhost"
EXT="subjectAltName=DNS:localhost,IP:127.0.0.1"

if command -v openssl >/dev/null 2>&1; then
  # Tao trong thu muc tam (duong dan ASCII) vi openssl tren Windows khong ghi duoc duong dan co dau
  TMP="$(mktemp -d)"
  KEY="$TMP/server.key"; CRT="$TMP/server.crt"
  # Git Bash: openssl la binary Windows -> dua duong dan Windows va tat chuyen doi "/C=VN/..." cua MSYS
  if command -v cygpath >/dev/null 2>&1; then KEY="$(cygpath -w "$KEY")"; CRT="$(cygpath -w "$CRT")"; fi
  MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:3072 -sha256 -days 30 -nodes \
    -keyout "$KEY" -out "$CRT" -subj "$SUBJ" -addext "$EXT" 2>/dev/null
  mv "$TMP/server.key" "$TMP/server.crt" "$CERT_DIR/" && rmdir "$TMP"
else
  echo "Khong co openssl cuc bo, dung container alpine..."
  MSYS_NO_PATHCONV=1 docker run --rm -v "$CERT_DIR:/certs" alpine:3.21 sh -c \
    "apk add --no-cache openssl >/dev/null && openssl req -x509 -newkey rsa:3072 -sha256 -days 30 -nodes \
     -keyout /certs/server.key -out /certs/server.crt -subj '$SUBJ' -addext '$EXT' && chmod 644 /certs/server.key /certs/server.crt"
fi

echo "Da tao $CERT_DIR/server.crt va server.key"
openssl x509 -in "$CERT_DIR/server.crt" -noout -subject -dates -ext subjectAltName 2>/dev/null || true
