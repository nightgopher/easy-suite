#!/usr/bin/env python3
"""X 加权字符数检查（无 Premium 回复上限 280）。

用法:
    charcount.py "草稿文本"
    echo "草稿文本" | charcount.py

加权规则与 X 官方一致的方向：CJK/emoji 等宽字符按 2 计、其余按 1。
本脚本用 `ord(c) > 0x1100` 粗筛——把希腊/西里尔等窄文字也按 2 计，
方向保守（多算不少算），用于 ≤275 草稿约束足够可靠。
"""
import sys

LIMIT = 280


def weighted(s: str) -> int:
    return sum(2 if ord(c) > 0x1100 else 1 for c in s.rstrip("\n"))


def main() -> None:
    text = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
    if not text.strip():
        print("用法: charcount.py \"文本\"（或从 stdin 管道读入）", file=sys.stderr)
        raise SystemExit(2)
    plain, w = len(text), weighted(text)
    if w <= LIMIT:
        print(f"{plain} 字符 / 加权 {w} / OK（≤{LIMIT}）")
    else:
        print(f"{plain} 字符 / 加权 {w} / 超限 {w - LIMIT}，需压缩")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
