import os
import shutil
import subprocess
from pathlib import Path

FILES = [
    "index.d.ts",
    "lib.gecko.darwin.d.ts",
    "lib.gecko.dom.d.ts",
    "lib.gecko.glean.d.ts",
    "lib.gecko.linux.d.ts",
    "lib.gecko.modules.d.ts",
    "lib.gecko.nsresult.d.ts",
    "lib.gecko.services.d.ts",
    "lib.gecko.tweaks.d.ts",
    "lib.gecko.win32.d.ts",
    "lib.gecko.xpcom.d.ts",
    "lib.gecko.xpidl.d.ts",
]

ENGINE_PATH = Path("engine") / "tools" / "@types"
SRC_PATH = Path("src") / "zen" / "@types"

def run_command(cmd_list, cwd=None):
    try:
        subprocess.run(cmd_list, cwd=cwd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Command {' '.join(cmd_list)} failed with error: {e}")
        exit(1)

def update_ts_types():
    # Run the TypeScript build and update commands
    run_command(["./mach", "ts", "build"], cwd="engine")
    run_command(["./mach", "ts", "update"], cwd="engine")

    # Copy files
    for file_name in FILES:
        src_file = ENGINE_PATH / file_name
        dest_file = SRC_PATH / file_name

        if src_file.exists():
            dest_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_file, dest_file)
            print(f"Copied {src_file} -> {dest_file}")
        else:
            print(f"File {src_file} does not exist.")

    # Add zen.d.ts reference if not already present
    index_file = SRC_PATH / "index.d.ts"
    reference_line = '/// <reference types="./zen.d.ts" />\n'

    if not index_file.exists():
        print(f"{index_file} does not exist. Skipping reference update.")
        return

    with index_file.open("r+") as f:
        content = f.read()
        if reference_line not in content:
            f.write("\n" + reference_line + "\n")
            print("Added zen.d.ts reference to index.d.ts")
        else:
            print("zen.d.ts reference already present in index.d.ts")

if __name__ == "__main__":
    update_ts_types()
    print("✅ Updated TypeScript types.")
