#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import annotations

import base64
from collections import deque
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Iterable

from PIL import Image


@dataclass(frozen=True)
class RemoveBgOptions:
    threshold: int = 18  # near-black cutoff per channel


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


def svg_with_embedded_png(png_bytes: bytes, *, size: int) -> str:
    b64 = base64.b64encode(png_bytes).decode("ascii")
    # Keep it simple and broadly compatible for about: pages.
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
        f'viewBox="0 0 {size} {size}">\n'
        f'  <image width="{size}" height="{size}" href="data:image/png;base64,{b64}" />\n'
        "</svg>\n"
    )


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    src_logo = root / "logo.png"
    if not src_logo.exists():
        raise SystemExit(f"Input logo not found: {src_logo}")

    img = Image.open(src_logo)
    cleaned = remove_edge_connected_near_black_to_transparent(img, opts=RemoveBgOptions())
    squared = center_on_square_canvas(cleaned)

    # about-logo.svg historically matches the 1024 asset dimensions here.
    size = 1024
    squared = squared.resize((size, size), resample=Image.Resampling.LANCZOS)
    buf = BytesIO()
    squared.save(buf, format="PNG", optimize=True)
    svg = svg_with_embedded_png(buf.getvalue(), size=size)

    targets = [
        root / "configs" / "branding" / "release" / "content" / "about-logo.svg",
        root / "configs" / "branding" / "twilight" / "content" / "about-logo.svg",
    ]
    for p in targets:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(svg, encoding="utf-8", newline="\n")

    print("Wrote:")
    for p in targets:
        print(f"  - {p}")


if __name__ == "__main__":
    main()

