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

# Match Firefox/Mozilla Windows VisualElements sizes (used by Start tiles and
# toast AppUserModelId IconUri → VisualElements_70.png).
VISUAL_ELEMENTS_SIZES: dict[str, int] = {
    "VisualElements_70.png": 126,
    "VisualElements_150.png": 270,
}

# MSIX package logos (scale-200 / targetsize variants used by AppxManifest).
MSIX_ASSET_SIZES: dict[str, tuple[int, int]] = {
    "Document44x44.png": (44, 44),
    "LargeTile.scale-200.png": (620, 620),
    "SmallTile.scale-200.png": (142, 142),
    "Square150x150Logo.scale-200.png": (300, 300),
    "Square44x44Logo.altform-lightunplated_targetsize-256.png": (256, 256),
    "Square44x44Logo.altform-unplated_targetsize-256.png": (256, 256),
    "Square44x44Logo.scale-200.png": (88, 88),
    "Square44x44Logo.targetsize-256.png": (256, 256),
    "StoreLogo.scale-200.png": (100, 100),
    "Wide310x150Logo.scale-200.png": (620, 300),
}


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


def resize_contain(square_logo: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Resize logo to fit inside `size`, centered on a transparent canvas."""
    canvas_w, canvas_h = size
    side = min(canvas_w, canvas_h)
    logo = square_logo.resize((side, side), resample=Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    ox = (canvas_w - logo.width) // 2
    oy = (canvas_h - logo.height) // 2
    canvas.paste(logo, (ox, oy), logo)
    return canvas


def write_visual_elements(square_logo: Image.Image, out_dir: Path) -> None:
    """
    Write Windows VisualElements PNGs used for Start tiles and toast IconUri.

    Installer registers:
      HKLM\\...\\AppUserModelId\\{ToastAumidPrefix}{hash}\\IconUri
        = $INSTDIR\\browser\\VisualElements\\VisualElements_70.png
    """
    for filename, side in VISUAL_ELEMENTS_SIZES.items():
        resized = square_logo.resize((side, side), resample=Image.Resampling.LANCZOS)
        resized.save(out_dir / filename, format="PNG", optimize=True)


def write_msix_assets(square_logo: Image.Image, out_dir: Path) -> None:
    """Write MSIX AppxManifest logo assets from the brand logo."""
    assets_dir = out_dir / "msix" / "Assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    for filename, size in MSIX_ASSET_SIZES.items():
        resize_contain(square_logo, size).save(
            assets_dir / filename, format="PNG", optimize=True
        )


def write_icons(src_logo_path: Path, out_dir: Path, *, write_msix: bool = False) -> None:
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

    write_visual_elements(squared, out_dir)
    write_nsis_bitmaps(squared, out_dir)
    if write_msix:
        write_msix_assets(squared, out_dir)


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

    config_targets = [
        root / "configs" / "branding" / "release",
        root / "configs" / "branding" / "twilight",
    ]
    engine_targets = [
        root / "engine" / "browser" / "branding" / "release",
        root / "engine" / "browser" / "branding" / "twilight",
    ]

    for out_dir in config_targets:
        write_icons(src_logo, out_dir, write_msix=False)
    for out_dir in engine_targets:
        if out_dir.exists():
            write_icons(src_logo, out_dir, write_msix=True)

    print("Wrote branding PNGs (incl. VisualElements) to:")
    for out_dir in config_targets + [p for p in engine_targets if p.exists()]:
        print(f"  - {out_dir}")


if __name__ == "__main__":
    main()

