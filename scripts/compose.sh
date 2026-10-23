#!/usr/bin/env bash
# Wrapper chay Docker Compose theo giai doan.
#   sh scripts/compose.sh 1 up -d --build     # app + postgres + pgadmin + nginx
#   sh scripts/compose.sh 2 up -d --build     # + prometheus, grafana, exporters
#   sh scripts/compose.sh 3 up -d --build     # + loki, promtail
#   sh scripts/compose.sh tls up -d --build   # giai doan 3 + HTTPS tu ky
#   sh scripts/compose.sh 3 ps -a
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="${1:-3}"
shift || true

FILES=(-f "$ROOT/compose.yaml")
case "$STAGE" in
  1) ;;
  2) FILES+=(-f "$ROOT/compose.monitoring.yaml") ;;
  3) FILES+=(-f "$ROOT/compose.monitoring.yaml" -f "$ROOT/compose.logging.yaml") ;;
  tls) FILES+=(-f "$ROOT/compose.monitoring.yaml" -f "$ROOT/compose.logging.yaml" -f "$ROOT/compose.tls.yaml") ;;
  *) echo "Giai doan khong hop le: $STAGE (1|2|3|tls)" >&2; exit 1 ;;
esac

exec docker compose --project-directory "$ROOT" "${FILES[@]}" "$@"
