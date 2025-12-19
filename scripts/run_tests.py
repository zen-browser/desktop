# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys
import json
from pathlib import Path
from json_with_comments import JSONWithCommentsDecoder

IGNORE_PREFS_FILE_IN = os.path.join(
    'src', 'zen', 'tests', 'ignorePrefs.json'
)
IGNORE_PREFS_FILE_OUT = os.path.join(
    'engine', 'testing', 'mochitest', 'ignorePrefs.json'
)

MOCHITEST_NAME = "mochitests"


def copy_ignore_prefs():
  print("Copying ignorePrefs.json from src/zen/tests to engine/testing/mochitest...")
  # if there are prefs that dont exist on output file, copy them from input file
  all_prefs = []
  with open(IGNORE_PREFS_FILE_OUT, 'r') as f:
    all_prefs = json.load(f)
    with open(IGNORE_PREFS_FILE_IN, 'r') as f_in:
      new_prefs = json.load(f_in, cls=JSONWithCommentsDecoder)
      all_prefs.extend(p for p in new_prefs if p not in all_prefs)
  with open(IGNORE_PREFS_FILE_OUT, 'w') as f_out:
    json.dump(all_prefs, f_out, indent=2)


def main():
  copy_ignore_prefs()

  project_root = Path(__file__).resolve().parent.parent
  package_json = project_root / 'package.json'

  # Ensure script is run from project root
  if not package_json.exists():
    print("Please run this script from the root of the project", file=sys.stderr)
    sys.exit(1)

  args = sys.argv[1:]
  path = ""
  for arg in args:
    if not arg.startswith("--"):
      path = arg
      break

  # Collect any additional arguments
  other_args = [arg for arg in args if arg != path]

  engine_dir = project_root / 'engine'
  os.chdir(engine_dir)

  def run_mach_with_paths(test_paths):
    command = ['./mach', 'mochitest'] + other_args + test_paths
    # Replace the current process with the mach command
    os.execvp(command[0], command)

  if path in ("", "all"):
    test_dirs = [p for p in Path("zen/tests").iterdir() if p.is_dir() and p.name != MOCHITEST_NAME]
    mochitest_dirs = [p for p in Path(f"zen/tests/{MOCHITEST_NAME}").iterdir() if p.is_dir()]
    test_dirs.extend(mochitest_dirs)
    test_paths = [str(p) for p in test_dirs]
    run_mach_with_paths(test_paths)
  else:
    run_mach_with_paths([f"zen/tests/{path}"])

  # Return to original directory
  os.chdir(project_root)


if __name__ == "__main__":
  main()
