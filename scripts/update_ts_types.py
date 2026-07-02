# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os

FILES = [
    "index.d.ts",
    "lib.gecko.tweaks.d.ts",
    "lib.gecko.xpidl.d.ts",
]

GENERATED_FILES = [
    "lib.gecko.win32.d.ts",
    "lib.gecko.xpcom.d.ts",
    "lib.gecko.darwin.d.ts",
    "lib.gecko.dom.d.ts",
    "lib.gecko.glean.d.ts",
    "lib.gecko.linux.d.ts",
    "lib.gecko.modules.d.ts",
    "lib.gecko.nsresult.d.ts",
    "lib.gecko.services.d.ts",
]

ENGINE_PATH = os.path.join("engine", "tools", "@types")
GENERATED_PATH = os.path.join(ENGINE_PATH, "generated")
SRC_PATH = os.path.join("src", "zen", "@types")


def update_ts_types():
  os.system("cd engine && ./mach ts build && ./mach ts update")
  # copy the files from engine/tools/@types to src/@types
  for file in FILES + GENERATED_FILES:
    if file in GENERATED_FILES:
      src_file = os.path.join(GENERATED_PATH, file)
    else:
      src_file = os.path.join(ENGINE_PATH, file)
    dest_file = os.path.join(SRC_PATH, file)
    if os.path.exists(src_file):
      os.system(f"cp {src_file} {dest_file}")
    else:
      print(f"File {src_file} does not exist.")

  # add zen.d.ts to the end of index.d.ts
  with open(os.path.join(SRC_PATH, "index.d.ts"), "a") as f:
    f.write("\n")
    f.write('/// <reference types="./zen.d.ts" />\n')
    f.write('\n')


if __name__ == "__main__":
  update_ts_types()
  print("Updated TypeScript types.")
