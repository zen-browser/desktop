# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# Note: You'll need to be on the root directory of the repo to run this script:
#       python3 src/browser/themes/shared/zen-icons/check_unused_icons.py

import os
import sys
import argparse

IGNORE_DIRS = ['node_modules', 'engine']


def get_all_icon_files(icon_dir):
  icon_files = []
  for root, _, files in os.walk(icon_dir):
    for file in files:
      if file.endswith('.svg'):
        icon_files.append(file)
  return icon_files


def find_icon_usage(icon_files):
  used_icons = set()
  for root, _, files in os.walk('src'):
    if any(ignored in root for ignored in IGNORE_DIRS):
      continue
    for file in files:
      # ignore jar files
      if file.endswith(('.mn')):
        continue
      try:
        with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
          content = f.read()
          for icon in icon_files:
            if icon in content:
              used_icons.add(icon)
      except BaseException:
        continue
  return used_icons


def main(args):
  parser = argparse.ArgumentParser(description='Check for unused zen icons.')
  parser.add_argument('--remove', action='store_true', help='Remove unused icons')
  parsed_args = parser.parse_args(args)

  icon_dir = 'src/browser/themes/shared/zen-icons/lin'
  icon_files = get_all_icon_files(icon_dir)
  used_icons = find_icon_usage(icon_files)

  unused_icons = set(icon_files) - used_icons

  if unused_icons:
    print("Unused icons:")
    for icon in sorted(unused_icons):
      if parsed_args.remove:
        os.remove(os.path.join(icon_dir, icon))
        print(f"Removed {icon}")
      else:
        print(icon)
  else:
    print("No unused icons found.")

  if parsed_args.remove:
    print("Unused icons removed.")
    os.chdir('src/browser/themes/shared/zen-icons')
    os.system("sh ./update-resources.sh")


if __name__ == "__main__":
  main(sys.argv[1:])
