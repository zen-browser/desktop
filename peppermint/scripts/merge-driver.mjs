// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Git merge drivers for files that Zen churns constantly but where Peppermint
 * only owns a handful of identity fields.
 *
 *   merge-driver.mjs surfer   %O %A %B   surfer.json: Zen's file + Peppermint identity
 *   merge-driver.mjs lockfile %O %A %B   package-lock.json: Zen's lock + Peppermint name
 *   merge-driver.mjs apply surfer|lockfile [file]   re-apply identity in place
 *
 * Registered by peppermint/scripts/setup-git.mjs and selected in .gitattributes.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const identity = JSON.parse(
  fs.readFileSync(path.join(root, "peppermint", "identity.json"), "utf8")
);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function trailing(file) {
  return fs.readFileSync(file, "utf8").endsWith("\n") ? "\n" : "";
}

export function applySurferIdentity(data) {
  for (const key of ["name", "vendor", "appId", "binaryName", "updateHostname"]) {
    data[key] = identity[key];
  }
  for (const [brand, fields] of Object.entries(identity.brands)) {
    if (!data.brands?.[brand]) {
      continue;
    }
    Object.assign(data.brands[brand], fields);
    if (data.brands[brand].release?.github) {
      data.brands[brand].release.github.repo = identity.repository;
    }
  }
  return data;
}

export function applyLockfileIdentity(data) {
  data.name = identity.npmName;
  if (data.packages?.[""]) {
    data.packages[""].name = identity.npmName;
  }
  return data;
}

const appliers = { surfer: applySurferIdentity, lockfile: applyLockfileIdentity };

function write(file, data, newline) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + newline);
}

const [mode, ...args] = process.argv.slice(2);

if (mode === "apply") {
  const kind = args[0];
  const file = args[1] || (kind === "surfer" ? "surfer.json" : "package-lock.json");
  const target = path.resolve(file);
  write(target, appliers[kind](readJson(target)), trailing(target));
  console.log(`merge-driver: applied Peppermint identity to ${file}`);
} else if (appliers[mode]) {
  // Git passes %O (base), %A (ours, also the output) and %B (theirs).
  const [, ours, theirs] = args;
  const newline = trailing(theirs);
  write(ours, appliers[mode](readJson(theirs)), newline);
  process.exit(0);
} else {
  console.error("usage: merge-driver.mjs surfer|lockfile %O %A %B | apply <kind> [file]");
  process.exit(2);
}
