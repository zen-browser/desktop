#!/usr/bin/env python3
"""Patch Mozilla make_full_update.sh to avoid mar.exe ARG_MAX on Windows.

Upstream builds one giant argv via:
  targetfiles="$targetfiles \"$f\""
  eval "$mar_command $targetfiles"

mar.exe has no @response-file / list-file input, so on Windows/MSYS this fails
with "Argument list too long" once the member list is large enough. Replace the
eval with a file-list + scripts/mar_create_from_filelist.py invocation.
"""

from __future__ import annotations

import pathlib
import sys

# Exact bytes from tools/update-packaging/make_full_update.sh (backslash-escaped
# quotes around $workdir).
OLD = (
    'mar_command="$mar_command -C \\"$workdir\\" -c output.mar"\n'
    'eval "$mar_command $targetfiles"\n'
    'mv -f "$workdir/output.mar" "$archive"'
)


def build_new(repo_root_unix: str) -> str:
    root = repo_root_unix.rstrip("/")
    return f'''# Avoid Windows/MSYS ARG_MAX: mar.exe has no @filelist support, so do not
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
python "{root}/scripts/mar_create_from_filelist.py" \\
  -C "$workdir" \\
  -c output.mar \\
  -H "${{MAR_CHANNEL_ID:?}}" \\
  -V "${{MOZ_PRODUCT_VERSION:?}}" \\
  -f "$filelist"
mv -f "$workdir/output.mar" "$archive"'''


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(
            f"usage: {sys.argv[0]} MAKE_FULL_UPDATE.sh REPO_ROOT_UNIX",
            file=sys.stderr,
        )
        return 2
    script = pathlib.Path(argv[0])
    repo_root = argv[1]
    text = script.read_text(encoding="utf-8")
    if "mar_create_from_filelist.py" in text:
        print(f"already patched: {script}", file=sys.stderr)
        return 0
    if OLD not in text:
        idx = text.find('eval "$mar_command')
        excerpt = text[max(0, idx - 80) : idx + 120] if idx >= 0 else text[-200:]
        raise SystemExit(
            f"unexpected make_full_update.sh contents; cannot patch {script}\n"
            f"excerpt:\n{excerpt!r}"
        )
    script.write_text(text.replace(OLD, build_new(repo_root), 1), encoding="utf-8", newline="\n")
    print(f"Patched {script} to use mar_create_from_filelist.py", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
