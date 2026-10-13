// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Register Peppermint's merge drivers in this clone's git config and make
 * sure an `upstream` remote points at Zen. Safe to run repeatedly; it runs on
 * `npm install` and in the sync workflow.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
if (!fs.existsSync(path.join(root, ".git"))) {
  process.exit(0);
}

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

const drivers = {
  ours: { name: "Keep Peppermint's version", driver: "true" },
  "peppermint-surfer": {
    name: "surfer.json: Zen's file plus Peppermint identity",
    driver: "node peppermint/scripts/merge-driver.mjs surfer %O %A %B",
  },
  "peppermint-lockfile": {
    name: "package-lock.json: Zen's lock plus Peppermint name",
    driver: "node peppermint/scripts/merge-driver.mjs lockfile %O %A %B",
  },
};

for (const [key, { name, driver }] of Object.entries(drivers)) {
  git("config", `merge.${key}.name`, name);
  git("config", `merge.${key}.driver`, driver);
}

try {
  git("remote", "get-url", "upstream");
} catch {
  git("remote", "add", "upstream", "https://github.com/zen-browser/desktop.git");
}
console.log("setup-git: merge drivers registered");
