// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Record an edit to a Zen/Firefox-owned engine file as a Peppermint overlay
 * patch.
 *
 *   npm run pm:record -- <engine path> [feature]
 *
 * Edit the file under engine/ (or src/ for Zen's own files), then run this.
 * The edit is diffed against Zen's version of the file and stored in
 * peppermint/patches/<feature>/. When the engine file is a symlink into src/,
 * the upstream copy under src/ is restored so that only the overlay patch
 * carries the change.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  engineDir,
  filesDir,
  git,
  listOverlayPatches,
  patchName,
  patchTargets,
  patchesDir,
  root,
  srcDir,
  tmpDir,
  zenOnlyContent,
} from "./lib.mjs";

export function recordPatch(input, feature, { source } = {}) {
  let rel = input.split(path.sep).join("/");
  for (const prefix of [`${engineDir}/`, "engine/", `${srcDir}/`, "src/"]) {
    if (rel.startsWith(prefix)) {
      rel = rel.slice(prefix.length);
      break;
    }
  }

  const enginePath = path.join(engineDir, rel);
  const current =
    source ??
    (fs.existsSync(enginePath) ? fs.readFileSync(enginePath) : null);
  if (!current) {
    throw new Error(`engine/${rel} does not exist`);
  }
  const reference = zenOnlyContent(rel);
  if (!reference) {
    throw new Error(
      `engine/${rel} has no Zen or Firefox original, so it belongs in src/peppermint/, not in an overlay patch.`
    );
  }

  // Binary assets cannot be diffed: keep a whole replacement file instead.
  if (reference.includes(0) || current.includes(0)) {
    const replacement = path.join(filesDir, rel);
    for (const existing of listOverlayPatches()) {
      if (patchTargets(fs.readFileSync(existing, "utf8")).includes(rel)) {
        fs.rmSync(existing);
      }
    }
    if (reference.equals(current)) {
      fs.rmSync(replacement, { force: true });
      console.log(`pm:record: engine/${rel} matches Zen, no replacement needed`);
      return null;
    }
    fs.mkdirSync(path.dirname(replacement), { recursive: true });
    fs.writeFileSync(replacement, current);
    console.log(`pm:record: stored replacement ${path.relative(root, replacement)}`);
    return replacement;
  }

  const work = tmpDir("pm-record-");
  let diff;
  try {
    fs.writeFileSync(path.join(work, "a"), reference);
    fs.writeFileSync(path.join(work, "b"), current);
    const result = spawnSync(
      "diff",
      ["-u", "--label", `a/${rel}`, "--label", `b/${rel}`, "a", "b"],
      { cwd: work, encoding: "utf8", maxBuffer: 1 << 28 }
    );
    if (result.status > 1) {
      throw new Error(result.stderr);
    }
    diff = result.status === 1 ? result.stdout : "";
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }

  // Remove any older patch for this file, wherever it was filed.
  let previousFeature = null;
  for (const existing of listOverlayPatches()) {
    if (patchTargets(fs.readFileSync(existing, "utf8")).includes(rel)) {
      previousFeature = path.basename(path.dirname(existing));
      fs.rmSync(existing);
    }
  }

  if (!diff) {
    console.log(`pm:record: engine/${rel} matches Zen, no overlay patch needed`);
    return null;
  }

  const target = feature || previousFeature;
  if (!target) {
    throw new Error("A feature name is required for a new overlay patch.");
  }
  const out = path.join(patchesDir, target, patchName(rel));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, diff);
  console.log(`pm:record: wrote ${path.relative(root, out)}`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [input, feature] = process.argv.slice(2);
  if (!input) {
    console.error("usage: npm run pm:record -- <engine path> [feature]");
    process.exit(2);
  }
  let rel = input;
  const out = recordPatch(input, feature);
  if (out && !process.env.PM_KEEP_SRC) {
    // Restore upstream's copy when the edit was made through a symlink.
    for (const prefix of [`${engineDir}/`, "engine/", `${srcDir}/`, "src/"]) {
      if (rel.startsWith(prefix)) {
        rel = rel.slice(prefix.length);
        break;
      }
    }
    const srcFile = path.join(srcDir, rel);
    if (fs.existsSync(srcFile)) {
      try {
        git(["checkout", process.env.PM_BASE_REF || "HEAD", "--", `src/${rel}`], root);
        console.log(`pm:record: restored upstream src/${rel}`);
      } catch {
        // File is not tracked upstream.
      }
    }
  }
}
