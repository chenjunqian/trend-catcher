#!/usr/bin/env python3
import argparse
import os
import tempfile
import urllib.request

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

FONT_BASE = "https://cdn.jsdelivr.net/gh/tw93/Kami@main/assets/fonts"
WEIGHTS = ("W04", "W05")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
FONT_DIR = os.path.join(ROOT_DIR, "public", "fonts")
FREQUENCY_FILE = os.path.join(SCRIPT_DIR, "data", "cjk-frequency.txt")
CHUNKS_FILE = os.path.join(ROOT_DIR, "src", "routes", "font-chunks.ts")
DEFAULT_CHUNK_SIZE = 48


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


def ordered_charset() -> list[str]:
    with open(FREQUENCY_FILE, encoding="utf-8") as handle:
        ranked = [char for char in handle.read() if not char.isspace()]
    charset = gb2312_chars() | extra_chars()
    ordered = [char for char in ranked if char in charset]
    known = set(ordered)
    ordered.extend(sorted(charset - known))
    return ordered


def load_cmap(path: str) -> set[int]:
    font = TTFont(path, lazy=True)
    codepoints = set(font.getBestCmap())
    font.close()
    return codepoints


def merge_ranges(codepoints: list[int]) -> list[tuple[int, int]]:
    ranges: list[tuple[int, int]] = []
    for cp in sorted(codepoints):
        if ranges and cp == ranges[-1][1] + 1:
            ranges[-1] = (ranges[-1][0], cp)
        else:
            ranges.append((cp, cp))
    return ranges


def format_ranges(ranges: list[tuple[int, int]]) -> str:
    return ",".join(
        f"U+{start:04X}" if start == end else f"U+{start:04X}-{end:04X}"
        for start, end in ranges
    )


def chunked(chars: list[str], size: int) -> list[list[str]]:
    return [chars[index : index + size] for index in range(0, len(chars), size)]


def subset(src: str, chars: list[str], out: str) -> None:
    font = TTFont(src, lazy=True, recalcTimestamp=False)
    options = Options()
    options.layout_features = ["*"]
    options.flavor = "woff2"
    subsetter = Subsetter(options=options)
    subsetter.populate(text="".join(chars))
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(out)
    font.close()


def write_chunks_module(entries: list[dict[str, str]]) -> None:
    lines = [
        "export interface FontChunk {",
        "  unicodeRange: string;",
        "  w04: string;",
        "  w05: string;",
        "}",
        "",
        "export const FONT_CHUNKS: readonly FontChunk[] = [",
    ]
    for entry in entries:
        lines.append(
            f'  {{ unicodeRange: "{entry["unicodeRange"]}", '
            f'w04: "{entry["w04"]}", w05: "{entry["w05"]}" }},'
        )
    lines.append("];")
    lines.append("")
    with open(CHUNKS_FILE, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", help="directory holding the TsangerJinKai02 TTF files")
    parser.add_argument("--chunk-size", type=int, default=DEFAULT_CHUNK_SIZE)
    args = parser.parse_args()

    os.makedirs(FONT_DIR, exist_ok=True)
    for name in os.listdir(FONT_DIR):
        if name.startswith("TsangerJinKai02-W") and name.endswith(".woff2"):
            os.remove(os.path.join(FONT_DIR, name))

    with tempfile.TemporaryDirectory() as tmp:
        sources: dict[str, str] = {}
        for weight in WEIGHTS:
            if args.source_dir:
                src = os.path.join(args.source_dir, f"TsangerJinKai02-{weight}.ttf")
            else:
                src = os.path.join(tmp, f"TsangerJinKai02-{weight}.ttf")
                urllib.request.urlretrieve(f"{FONT_BASE}/TsangerJinKai02-{weight}.ttf", src)
            sources[weight] = src

        covered = set.intersection(*(load_cmap(path) for path in sources.values()))
        ordered = [char for char in ordered_charset() if ord(char) in covered]
        chunks = chunked(ordered, args.chunk_size)

        entries: list[dict[str, str]] = []
        for index, chars in enumerate(chunks):
            urls: dict[str, str] = {}
            for weight in WEIGHTS:
                name = f"TsangerJinKai02-{weight}-{index:03d}.woff2"
                subset(sources[weight], chars, os.path.join(FONT_DIR, name))
                urls[weight] = f"/fonts/{name}"
            entries.append(
                {
                    "unicodeRange": format_ranges(merge_ranges([ord(c) for c in chars])),
                    "w04": urls["W04"],
                    "w05": urls["W05"],
                }
            )

    write_chunks_module(entries)
    sizes = [
        os.path.getsize(os.path.join(FONT_DIR, os.path.basename(entry["w04"])))
        for entry in entries
    ]
    print(
        f"{len(entries)} chunks per weight, {len(ordered)} chars, "
        f"chunk {min(sizes)}-{max(sizes)} bytes"
    )


if __name__ == "__main__":
    main()
