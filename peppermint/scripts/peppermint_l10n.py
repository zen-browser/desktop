# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

"""Peppermint's localization layer.

Zen's locale files stay exactly as upstream ships them. When they are copied
into engine/ (scripts/copy_language_pack.py calls ``finalize``), this module:

* merges Peppermint's own en-US messages from peppermint/locales/en-US on top
  of the Zen en-US files (message by message, not line by line, so upstream
  edits to other messages never conflict);
* rebrands user-visible text in every language using
  peppermint/l10n-rebrand.json, leaving identifiers and comments alone.
"""

import json
import os
import re
import shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OVERRIDES = os.path.join(ROOT, "peppermint", "locales", "en-US", "browser")
RULES_FILE = os.path.join(ROOT, "peppermint", "l10n-rebrand.json")

ID_LINE = re.compile(r"^(-?[A-Za-z][\w-]*\s*=\s?)(.*)$")
ATTR_LINE = re.compile(r"^(\s+\.[\w-]+\s*=\s?)(.*)$")


def load_rules():
  if not os.path.exists(RULES_FILE):
    return {"replacements": [], "exact": []}
  with open(RULES_FILE, encoding="utf-8") as f:
    return json.load(f)


# --- Fluent block parsing -------------------------------------------------


def parse_blocks(text):
  """Split an .ftl file into blocks: [{"id": str|None, "lines": [str]}].

  A block is a message or term with its directly preceding comment lines and
  its continuation lines. Blank lines stay attached to the block before them.
  """
  lines = text.split("\n")
  segments = []
  for line in lines:
    starts = bool(line) and not line[0].isspace()
    if starts or not segments:
      segments.append([line])
    else:
      segments[-1].append(line)

  blocks = []
  pending_comments = []
  for seg in segments:
    head = seg[0]
    match = ID_LINE.match(head)
    if match:
      blocks.append({"id": match.group(1).split("=")[0].strip(), "lines": pending_comments + seg})
      pending_comments = []
    elif head.startswith("#") and seg[-1].strip():
      # Comment directly attached to what follows (no trailing blank line).
      pending_comments.extend(seg)
    else:
      if pending_comments:
        blocks.append({"id": None, "lines": pending_comments})
        pending_comments = []
      blocks.append({"id": None, "lines": seg})
  if pending_comments:
    blocks.append({"id": None, "lines": pending_comments})
  return blocks


def block_body(block):
  """Block text without trailing blank lines, used for comparisons."""
  lines = list(block["lines"])
  while lines and not lines[-1].strip():
    lines.pop()
  return "\n".join(lines)


def trailing_blank(block):
  count = 0
  for line in reversed(block["lines"]):
    if line.strip():
      break
    count += 1
  return count


def render(blocks):
  return "\n".join(line for block in blocks for line in block["lines"])


def merge_overrides(upstream_text, override_text):
  """Replace/append Peppermint messages onto a Zen en-US file."""
  overrides = {b["id"]: b for b in parse_blocks(override_text) if b["id"]}
  removals = set(re.findall(r"^# peppermint: remove (\S+)\s*$", override_text, re.M))
  used = set()
  out = []
  for block in parse_blocks(upstream_text):
    ident = block["id"]
    if ident in removals:
      continue
    if ident in overrides:
      replacement = overrides[ident]
      used.add(ident)
      out.append({"id": ident, "lines": replacement["lines"][: len(replacement["lines"]) - trailing_blank(replacement)] + [""] * max(trailing_blank(block), 0)})
    else:
      out.append(block)
  additions = [b for ident, b in overrides.items() if ident not in used]
  if additions:
    # Keep one blank line between the Zen content and Peppermint additions.
    if out and out[-1]["lines"] and out[-1]["lines"][-1].strip():
      out[-1] = {"id": out[-1]["id"], "lines": out[-1]["lines"] + [""]}
    for block in additions:
      out.append(block)
  return render(out)


# --- Rebranding ----------------------------------------------------------


def rebrand_value(value, rules):
  for rule in rules["replacements"]:
    value = value.replace(rule["from"], rule["to"])
  return value


def rebrand_text(text, rules=None):
  rules = rules or load_rules()
  exact = {r["key"]: r for r in rules["exact"]}
  out = []
  current_key = None
  for line in text.split("\n"):
    if line.startswith("#"):
      out.append(line)
      continue
    id_match = ID_LINE.match(line)
    attr_match = ATTR_LINE.match(line)
    if id_match:
      current_key = id_match.group(1).split("=")[0].strip()
      value = id_match.group(2)
      rule = exact.get(current_key)
      if rule and value.strip() == rule["from"]:
        value = rule["to"]
      out.append(id_match.group(1) + rebrand_value(value, rules))
    elif attr_match:
      out.append(attr_match.group(1) + rebrand_value(attr_match.group(2), rules))
    else:
      out.append(rebrand_value(line, rules))
  return "\n".join(out)


# --- Entry point ---------------------------------------------------------


def finalize(lang_dir, lang_id):
  """Called after a language pack was copied to ``lang_dir``."""
  rules = load_rules()

  if lang_id == "en-US" and os.path.isdir(OVERRIDES):
    for root, _, files in os.walk(OVERRIDES):
      relative = os.path.relpath(root, OVERRIDES)
      for name in files:
        override = os.path.join(root, name)
        target = os.path.normpath(os.path.join(lang_dir, relative, name))
        with open(override, encoding="utf-8") as f:
          override_text = f.read()
        if os.path.exists(target):
          with open(target, encoding="utf-8") as f:
            merged = merge_overrides(f.read(), override_text)
        else:
          os.makedirs(os.path.dirname(target), exist_ok=True)
          merged = override_text
        with open(target, "w", encoding="utf-8") as f:
          f.write(merged)

  for root, _, files in os.walk(lang_dir):
    for name in files:
      if not name.endswith(".ftl") or not name.startswith("zen"):
        continue
      path = os.path.join(root, name)
      with open(path, encoding="utf-8") as f:
        original = f.read()
      rebranded = rebrand_text(original, rules)
      if rebranded != original:
        with open(path, "w", encoding="utf-8") as f:
          f.write(rebranded)
