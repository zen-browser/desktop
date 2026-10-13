// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Apply or revert the Peppermint overlay patches in peppermint/patches/.
 *
 *   node peppermint/scripts/apply-overlay.mjs apply    after `surfer import`
 *   node peppermint/scripts/apply-overlay.mjs revert   before `surfer import`
 *
 * Overlay patches change files that Zen or Firefox own. They are applied to
 * engine/ on top of Zen's own patches, so upstream merges never touch them.
 * Every patch that is applied is remembered under .dotbuild/ so that `revert`
 * can undo it exactly, which keeps Surfer's reverse-then-apply cycle working.
 */

import fs from "node:fs";
import path from "node:path";
import {
  engineDir,
  filesDir,
  git,
  listFiles,
  listOverlayPatches,
  materialize,
  patchTargets,
  root,
  runPatch,
  stateDir,
} from "./lib.mjs";

const appliedDir = path.join(stateDir, "applied");
const manifestFile = path.join(stateDir, "applied.json");

function readManifest() {
  return fs.existsSync(manifestFile)
    ? JSON.parse(fs.readFileSync(manifestFile, "utf8"))
    : [];
}

function writeManifest(list) {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(manifestFile, JSON.stringify(list, null, 1) + "\n");
}

function restorePristine(file) {
  // Fallback when a reverse patch cannot be applied: put the Firefox file
  // back; Surfer re-applies Zen's patches from scratch afterwards.
  try {
    git(["checkout", "HEAD", "--", file], engineDir);
    return true;
  } catch {
    return false;
  }
}

function revert() {
  const entries = readManifest().reverse();
  let reverted = 0;
  for (const entry of entries) {
    if (entry.replace) {
      // Whole-file replacement: Surfer relinks src files, Firefox files come
      // back from the pristine checkout.
      const file = path.join(engineDir, entry.replace);
      if (fs.existsSync(file) && !fs.lstatSync(file).isSymbolicLink()) {
        if (!restorePristine(entry.replace)) {
          fs.unlinkSync(file);
        }
      }
      reverted++;
      continue;
    }
    const stored = path.join(appliedDir, entry.id);
    for (const target of entry.targets) {
      const file = path.join(engineDir, target);
      if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink()) {
        continue;
      }
      if (!fs.existsSync(stored)) {
        restorePristine(target);
        continue;
      }
      const result = runPatch(
        ["-p1", "-R", "--batch", "--no-backup-if-mismatch", "-i", stored],
        engineDir
      );
      if (!result.ok) {
        // Zen-owned src files are re-linked by Surfer; Firefox files fall
        // back to the pristine checkout.
        if (!restorePristine(target) && entry.zenSource) {
          fs.unlinkSync(file);
        }
      }
    }
    reverted++;
  }
  writeManifest([]);
  fs.rmSync(appliedDir, { recursive: true, force: true });
  console.log(`apply-overlay: reverted ${reverted} overlay patches`);
}

function apply() {
  if (!fs.existsSync(path.join(engineDir, "mach"))) {
    console.warn("apply-overlay: engine/mach missing, skipping");
    return;
  }
  // Anything left from a previous run must go first.
  if (readManifest().length) {
    revert();
  }

  const patches = listOverlayPatches();
  const manifest = [];
  const failures = [];
  fs.mkdirSync(appliedDir, { recursive: true });

  for (const patchPath of patches) {
    const rel = path.relative(path.join(root, "peppermint", "patches"), patchPath);
    const text = fs.readFileSync(patchPath, "utf8");
    const targets = patchTargets(text);
    let zenSource = false;
    for (const target of targets) {
      zenSource ||= materialize(path.join(engineDir, target));
    }
    const result = runPatch(
      ["-p1", "--forward", "--batch", "--no-backup-if-mismatch", "-i", patchPath],
      engineDir
    );
    if (!result.ok) {
      failures.push({ rel, output: result.output.trim() });
      continue;
    }
    const id = rel.split(path.sep).join("__");
    fs.writeFileSync(path.join(appliedDir, id), text);
    manifest.push({ id, rel, targets, zenSource });
  }

  const replacements = listFiles(filesDir);
  for (const source of replacements) {
    const rel = path.relative(filesDir, source).split(path.sep).join("/");
    const dest = path.join(engineDir, rel);
    materialize(dest);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(source, dest);
    manifest.push({ id: `files__${rel.split("/").join("__")}`, replace: rel });
  }

  writeManifest(manifest);
  console.log(
    `apply-overlay: ${manifest.length - replacements.length}/${patches.length} overlay patches and ${replacements.length} replacement files applied`
  );
  if (failures.length) {
    for (const { rel, output } of failures) {
      const feature = rel.split(path.sep)[0];
      console.error(`\napply-overlay: FAILED ${rel} (feature: ${feature})\n${output}`);
    }
    console.error(
      "\nA failed patch means upstream changed the lines Peppermint edits.\n" +
        "Re-do the edit in engine/ and run: npm run pm:record -- <engine path> <feature>"
    );
    process.exit(1);
  }
}

const mode = process.argv[2];
if (mode === "apply") {
  apply();
} else if (mode === "revert") {
  revert();
} else {
  console.error("usage: apply-overlay.mjs apply|revert");
  process.exit(2);
}
