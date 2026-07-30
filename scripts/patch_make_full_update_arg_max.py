#!/usr/bin/env python3
"""Patch Mozilla make_full_update.sh to avoid mar.exe ARG_MAX on Windows.

Upstream builds one giant argv via:
  targetfiles="$targetfiles \"$f\""
  eval "$mar_command $targetfiles"

mar.exe has no @response-file / list-file input, so on Windows/MSYS this fails
with "Argument list too long" once the member list is large enough. Replace the
eval with a file-list + scripts/mar_create_from_filelist.py invocation.

IMPORTANT: append_remove_instructions() in tools/update-packaging/common.sh
clobbers the global `files` / `num_files` bash arrays by re-reading
`removed-files`. Do NOT rebuild the MAR member list from those arrays after
that call — recover members from `$workdir` (already populated by the xz
loop) or from the still-intact `targetfiles` string.
"""

from __future__ import annotations

import pathlib
import re
import sys

# Exact bytes from tools/update-packaging/make_full_update.sh (backslash-escaped
# quotes around $workdir).
OLD = (
    'mar_command="$mar_command -C \\"$workdir\\" -c output.mar"\n'
    'eval "$mar_command $targetfiles"\n'
    'mv -f "$workdir/output.mar" "$archive"'
)

# Prior broken patch: rebuilt filelist from files/num_files AFTER
# append_remove_instructions clobbered them, producing 1-member stub MARs.
BROKEN_PATCH_RE = re.compile(
    r"# Avoid Windows/MSYS ARG_MAX:.*?mv -f \"\$workdir/output\.mar\" \"\$archive\"",
    re.DOTALL,
)


def build_new(repo_root_unix: str) -> str:
    root = repo_root_unix.rstrip("/")
    return f'''# Avoid Windows/MSYS ARG_MAX: mar.exe has no @filelist support, so do not
# eval thousands of paths onto one command line. Write a list and create the
# MAR with a Python helper that mirrors libmar mar_create().
#
# NOTE: append_remove_instructions clobbers the global files/num_files arrays
# (it reuses those names for removed-files). Recover MAR members from workdir,
# which already holds xz-compressed copies of every packaged file.
filelist="$workdir/mar-filelist.txt"
{{
  echo "updatev3.manifest"
  (
    cd "$workdir" || exit 1
    find . -type f \\
      ! -name 'updatev3.manifest' \\
      ! -name 'mar-filelist.txt' \\
      ! -name 'output.mar' \\
      ! -name 'output.mar.tmp' \\
      | sed 's|^\\./||' | sort -r
  )
}} > "$filelist"
member_count="$(wc -l < "$filelist" | tr -d ' ')"
echo "mar filelist: ${{member_count}} members -> $workdir/output.mar"
if [ "${{member_count}}" -lt 2 ]; then
  echo "ERROR: MAR filelist has only ${{member_count}} member(s); expected updatev3.manifest + packaged files" >&2
  echo "--- filelist ---" >&2
  cat "$filelist" >&2 || true
  echo "--- workdir (top) ---" >&2
  ls -la "$workdir" >&2 || true
  exit 1
fi
python "{root}/scripts/mar_create_from_filelist.py" \\
  -C "$workdir" \\
  -c output.mar \\
  -H "${{MAR_CHANNEL_ID:?}}" \\
  -V "${{MOZ_PRODUCT_VERSION:?}}" \\
  -f "$filelist" || exit 1
test -s "$workdir/output.mar" || exit 1
mv -f "$workdir/output.mar" "$archive" || exit 1'''


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

    new_block = build_new(repo_root)

    # Re-patch if a previous broken filelist-from-files[] patch is present.
    if "mar_create_from_filelist.py" in text:
        if 'find . -type f' in text and "append_remove_instructions clobbers" in text:
            print(f"already patched (workdir filelist): {script}", file=sys.stderr)
            return 0
        match = BROKEN_PATCH_RE.search(text)
        if not match:
            raise SystemExit(
                f"make_full_update.sh already references mar_create_from_filelist.py "
                f"but the patch block was not recognized; refusing to modify {script}"
            )
        text = text[: match.start()] + new_block + text[match.end() :]
        script.write_text(text, encoding="utf-8", newline="\n")
        print(
            f"Re-patched {script} to recover MAR members from workdir "
            f"(append_remove_instructions clobber fix)",
            file=sys.stderr,
        )
        return 0

    if OLD not in text:
        idx = text.find('eval "$mar_command')
        excerpt = text[max(0, idx - 80) : idx + 120] if idx >= 0 else text[-200:]
        raise SystemExit(
            f"unexpected make_full_update.sh contents; cannot patch {script}\n"
            f"excerpt:\n{excerpt!r}"
        )
    script.write_text(text.replace(OLD, new_block, 1), encoding="utf-8", newline="\n")
    print(f"Patched {script} to use mar_create_from_filelist.py", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
