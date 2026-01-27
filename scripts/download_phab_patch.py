# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys
import requests

BASE_URI = "https://phabricator.services.mozilla.com"
OUTPUT_DIR = os.path.join(os.getcwd(), "src", "firefox-patches")


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
    print(f"Error downloading patch: {e}")
    sys.exit(1)


def main():
  if len(sys.argv) < 2:
    print("Usage: python download_phab_patch.py <PHABRICATOR_ID> [output_file]", file=sys.stderr)
    sys.exit(1)

  phab_id = sys.argv[1]
  output_file = sys.argv[2] if len(sys.argv) > 2 else f"phab_{phab_id}"
  output_file = os.path.join(OUTPUT_DIR, output_file + ".patch")

  download_phab_patch(phab_id, output_file)


if __name__ == "__main__":
  main()
