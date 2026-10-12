// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Apply all patch files under src/ into engine/ with GNU patch.
 *
 * Surfer uses `git apply`, which skips paths under engine/ because the desktop
 * repo gitignores that tree — so imports look successful while moz.build,
 * browser.xhtml, jar.mn, etc. never change.
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const engineDir = path.join(root, "engine");
const srcDir = path.join(root, "src");

const PATCH_CANDIDATES = [
  process.env.PATCH_EXE,
  "C:/mozilla-build/msys2/usr/bin/patch.exe",
  "C:/mozilla-build/bin/patch.exe",
  "/opt/homebrew/bin/gpatch",
  "/usr/local/bin/gpatch",
].filter(Boolean);

function findOnPath(name) {
  const locator = process.platform === "win32" ? "where" : "which";
  const found = spawnSync(locator, [name], { encoding: "utf8" });
  if (found.status !== 0) {
    return null;
  }
  const line = found.stdout.split(/\r?\n/).find(Boolean);
  return line && fs.existsSync(line.trim()) ? line.trim() : null;
}

function findPatchExe() {
  for (const candidate of PATCH_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  // GNU patch is named gpatch on Homebrew. Windows `where` is not a
  // command in /bin/sh, so Unix looks up `which` instead.
  return findOnPath("gpatch") || findOnPath("patch");
}

function listPatchFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listPatchFiles(full));
    } else if (entry.name.endsWith(".patch") && !entry.name.endsWith(".patch.new")) {
      out.push(full);
    }
  }
  return out.sort();
}

const patchExe = findPatchExe();
if (!patchExe) {
  console.error(
    "apply-engine-patches: GNU patch not found. Install MozillaBuild or set PATCH_EXE.",
  );
  process.exit(1);
}

if (!fs.existsSync(path.join(engineDir, "mach"))) {
  console.warn("apply-engine-patches: engine/mach missing, skipping");
  process.exit(0);
}

const patches = listPatchFiles(srcDir);
let applied = 0;
let skipped = 0;
let failed = 0;

for (const patchPath of patches) {
  const rel = path.relative(root, patchPath);
  try {
    execFileSync(
      patchExe,
      ["-p1", "--forward", "--batch", "-i", patchPath],
      {
        cwd: engineDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    applied++;
  } catch (error) {
    const stderr = `${error.stdout ?? ""}${error.stderr ?? ""}${error.message}`;
    if (
      /Skipping patch|already applied|hunk.*ignored|Reversed \(or previously applied\)/i.test(
        stderr,
      )
    ) {
      skipped++;
      continue;
    }
    failed++;
    console.warn(`apply-engine-patches: ${rel} — ${stderr.split("\n")[0]}`);
  }
}

console.log(
  `apply-engine-patches: ${patches.length} patches (${applied} applied, ${skipped} skipped, ${failed} failed)`,
);

if (failed > 0) {
  process.exit(1);
}
