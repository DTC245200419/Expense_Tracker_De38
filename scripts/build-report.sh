#!/usr/bin/env bash
# Dung file bao cao Word tu docs/report/build-report.js bang Node trong container (khong can cai Node).
# Chay:  sh scripts/build-report.sh   -> docs/report/Bao_cao_De38_Hoang_Van_Tam_DTC245200419.docx
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MSYS_NO_PATHCONV=1 docker run --rm -v "$ROOT:/work" -w /tmp/build -e ROOT=/work node:24-alpine sh -c \
  "npm init -y >/dev/null 2>&1 && npm install docx@9.14.0 --no-audit --no-fund >/dev/null 2>&1 && NODE_PATH=/tmp/build/node_modules node /work/docs/report/build-report.js"
