#!/usr/bin/env python3
"""Generate Astra branding PNGs from configs/branding/*/content/about-logo.svg."""

from __future__ import annotations

import base64
import io
import re
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont


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
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
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
    canvas.paste(rgba, ((s - w) // 2, (s - h) // 2))
    return canvas


def darken_for_private(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    r, g, b, a = rgba.split()
    rgb = Image.merge("RGB", (r, g, b)).point(lambda v: int(v * 0.72))
    dr, dg, db = rgb.split()
    return Image.merge("RGBA", (dr, dg, db, a))


def extract_svg_png(svg_path: Path) -> Image.Image:
    text = svg_path.read_text(encoding="utf-8")
    match = re.search(r"data:image/png;base64,([A-Za-z0-9+/=\s]+)", text)
    if not match:
        raise SystemExit(f"no embedded png in {svg_path}")
    raw = base64.b64decode(re.sub(r"\s+", "", match.group(1)))
    return Image.open(io.BytesIO(raw)).convert("RGBA")


def build_about_page_png(logo: Image.Image, *, size=(300, 236)) -> Image.Image:
    """about:logo serves chrome://branding/content/about.png (not about-logo.png)."""
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    mark = logo.copy()
    mark.thumbnail((170, 170), Image.Resampling.LANCZOS)
    x = (size[0] - mark.width) // 2
    y = 18
    canvas.paste(mark, (x, y), mark)
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    label = "Astra"
    bbox = draw.textbbox((0, 0), label, font=font)
    text_w = bbox[2] - bbox[0]
    draw.text(((size[0] - text_w) // 2, y + mark.height + 10), label, fill=(32, 18, 58, 255), font=font)
    return canvas


def write_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG", optimize=True)


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    targets = [
        root / "configs" / "branding" / "release" / "content",
        root / "configs" / "branding" / "twilight" / "content",
    ]
    src_svg = root / "configs" / "branding" / "release" / "content" / "about-logo.svg"
    if not src_svg.exists():
        raise SystemExit(f"missing {src_svg}")

    cleaned = remove_edge_connected_near_black_to_transparent(
        extract_svg_png(src_svg), opts=RemoveBgOptions()
    )
    squared = center_on_square_canvas(cleaned)
    normal_1x = squared.resize((512, 512), Image.Resampling.LANCZOS)
    normal_2x = squared.resize((1024, 1024), Image.Resampling.LANCZOS)
    private_1x = darken_for_private(squared).resize((192, 192), Image.Resampling.LANCZOS)
    private_2x = darken_for_private(squared).resize((384, 384), Image.Resampling.LANCZOS)
    about_page = build_about_page_png(normal_1x)

    for out in targets:
        write_png(normal_1x, out / "about-logo.png")
        write_png(normal_2x, out / "about-logo@2x.png")
        write_png(private_1x, out / "about-logo-private.png")
        write_png(private_2x, out / "about-logo-private@2x.png")
        write_png(about_page, out / "about.png")
        print("wrote", out)

    print("done")


if __name__ == "__main__":
    main()
