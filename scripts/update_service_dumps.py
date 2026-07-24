# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import json
from json_with_comments import JSONWithCommentsDecoder

DUMPS_FOLDER = os.path.join(
    'configs', 'dumps'
)
ENGINE_DUMPS_FOLDER = os.path.join(
    'engine', 'services', 'settings', 'dumps', 'main'
)


def _should_remove(identifier, remove_ids):
  return any(
      identifier == rid or
      (rid.endswith('*') and identifier.startswith(rid[:-1]))
      for rid in remove_ids
  )


def merge_dumps(original, updates):
  """Apply Astra dump overlays: remove listed identifiers, then append adds."""
  remove_ids = updates.get('remove', {"identifiers": []}).get('identifiers', [])

  # Filter out entries in original that are in remove_ids.
  # We may find example-* patterns, so we need to handle that as well.
  merged_data = [
      entry for entry in original.get('data', [])
      if not _should_remove(entry.get('identifier', ''), remove_ids)
  ]

  existing_ids = {
      entry.get('identifier')
      for entry in merged_data
      if entry.get('identifier')
  }

  # Optional adds (engines or other records with an identifier).
  for entry in updates.get('add', {}).get('engines', []):
    identifier = entry.get('identifier')
    if not identifier:
      raise ValueError('add.engines entry missing identifier')
    if identifier in existing_ids:
      continue
    if _should_remove(identifier, remove_ids):
      continue
    merged_data.append(entry)
    existing_ids.add(identifier)

  return {
      'data': merged_data,
      **{k: v for k, v in original.items() if k != 'data'},
      'timestamp': updates.get('timestamp', original.get('timestamp'))
  }


def apply_icon_shares(icon_dump_path, icon_shares):
  """Attach extra engineIdentifiers to existing icon records (no new blobs)."""
  if not icon_shares or not os.path.exists(icon_dump_path):
    return False

  with open(icon_dump_path, 'r', encoding='utf-8') as f:
    original_content = f.read()
    original_content = '\n'.join(
        line for line in original_content.split('\n') if not line.lstrip(' ').startswith('//')
    )
    icon_data = json.loads(original_content)

  changed = False
  for share in icon_shares:
    existing = share.get('existingIdentifier')
    also_match = share.get('alsoMatch') or []
    if not existing or not also_match:
      continue
    for entry in icon_data.get('data', []):
      ids = entry.get('engineIdentifiers') or []
      if existing not in ids:
        continue
      for extra in also_match:
        if extra not in ids:
          ids.append(extra)
          changed = True
      entry['engineIdentifiers'] = ids

  if changed:
    with open(icon_dump_path, 'w', encoding='utf-8') as f:
      json.dump(icon_data, f, indent=2, ensure_ascii=False)
  return changed


def main():
  for filename in os.listdir(DUMPS_FOLDER):
    if filename.endswith('.json'):
      # parse json with comments
      with open(os.path.join(DUMPS_FOLDER, filename), 'r') as f:
        data = json.load(f, cls=JSONWithCommentsDecoder)
      original_path = os.path.join(ENGINE_DUMPS_FOLDER, filename)
      if os.path.exists(original_path):
        with open(original_path, 'r', encoding='utf-8') as f:
          original_content = f.read()
          original_content = '\n'.join(
              line for line in original_content.split('\n') if not line.lstrip(' ').startswith('//')
          )
          original_data = json.loads(original_content)
        merged_data = merge_dumps(original_data, data)
        with open(original_path, 'w', encoding='utf-8') as f:
          json.dump(merged_data, f, indent=2, ensure_ascii=False)
        print(f"Updated dump: {filename}")

        icon_shares = data.get('iconShares')
        if icon_shares:
          icons_path = os.path.join(ENGINE_DUMPS_FOLDER, 'search-config-icons.json')
          if apply_icon_shares(icons_path, icon_shares):
            print(f"Updated icon shares from: {filename}")
      else:
        print(f"Original dump file not found: {original_path}")
        exit(1)


if __name__ == "__main__":
  main()
