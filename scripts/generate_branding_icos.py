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


@dataclass(frozen=True)
class RemoveBgOptions:
    # Pixels with all channels <= threshold are considered "near black".
    threshold: int = 18


def _iter_edge_coords(w: int, h: int) -> Iterable[tuple[int, int]]:
    for x in range(w):
        yield (x, 0)
        if h > 1:
            yield (x, h - 1)
    for y in range(1, h - 1):
        yield (0, y)
        if w > 1:
            yield (w - 1, y)


def remove_edge_connected_near_black_to_transparent(
    img: Image.Image, *, opts: RemoveBgOptions
) -> Image.Image:
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
        r, g, b, a = px[x, y]
        if a != 0:
            px[x, y] = (r, g, b, 0)

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


def center_on_square_canvas(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    if w == h:
        return rgba
    s = max(w, h)
    canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ox = (s - w) // 2
    oy = (s - h) // 2
    canvas.paste(rgba, (ox, oy))
    return canvas


def write_ico(src_logo: Path, out_dir: Path, filename: str, sizes: list[int]) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    src = Image.open(src_logo)
    cleaned = remove_edge_connected_near_black_to_transparent(src, opts=RemoveBgOptions())
    squared = center_on_square_canvas(cleaned)

    ico_path = out_dir / filename
    ico_sizes = [(s, s) for s in sizes]
    squared.save(ico_path, format="ICO", sizes=ico_sizes)


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    src_logo = root / "logo.png"
    if not src_logo.exists():
        raise SystemExit(f"Input logo not found: {src_logo}")

    targets = [
        root / "configs" / "branding" / "release",
        root / "configs" / "branding" / "twilight",
    ]

    for out_dir in targets:
        write_ico(src_logo, out_dir, "firefox.ico", [16, 32, 48, 64, 128, 256])
        write_ico(src_logo, out_dir, "firefox64.ico", [64, 128, 256])
        write_ico(src_logo, out_dir, "pbmode.ico", [16, 32, 48, 64, 128, 256])
        write_ico(src_logo, out_dir, "document.ico", [16, 32, 48, 64])
        write_ico(src_logo, out_dir, "document_pdf.ico", [16, 32, 48, 64])

    print("Wrote ICO files to:")
    for out_dir in targets:
        print(f"  - {out_dir}")


if __name__ == "__main__":
    main()

