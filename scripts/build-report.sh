#!/usr/bin/env bash
# Dung file bao cao Word tu docs/report/build-report.js (Node + docx-js trong container, khong can cai Node).
# Muc luc co so trang that: build lan 1 -> LibreOffice xuat PDF -> do trang cua tung heading -> build lan 2.
# Chay:  sh scripts/build-report.sh   -> docs/report/Bao_cao_De38_Hoang_Van_Tam_DTC245200419.docx (+ pdf/ de kiem tra)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT="$ROOT/docs/report"
mkdir -p "$REPORT/pdf"

build() { # in ra duong dan docx vua tao
  MSYS_NO_PATHCONV=1 docker run --rm -v "$ROOT:/work" -w /tmp/build -e ROOT=/work node:24-alpine sh -c \
    "npm init -y >/dev/null 2>&1 && npm install docx@9.14.0 --no-audit --no-fund >/dev/null 2>&1 && NODE_PATH=/tmp/build/node_modules node /work/docs/report/build-report.js" \
    | tee /dev/stderr | grep -o '/work/docs/report/[^ ]*\.docx' | tail -1 | sed "s#/work#$ROOT#"
}

measure() { # $1 = docx -> xuat PDF, tach text tung trang, do so trang heading; in ra so trang PDF
  local name; name="$(basename "$1")"
  MSYS_NO_PATHCONV=1 docker run --rm -v "$ROOT:/work" --entrypoint sh linuxserver/libreoffice:latest -c "
    cd /work/docs/report && soffice --headless --convert-to pdf --outdir /work/docs/report/pdf '$name' >/dev/null 2>&1
    cd pdf && rm -f page-*.txt page-*.png
    pdf='${name%.docx}.pdf'
    n=\$(pdfinfo \"\$pdf\" | awk '/^Pages/{print \$2}')
    for i in \$(seq 1 \$n); do pdftotext -f \$i -l \$i -layout \"\$pdf\" \$(printf 'page-%02d.txt' \$i); done
    python3 /work/scripts/toc-pages.py /work/docs/report >&2
    echo \$n"
}

echo "== Build lan 1 (do so trang) =="
rm -f "$REPORT/toc-pages.json"
DOCX="$(build)"
PAGES="$(measure "$DOCX")"
echo "   PDF lan 1: $PAGES trang (ke ca bia)"

echo "== Build lan 2 (ghi so trang vao muc luc) =="
DOCX="$(build)"
PAGES2="$(measure "$DOCX")"
echo "   -> $DOCX"
echo "   PDF lan 2: $PAGES2 trang (ke ca bia); so trang muc luc: $REPORT/toc-pages.json"
[ "$PAGES" = "$PAGES2" ] || echo "   CANH BAO: so trang thay doi giua 2 lan build ($PAGES -> $PAGES2), chay lai script."
