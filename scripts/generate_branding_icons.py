#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image


SIZES: list[int] = [16, 22, 24, 32, 48, 64, 128, 256, 512, 1024]
NSIS_WATERMARK_SIZE: tuple[int, int] = (164, 314)
NSIS_HEADER_SIZE: tuple[int, int] = (150, 57)


@dataclass(frozen=True)
class RemoveBgOptions:
    # Pixels with all channels <= threshold are considered "near black".
    threshold: int = 18


def _iter_edge_coords(w: int, h: int) -> Iterable[tuple[int, int]]:
    # top + bottom rows
    for x in range(w):
        yield (x, 0)
        if h > 1:
            yield (x, h - 1)
    # left + right columns (excluding corners already yielded)
    for y in range(1, h - 1):
        yield (0, y)
        if w > 1:
            yield (w - 1, y)


def remove_edge_connected_near_black_to_transparent(
    img: Image.Image, *, opts: RemoveBgOptions
) -> Image.Image:
    """
    Remove near-black background by flood-filling from edges.
    This preserves interior dark pixels that are NOT connected to the edges.
    """
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()

    def is_near_black(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a == 0:
            return True
        t = opts.threshold
        return r <= t and g <= t and b <= t

    visited = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    for x, y in _iter_edge_coords(w, h):
        if is_near_black(x, y):
            idx = y * w + x
            if not visited[idx]:
                visited[idx] = 1
                q.append((x, y))

    while q:
        x, y = q.popleft()
        # Clear this pixel
        r, g, b, a = px[x, y]
        if a != 0:
            px[x, y] = (r, g, b, 0)

        # 4-neighborhood flood fill
        if x > 0:
            nx, ny = x - 1, y
            nidx = ny * w + nx
            if not visited[nidx] and is_near_black(nx, ny):
                visited[nidx] = 1
                q.append((nx, ny))
        if x + 1 < w:
            nx, ny = x + 1, y
            nidx = ny * w + nx
            if not visited[nidx] and is_near_black(nx, ny):
                visited[nidx] = 1
                q.append((nx, ny))
        if y > 0:
            nx, ny = x, y - 1
            nidx = ny * w + nx
            if not visited[nidx] and is_near_black(nx, ny):
                visited[nidx] = 1
                q.append((nx, ny))
        if y + 1 < h:
            nx, ny = x, y + 1
            nidx = ny * w + nx
            if not visited[nidx] and is_near_black(nx, ny):
                visited[nidx] = 1
                q.append((nx, ny))

    return rgba


def center_on_square_canvas(img: Image.Image, size: int) -> Image.Image:
    """
    Make a square image by centering the original on a transparent canvas.
    """
    rgba = img.convert("RGBA")
    w, h = rgba.size
    if w == h:
        return rgba
    canvas = Image.new("RGBA", (max(w, h), max(w, h)), (0, 0, 0, 0))
    ox = (canvas.size[0] - w) // 2
    oy = (canvas.size[1] - h) // 2
    canvas.paste(rgba, (ox, oy))
    return canvas


def write_icons(src_logo_path: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "content").mkdir(parents=True, exist_ok=True)

    src = Image.open(src_logo_path)
    cleaned = remove_edge_connected_near_black_to_transparent(src, opts=RemoveBgOptions())

    # Save main logo.png (keep original naming expected by build)
    cleaned.save(out_dir / "logo.png", format="PNG", optimize=True)

    # Ensure a square base before resizing (helps avoid stretching)
    squared = center_on_square_canvas(cleaned, cleaned.size[0])

    for s in SIZES:
        resized = squared.resize((s, s), resample=Image.Resampling.LANCZOS)
        resized.save(out_dir / f"logo{s}.png", format="PNG", optimize=True)

    write_nsis_bitmaps(squared, out_dir)


def write_nsis_bitmaps(square_logo: Image.Image, out_dir: Path) -> None:
    """
    Generate NSIS wizard assets so setup pages never fallback to upstream branding.
    """
    wm_w, wm_h = NSIS_WATERMARK_SIZE
    header_w, header_h = NSIS_HEADER_SIZE

    watermark = Image.new("RGB", (wm_w, wm_h), (24, 26, 34))
    watermark_logo = square_logo.resize((112, 112), resample=Image.Resampling.LANCZOS)
    wm_x = (wm_w - watermark_logo.width) // 2
    wm_y = (wm_h - watermark_logo.height) // 2 - 12
    watermark.paste(watermark_logo, (wm_x, wm_y), watermark_logo)
    watermark.save(out_dir / "wizWatermark.bmp", format="BMP")

    header = Image.new("RGB", (header_w, header_h), (255, 255, 255))
    header_logo = square_logo.resize((38, 38), resample=Image.Resampling.LANCZOS)
    header_x = header_w - header_logo.width - 10
    header_y = (header_h - header_logo.height) // 2
    header.paste(header_logo, (header_x, header_y), header_logo)
    header.save(out_dir / "wizHeader.bmp", format="BMP")

    header_rtl = Image.new("RGB", (header_w, header_h), (255, 255, 255))
    header_rtl_logo = square_logo.resize((38, 38), resample=Image.Resampling.LANCZOS)
    header_rtl_x = 10
    header_rtl_y = (header_h - header_rtl_logo.height) // 2
    header_rtl.paste(header_rtl_logo, (header_rtl_x, header_rtl_y), header_rtl_logo)
    header_rtl.save(out_dir / "wizHeaderRTL.bmp", format="BMP")


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Remove black background and generate branding PNG sizes."
    )
    parser.add_argument(
        "--input",
        "-i",
        required=True,
        help="Path to input logo PNG (e.g. C:\\Users\\...\\Downloads\\logo.png)",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent
    src_logo = Path(args.input)
    if not src_logo.exists():
        raise SystemExit(f"Input logo not found: {src_logo}")

    write_icons(src_logo, root / "configs" / "branding" / "release")
    write_icons(src_logo, root / "configs" / "branding" / "twilight")

    print("Wrote branding PNGs to:")
    print(f"  - {root / 'configs' / 'branding' / 'release'}")
    print(f"  - {root / 'configs' / 'branding' / 'twilight'}")


if __name__ == "__main__":
    main()

