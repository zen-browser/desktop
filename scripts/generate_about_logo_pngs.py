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


def darken_for_private(img: Image.Image) -> Image.Image:
    # Darken RGB channels while preserving alpha.
    rgba = img.convert("RGBA")
    r, g, b, a = rgba.split()
    rgb = Image.merge("RGB", (r, g, b))
    # Multiply blend by a constant to darken.
    factor = 0.72
    dark_rgb = rgb.point(lambda v: int(v * factor))
    dr, dg, db = dark_rgb.split()
    return Image.merge("RGBA", (dr, dg, db, a))


def write_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG", optimize=True)


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    src_logo = root / "logo.png"
    if not src_logo.exists():
        raise SystemExit(f"Input logo not found: {src_logo}")

    with Image.open(src_logo) as src:
        cleaned = remove_edge_connected_near_black_to_transparent(src, opts=RemoveBgOptions())
    squared = center_on_square_canvas(cleaned)

    # Match existing expected dimensions:
    # - about-logo.png: 512
    # - about-logo@2x.png: 1024
    # - about-logo-private.png: 192
    # - about-logo-private@2x.png: 384
    normal_1x = squared.resize((512, 512), resample=Image.Resampling.LANCZOS)
    normal_2x = squared.resize((1024, 1024), resample=Image.Resampling.LANCZOS)

    private_base = darken_for_private(squared)
    private_1x = private_base.resize((192, 192), resample=Image.Resampling.LANCZOS)
    private_2x = private_base.resize((384, 384), resample=Image.Resampling.LANCZOS)

    targets = [
        root / "configs" / "branding" / "release" / "content",
        root / "configs" / "branding" / "twilight" / "content",
    ]

    for out in targets:
        write_png(normal_1x, out / "about-logo.png")
        write_png(normal_2x, out / "about-logo@2x.png")
        write_png(private_1x, out / "about-logo-private.png")
        write_png(private_2x, out / "about-logo-private@2x.png")

    print("Wrote about-logo PNGs to:")
    for out in targets:
        print(f"  - {out}")


if __name__ == "__main__":
    main()

