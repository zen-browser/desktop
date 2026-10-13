// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Shared helpers for the Peppermint overlay tooling.
 *
 * Layout recap:
 *   src/                      Zen's tree (never edited for Peppermint changes)
 *   src/peppermint/           Peppermint-owned code, symlinked into engine/peppermint
 *   peppermint/patches/       one patch per edited engine file, grouped by feature
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
export const engineDir = path.join(root, "engine");
export const srcDir = path.join(root, "src");
export const patchesDir = path.join(root, "peppermint", "patches");
export const filesDir = path.join(root, "peppermint", "files");
export const stateDir = path.join(root, ".dotbuild", "peppermint-overlay");

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

export function findPatchExe() {
  for (const candidate of PATCH_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  const exe = findOnPath("gpatch") || findOnPath("patch");
  if (!exe) {
    throw new Error(
      "GNU patch not found. Install MozillaBuild/gpatch or set PATCH_EXE."
    );
  }
  return exe;
}

/** Recursively list files below dir, returning absolute paths. */
export function listFiles(dir, predicate = () => true, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(full, predicate, out);
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

/** Overlay patches sorted so that application order is stable. */
export function listOverlayPatches() {
  return listFiles(patchesDir, f => f.endsWith(".patch")).sort();
}

/** Files a unified diff touches, taken from its `+++ b/...` headers. */
export function patchTargets(patchText) {
  const targets = [];
  for (const line of patchText.split("\n")) {
    const match = /^\+\+\+ b\/(\S+)/.exec(line);
    if (match) {
      targets.push(match[1]);
    }
  }
  return targets;
}

export function patchName(engineRelPath) {
  return engineRelPath.split("/").join("__") + ".patch";
}

/** Replace an engine symlink (into src/) by a regular copy of its target. */
export function materialize(file) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (stat?.isSymbolicLink()) {
    const content = fs.readFileSync(file);
    fs.unlinkSync(file);
    fs.writeFileSync(file, content);
    return true;
  }
  return false;
}

export function runPatch(args, cwd, input) {
  const result = spawnSync(findPatchExe(), args, {
    cwd,
    input,
    encoding: "utf8",
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

export function git(args, cwd = root, options = {}) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 1 << 28,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

export function gitShow(cwd, spec) {
  try {
    return execFileSync("git", ["show", spec], {
      cwd,
      encoding: "buffer",
      maxBuffer: 1 << 28,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

export function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Compute what an engine file looks like with only Zen's own changes: the
 * pristine Firefox file (engine HEAD) or Zen's src copy, followed by every
 * Zen .patch under src/ that targets it. Returns a Buffer, or null when the
 * file does not exist in that state.
 */
export function zenOnlyContent(relPath) {
  const srcFile = path.join(srcDir, relPath);
  const srcTracked = gitShowSrc(relPath);
  if (srcTracked) {
    return srcTracked;
  }
  if (fs.existsSync(srcFile) && !relPath.endsWith(".patch")) {
    // Untracked src file: nothing upstream to diff against.
    return null;
  }

  const patches = listFiles(srcDir, f => f.endsWith(".patch")).sort();
  const relevant = [];
  for (const patch of patches) {
    const text = fs.readFileSync(patch, "utf8");
    if (patchTargets(text).includes(relPath)) {
      relevant.push({ patch, text });
    }
  }

  const work = tmpDir("pm-zenonly-");
  try {
    const pristine = gitShow(engineDir, `HEAD:${relPath}`);
    if (pristine) {
      fs.mkdirSync(path.dirname(path.join(work, relPath)), { recursive: true });
      fs.writeFileSync(path.join(work, relPath), pristine);
    }
    for (const { patch, text } of relevant) {
      // Seed any other file the patch touches so multi-file patches apply.
      for (const other of patchTargets(text)) {
        const dest = path.join(work, other);
        if (!fs.existsSync(dest)) {
          const content = gitShow(engineDir, `HEAD:${other}`);
          if (content) {
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, content);
          }
        }
      }
      const result = runPatch(
        ["-p1", "--forward", "--batch", "--no-backup-if-mismatch", "-i", patch],
        work
      );
      if (!result.ok && !/previously applied|already/i.test(result.output)) {
        throw new Error(
          `Zen patch ${path.relative(root, patch)} failed on a pristine file:\n${result.output}`
        );
      }
    }
    const final = path.join(work, relPath);
    return fs.existsSync(final) ? fs.readFileSync(final) : null;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/**
 * Content of a src file as committed (the upstream-owned version). During the
 * one-off migration PM_BASE_REF points at the upstream merge-base instead.
 */
function gitShowSrc(relPath) {
  return gitShow(root, `${process.env.PM_BASE_REF || "HEAD"}:src/${relPath}`);
}
