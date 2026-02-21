# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys
import json
import requests
from json_with_comments import JSONWithCommentsDecoder

BASE_URI = "https://phabricator.services.mozilla.com"
OUTPUT_DIR = os.path.join(os.getcwd(), "src", "external-patches")


def die(message):
  print(f"Error: {message}")
  sys.exit(1)


def download_phab_patch(phab_id, output_file):
  """Download a Phabricator patch by its ID and save it to output_file."""
  patch_url = f"{BASE_URI}/{phab_id}?download=true"
  try:
    print(f"Downloading patch from {patch_url}")
    response = requests.get(patch_url)
    response.raise_for_status()  # Raise an error for bad responses
    with open(output_file, 'wb') as f:
      f.write(response.content)
    print(f"Patch saved to {output_file}")
  except requests.RequestException as e:
    die(f"Failed to download patch {phab_id}: {e}")


def download_patch_from_url(url, output_file):
  """Download a patch from a given URL and save it to output_file."""
  try:
    print(f"Downloading patch from {url}")
    response = requests.get(url)
    response.raise_for_status()  # Raise an error for bad responses
    with open(output_file, 'wb') as f:
      f.write(response.content)
    print(f"Patch saved to {output_file}")
  except requests.RequestException as e:
    die(f"Failed to download patch from {url}: {e}")


def main():
  with open(os.path.join(OUTPUT_DIR, "manifest.json"), 'r') as f:
    manifest = json.load(f, cls=JSONWithCommentsDecoder)

  expected_files = set()
  for patch in manifest:
    if patch.get("type") == "phabricator":
      phab_id = patch.get("id")
      name = patch.get("name")
      if not phab_id or not name:
        die(f"Patch entry missing 'id' or 'name': {patch}")
      name = name.replace(" ", "_").lower()
      output_file = os.path.join(OUTPUT_DIR, "firefox", f"{name}.patch")
      print(f"Processing Phabricator patch: {phab_id} -> {output_file}")
      download_phab_patch(phab_id, output_file)
      replaces = patch.get("replaces", {})
      for replace in replaces.keys():
        value = replaces[replace]
        with open(output_file, 'r') as f:
          content = f.read()
        if replace not in content:
          die(f"Replace string '{replace}' not found in {output_file}")
        with open(output_file, 'w') as f:
          f.write(content.replace(replace, value))
      expected_files.add(output_file)
    elif patch.get("type") == "local":
      print(f"Local patch: {patch.get('path')}")
      expected_files.add(os.path.join(OUTPUT_DIR, patch.get("path")))
    elif patch.get("type") == "patch":
      url = patch.get("url")
      dest = patch.get("dest")
      if not url or not dest:
        die(f"Patch entry missing 'url' or 'dest': {patch}")
      filename = url.split("/")[-1]
      output_file = os.path.join(OUTPUT_DIR, dest, filename)
      download_patch_from_url(url, output_file)
      replaces = patch.get("replaces", {})
      for replace in replaces.keys():
        value = replaces[replace]
        with open(output_file, 'r') as f:
          content = f.read()
        if replace not in content:
          die(f"Replace string '{replace}' not found in {output_file}")
        with open(output_file, 'w') as f:
          f.write(content.replace(replace, value))
      expected_files.add(output_file)
    else:
      die(f"Unknown patch type: {patch.get('type')}")

  # Check for unexpected files in the output directory
  # and remove them if they are not in the expected_files set.
  for root, dirs, files in os.walk(OUTPUT_DIR):
    for file in files:
      if file.endswith(".patch"):
        file_path = os.path.join(root, file)
        if file_path not in expected_files:
          print(f"Removing unexpected patch file: {file_path}")
          os.remove(file_path)


if __name__ == "__main__":
  main()
