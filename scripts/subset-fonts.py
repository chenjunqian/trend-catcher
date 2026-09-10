#!/usr/bin/env python3
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request

FONT_BASE = "https://cdn.jsdelivr.net/gh/tw93/Kami@main/assets/fonts"
WEIGHTS = ("W04", "W05")
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "fonts")


def gb2312_chars() -> set[str]:
    chars: set[str] = set()
    for high in range(0xA1, 0xF8):
        for low in range(0xA1, 0xFF):
            try:
                chars.add(bytes([high, low]).decode("gb2312"))
            except UnicodeDecodeError:
                pass
    return chars


def extra_chars() -> set[str]:
    ranges = (
        (0x0020, 0x007E),
        (0x00A0, 0x00FF),
        (0x2000, 0x206F),
        (0x2190, 0x2193),
        (0x2264, 0x2265),
        (0x3000, 0x303F),
        (0xFF00, 0xFFEF),
    )
    chars: set[str] = set()
    for start, end in ranges:
        chars.update(chr(cp) for cp in range(start, end + 1))
    return chars


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", help="directory holding the TsangerJinKai02 TTF files")
    args = parser.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)
    chars = gb2312_chars() | extra_chars()
    subset_cmd = shutil.which("pyftsubset")
    if subset_cmd is None:
        subset_cmd = [sys.executable, "-m", "fontTools.subset"]
    elif isinstance(subset_cmd, str):
        subset_cmd = [subset_cmd]

    with tempfile.TemporaryDirectory() as tmp:
        text_file = os.path.join(tmp, "chars.txt")
        with open(text_file, "w", encoding="utf-8") as handle:
            handle.write("".join(sorted(chars)))

        for weight in WEIGHTS:
            if args.source_dir:
                src = os.path.join(args.source_dir, f"TsangerJinKai02-{weight}.ttf")
            else:
                src = os.path.join(tmp, f"TsangerJinKai02-{weight}.ttf")
                urllib.request.urlretrieve(f"{FONT_BASE}/TsangerJinKai02-{weight}.ttf", src)

            out = os.path.join(OUT_DIR, f"TsangerJinKai02-{weight}.woff2")
            subprocess.run(
                subset_cmd
                + [
                    src,
                    f"--output-file={out}",
                    f"--text-file={text_file}",
                    "--flavor=woff2",
                    "--layout-features=*",
                ],
                check=True,
            )
            print(f"{out} {os.path.getsize(out)} bytes")


if __name__ == "__main__":
    main()
