#!/usr/bin/env python3
"""Create a Mozilla MAR archive from a newline-delimited file list.

mar.exe has no @response-file / list-file input. make_full_update.sh builds one
giant argv via `eval`, which hits Windows/MSYS ARG_MAX ("Argument list too long")
once the packaged tree is large enough. This helper mirrors modules/libmar
mar_create() so we can pass thousands of member paths without an oversized argv.
"""

from __future__ import annotations

import argparse
import os
import struct
import sys
from pathlib import Path

MAR_ID = b"MAR1"
BLOCKSIZE = 4096
MAX_SIZE_OF_MAR_FILE = 524288000
PIB_MAX_MAR_CHANNEL_ID_SIZE = 63
PIB_MAX_PRODUCT_VERSION_SIZE = 31
PRODUCT_INFO_BLOCK_ID = 1


def _mar_item_size(namelen: int) -> int:
    return 3 * 4 + namelen + 1


def _product_info_block_size() -> int:
    # size + id + max channel + max version + 2 NUL terminators
    return 4 + 4 + PIB_MAX_MAR_CHANNEL_ID_SIZE + PIB_MAX_PRODUCT_VERSION_SIZE + 2


def _write_product_info_block(fp, channel_id: str, product_version: str) -> int:
    if len(channel_id) > PIB_MAX_MAR_CHANNEL_ID_SIZE:
        raise ValueError("MAR channel ID too long")
    if len(product_version) > PIB_MAX_PRODUCT_VERSION_SIZE:
        raise ValueError("product version too long")

    info_block_size = _product_info_block_size()
    fp.write(struct.pack(">I", info_block_size))
    fp.write(struct.pack(">I", PRODUCT_INFO_BLOCK_ID))
    channel_b = channel_id.encode("ascii") + b"\0"
    version_b = product_version.encode("ascii") + b"\0"
    fp.write(channel_b)
    fp.write(version_b)
    unused = info_block_size - (4 + 4 + len(channel_b) + len(version_b))
    fp.write(b"\0" * unused)
    return info_block_size


def create_mar(
    dest: Path,
    workdir: Path,
    files: list[str],
    channel_id: str,
    product_version: str,
) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Write to a temp path and rename only after the MAR is fully finalized so a
    # mid-write failure cannot leave a stub/corrupt dest that later passes test -s.
    tmp = dest.with_name(dest.name + ".tmp")
    if tmp.exists():
        tmp.unlink()
    index = bytearray()
    last_offset = (
        len(MAR_ID)
        + 4  # offset_to_index
        + 8  # sizeOfEntireMAR
        + 4  # numSignatures
        + 4  # numAdditionalSections
    )

    try:
        with tmp.open("wb") as fp:
            fp.write(MAR_ID)
            fp.write(b"\0" * 4)  # offset_to_index placeholder
            fp.write(b"\0" * 8)  # sizeOfEntireMAR placeholder
            fp.write(struct.pack(">I", 0))  # numSignatures
            fp.write(struct.pack(">I", 1))  # numAdditionalSections
            last_offset += _write_product_info_block(fp, channel_id, product_version)

            for name in files:
                path = workdir / name
                if not path.is_file():
                    raise FileNotFoundError(f"file not found: {path}")
                st = path.stat()
                length = st.st_size
                # Match copy_perm() in update-packaging/common.sh: executable -> 0755 else 0644
                flags = 0o755 if os.access(path, os.X_OK) else 0o644
                name_b = name.encode("utf-8")
                index.extend(struct.pack(">III", last_offset, length, flags))
                index.extend(name_b + b"\0")
                last_offset += length

                with path.open("rb") as inp:
                    while True:
                        chunk = inp.read(BLOCKSIZE)
                        if not chunk:
                            break
                        fp.write(chunk)

            size_of_index = len(index)
            fp.write(struct.pack(">I", size_of_index))
            fp.write(index)

            if fp.tell() > MAX_SIZE_OF_MAR_FILE:
                raise RuntimeError(
                    f"MAR exceeds MAX_SIZE_OF_MAR_FILE ({MAX_SIZE_OF_MAR_FILE})"
                )

            size_of_entire_mar = last_offset + size_of_index + 4
            fp.seek(len(MAR_ID))
            fp.write(struct.pack(">I", last_offset))
            fp.write(struct.pack(">Q", size_of_entire_mar))

        os.replace(tmp, dest)
    except Exception:
        if tmp.exists():
            tmp.unlink()
        raise


def _read_filelist(path: Path) -> list[str]:
    files: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        name = line.strip()
        if not name or name.startswith("#"):
            continue
        files.append(name.replace("\\", "/"))
    if not files:
        raise ValueError(f"empty file list: {path}")
    return files


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("-C", "--workdir", required=True, type=Path)
    parser.add_argument("-c", "--output", required=True, type=Path)
    parser.add_argument("-H", "--channel-id", required=True)
    parser.add_argument("-V", "--product-version", required=True)
    parser.add_argument(
        "-f",
        "--filelist",
        required=True,
        type=Path,
        help="Newline-delimited member paths relative to workdir",
    )
    args = parser.parse_args(argv)

    files = _read_filelist(args.filelist)
    out = args.output if args.output.is_absolute() else args.workdir / args.output
    create_mar(out, args.workdir, files, args.channel_id, args.product_version)
    print(
        f"Created MAR {out} with {len(files)} members "
        f"({out.stat().st_size} bytes)",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
