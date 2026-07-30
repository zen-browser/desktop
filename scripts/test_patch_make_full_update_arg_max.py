#!/usr/bin/env python3
"""Unit test: MAR filelist must survive append_remove_instructions clobbering files[]."""

from __future__ import annotations

import pathlib
import subprocess
import sys
import tempfile
import textwrap

ROOT = pathlib.Path(__file__).resolve().parents[1]
PATCH = ROOT / "scripts" / "patch_make_full_update_arg_max.py"
ROOT_UNIX = str(ROOT).replace("\\", "/")


def _find_bash() -> str | None:
    candidates = [
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files\Git\usr\bin\bash.exe",
        "/bin/bash",
        "bash",
    ]
    for c in candidates:
        p = pathlib.Path(c)
        if p.is_file():
            # Skip the Windows WSL stub which prints "no installed distributions".
            if p.name.lower() == "bash.exe" and "system32" in str(p).lower():
                continue
            if p.name.lower() == "bash.exe" and "WindowsApps" in str(p):
                continue
            return str(p)
    return None

UPSTREAM = textwrap.dedent(
    """\
    #!/bin/bash
    mar_command="$MAR -V ${MOZ_PRODUCT_VERSION:?} -H ${MAR_CHANNEL_ID:?}"
    archive="$1"
    targetdir="$2"
    workdir="$targetdir.work"
    targetfiles="updatev3.manifest"
    mar_command="$mar_command -C \\"$workdir\\" -c output.mar"
    eval "$mar_command $targetfiles"
    mv -f "$workdir/output.mar" "$archive"
    """
)

BROKEN = textwrap.dedent(
    f"""\
    #!/bin/bash
    workdir="$2.work"
    # Avoid Windows/MSYS ARG_MAX: mar.exe has no @filelist support, so do not
    # eval thousands of paths onto one command line. Write a list and create the
    # MAR with a Python helper that mirrors libmar mar_create().
    filelist="$workdir/mar-filelist.txt"
    {{
      echo "updatev3.manifest"
      for ((i=0; $i<$num_files; i=$i+1)); do
        echo "${{files[$i]}}"
      done
    }} > "$filelist"
    echo "mar filelist: $(wc -l < "$filelist") members -> $workdir/output.mar"
    python "{ROOT_UNIX}/scripts/mar_create_from_filelist.py" \\
      -C "$workdir" \\
      -c output.mar \\
      -H "${{MAR_CHANNEL_ID:?}}" \\
      -V "${{MOZ_PRODUCT_VERSION:?}}" \\
      -f "$filelist"
    mv -f "$workdir/output.mar" "$archive"
    """
)


def main() -> int:
    with tempfile.TemporaryDirectory() as td:
        td_path = pathlib.Path(td)
        script = td_path / "make_full_update.sh"
        script.write_text(UPSTREAM, encoding="utf-8", newline="\n")

        subprocess.check_call([sys.executable, str(PATCH), str(script), ROOT_UNIX])
        text = script.read_text(encoding="utf-8")
        assert "mar_create_from_filelist.py" in text
        assert "append_remove_instructions clobbers" in text
        assert 'echo "${files[$i]}"' not in text

        # Re-patching a good script is a no-op.
        subprocess.check_call([sys.executable, str(PATCH), str(script), ROOT_UNIX])

        # Broken prior patch must be upgraded.
        broken = td_path / "broken.sh"
        broken.write_text(BROKEN, encoding="utf-8", newline="\n")
        subprocess.check_call([sys.executable, str(PATCH), str(broken), ROOT_UNIX])
        broken_text = broken.read_text(encoding="utf-8")
        assert "append_remove_instructions clobbers" in broken_text
        assert 'echo "${files[$i]}"' not in broken_text

        # Simulate workdir after xz loop + files[] clobber; recover like the patch.
        workdir = td_path / "astra.work"
        workdir.mkdir()
        (workdir / "updatev3.manifest").write_text('type "complete"\n', encoding="utf-8")
        for name in ("omni.ja", "astra", "libxul.so"):
            (workdir / name).write_text(f"payload-{name}\n", encoding="utf-8")

        skip = {
            "updatev3.manifest",
            "mar-filelist.txt",
            "output.mar",
            "output.mar.tmp",
        }
        members = ["updatev3.manifest"] + sorted(
            (
                p.relative_to(workdir).as_posix()
                for p in workdir.rglob("*")
                if p.is_file() and p.name not in skip
            ),
            reverse=True,
        )
        filelist = workdir / "mar-filelist.txt"
        filelist.write_text("\n".join(members) + "\n", encoding="utf-8")
        assert len(members) == 4
        assert "old-dead-file" not in members
        assert "omni.ja" in members

        # Prefer Git Bash on Windows; skip shell probe if unavailable.
        bash = _find_bash()
        if bash:
            probe = td_path / "probe.sh"
            probe.write_text(
                textwrap.dedent(
                    f"""\
                    #!/bin/bash
                    set -euo pipefail
                    workdir="{workdir.as_posix()}"
                    files=("old-dead-file")
                    num_files=${{#files[*]}}
                    filelist="$workdir/mar-filelist.shell.txt"
                    {{
                      echo "updatev3.manifest"
                      (
                        cd "$workdir" || exit 1
                        find . -type f \\
                          ! -name 'updatev3.manifest' \\
                          ! -name 'mar-filelist.txt' \\
                          ! -name 'mar-filelist.shell.txt' \\
                          ! -name 'output.mar' \\
                          ! -name 'output.mar.tmp' \\
                          | sed 's|^\\./||' | sort -r
                      )
                    }} > "$filelist"
                    member_count="$(wc -l < "$filelist" | tr -d ' ')"
                    echo "count=$member_count"
                    test "$member_count" -ge 2
                    ! grep -q 'old-dead-file' "$filelist"
                    """
                ),
                encoding="utf-8",
                newline="\n",
            )
            out = subprocess.check_output([bash, str(probe)], text=True)
            assert "count=4" in out, out

        # End-to-end: create a real MAR from recovered filelist.
        mar_out = td_path / "out.mar"
        subprocess.check_call(
            [
                sys.executable,
                str(ROOT / "scripts" / "mar_create_from_filelist.py"),
                "-C",
                str(workdir),
                "-c",
                str(mar_out),
                "-H",
                "firefox-mozilla-central",
                "-V",
                "1.0.0",
                "-f",
                str(filelist),
            ]
        )
        assert mar_out.stat().st_size > 200
        # Partial-failure must not leave a stub dest.
        bad_list = td_path / "bad.txt"
        bad_list.write_text("updatev3.manifest\nmissing.bin\n", encoding="utf-8")
        stub = td_path / "stub.mar"
        stub.write_bytes(b"OLD")
        rc = subprocess.call(
            [
                sys.executable,
                str(ROOT / "scripts" / "mar_create_from_filelist.py"),
                "-C",
                str(workdir),
                "-c",
                str(stub),
                "-H",
                "firefox-mozilla-central",
                "-V",
                "1.0.0",
                "-f",
                str(bad_list),
            ]
        )
        assert rc != 0
        assert stub.read_bytes() == b"OLD"

    print("ok: patch recovers MAR members from workdir after files[] clobber")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
