#!/usr/bin/env python3
"""
웹용 폰트 서브셋 만들기 — 실제로 쓰는 글자만 남겨 폰트를 작게 만든다.

원본 폰트(fonts/*.ttf, *.otf)는 그대로 두고, 작품이 실제로 불러오는
fonts/web/*  를 새로 만든다. (AppleMyungjo 18.7MB → 약 0.1MB)

글자 출처: sentences_KOR.txt, sentences_ENG.txt, sketch.js, index.html 에 나오는 모든 글자
          + 기본 영문/숫자/문장부호(항상 포함)

텍스트를 고친 뒤:
    python3 tools/subset_fonts.py          # 다시 만들기
    python3 tools/subset_fonts.py --check  # 빠진 글자만 검사 (만들지 않음, 빠지면 exit 1)
GitHub에서는 .github/workflows/subset-fonts.yml 이 자동으로 실행·커밋한다.

필요: pip install fonttools
"""
import logging
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

logging.getLogger("fontTools.subset").setLevel(logging.ERROR)  # 지원 안 하는 표 버림 경고 숨김

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ["sentences_KOR.txt", "sentences_ENG.txt", "sketch.js", "index.html"]

# (원본, 결과) — 결과 경로는 sketch.js / index.html 에서 불러오는 경로와 같아야 한다
FONTS = [
    ("fonts/AppleMyungjo.ttf", "fonts/web/AppleMyungjo.ttf"),
    ("fonts/Times New Roman.ttf", "fonts/web/Times New Roman.ttf"),
    ("fonts/NotoSansKR-Thin.otf", "fonts/web/NotoSansKR-Thin.otf"),
]

# 항상 포함: 기본 라틴(U+0020–007E), 라틴-1 보충(U+00A0–00FF), 일반 문장부호(U+2000–206F)
ALWAYS = set(range(0x20, 0x7F)) | set(range(0xA0, 0x100)) | set(range(0x2000, 0x2070))


def wanted_codepoints():
    cps = set(ALWAYS)
    for name in SOURCES:
        text = (ROOT / name).read_text(encoding="utf-8")
        cps |= {ord(c) for c in text if ord(c) >= 0x20}
    return cps


def build(src, dst, cps):
    font = TTFont(ROOT / src, recalcTimestamp=False)  # 타임스탬프 고정 → 같은 입력이면 같은 결과
    cmap = font.getBestCmap()
    keep = sorted(cp for cp in cps if cp in cmap)
    opts = subset.Options()
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.ignore_missing_unicodes = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=keep)
    sub.subset(font)
    out = ROOT / dst
    out.parent.mkdir(parents=True, exist_ok=True)
    font.save(out)
    return out.stat().st_size


def check(cps):
    """결과 폰트에 빠진 글자가 있는지: 원본엔 있는데 결과엔 없는 글자만 문제로 본다."""
    bad = []
    for src, dst in FONTS:
        out = ROOT / dst
        if not out.exists():
            bad.append(f"{dst}: 파일 없음")
            continue
        src_cmap = TTFont(ROOT / src, lazy=True).getBestCmap()
        dst_cmap = TTFont(out, lazy=True).getBestCmap()
        missing = sorted(cp for cp in cps if cp in src_cmap and cp not in dst_cmap)
        if missing:
            bad.append(f"{dst}: 빠진 글자 {len(missing)}개 — " + "".join(chr(c) for c in missing[:40]))
    return bad


def main():
    cps = wanted_codepoints()
    if "--check" in sys.argv:
        bad = check(cps)
        for b in bad:
            print(b)
        if bad:
            print("→ python3 tools/subset_fonts.py 로 다시 만드세요")
            sys.exit(1)
        print("OK: 모든 글자가 웹 폰트에 있음")
        return
    for src, dst in FONTS:
        size = build(src, dst, cps)
        print(f"{dst}: {size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
