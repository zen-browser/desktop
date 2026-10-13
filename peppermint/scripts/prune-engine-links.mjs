// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Surfer links every src/ file into engine/ but never removes links for files
 * that were deleted or moved. Drop those dangling links (and the directories
 * they leave empty) so a stale engine/ never builds code that no longer exists.
 */

import fs from "node:fs";
import path from "node:path";
import { engineDir, srcDir } from "./lib.mjs";

function prune(dir) {
  let removed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      if (!fs.existsSync(full)) {
        fs.unlinkSync(full);
        removed++;
      }
    } else if (entry.isDirectory()) {
      removed += prune(full);
      if (fs.readdirSync(full).length === 0) {
        fs.rmdirSync(full);
      }
    }
  }
  return removed;
}

let total = 0;
for (const group of fs.readdirSync(srcDir, { withFileTypes: true })) {
  const target = path.join(engineDir, group.name);
  if (group.isDirectory() && fs.existsSync(target)) {
    total += prune(target);
  }
}
// Directories that moved out of src/ entirely.
for (const gone of ["zen/adblock", "zen/cookie-consent", "zen/ghost-mode", "zen/homepage", "zen/notepad", "zen/underpowered", "zen/url-snippets"]) {
  const target = path.join(engineDir, gone);
  if (fs.existsSync(target) && !fs.existsSync(path.join(srcDir, gone))) {
    total += prune(target);
  }
}
console.log(`prune-engine-links: removed ${total} dangling links`);
