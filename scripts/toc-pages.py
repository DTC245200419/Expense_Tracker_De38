#!/usr/bin/env python3
"""Do so trang cua tung heading tu cac file pdf/page-NN.txt (pdftotext) -> docs/report/toc-pages.json.
Trang danh so = trang PDF - 1 (trang bia khong danh so). Chay trong container LibreOffice (co python3)."""
import glob
import json
import os
import re
import sys
import unicodedata

root = sys.argv[1]  # thu muc docs/report


def norm(s):
    s = unicodedata.normalize("NFC", s)
    return re.sub(r"\s+", " ", s).strip().lower()


heads = json.load(open(os.path.join(root, "headings.json"), encoding="utf-8"))
pages = {}
for f in sorted(glob.glob(os.path.join(root, "pdf", "page-*.txt"))):
    i = int(re.search(r"page-(\d+)\.txt", f).group(1))
    if i == 1:
        continue  # trang bia
    lines = [norm(l) for l in open(f, encoding="utf-8", errors="ignore").read().splitlines() if l.strip()]
    if lines and lines[0].startswith("mục lục"):
        continue  # trang muc luc cung chua ten cac heading
    for h in heads:
        if h["text"] in pages:
            continue
        t = norm(h["text"])
        if any(l == t or l.startswith(t) for l in lines):
            pages[h["text"]] = i - 1

missing = [h["text"] for h in heads if h["text"] not in pages]
json.dump(pages, open(os.path.join(root, "toc-pages.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("   Da do", len(pages), "/", len(heads), "muc;", ("THIEU: " + ", ".join(missing)) if missing else "du")
