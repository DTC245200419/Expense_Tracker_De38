#!/usr/bin/env bash
# Chup anh minh chung (website, GitHub, Prometheus, Grafana, LogQL) bang headless Chrome trong container.
# Khong can cai Node/Chrome tren may. Ket qua: docs/evidence/images/*.png
# Chay:  sh scripts/screenshots.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
envval() { grep -E "^$1=" "$ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r'; }

MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$ROOT:/work" -w /work \
  -e ADMIN_USERNAME="$(envval ADMIN_USERNAME)" \
  -e ADMIN_PASSWORD="$(envval ADMIN_PASSWORD)" \
  -e GRAFANA_ADMIN_PASSWORD="$(envval GRAFANA_ADMIN_PASSWORD)" \
  -e TARGET_HOST=host.docker.internal \
  -e NODE_PATH=/usr/src/app/node_modules \
  --add-host=host.docker.internal:host-gateway \
  zenika/alpine-chrome:with-puppeteer node scripts/screenshots.js
