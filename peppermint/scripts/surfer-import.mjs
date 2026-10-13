// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * `surfer import` that survives Zen patches written for a different Firefox
 * build than the one in engine/.
 *
 * Zen's dev branch often carries patches for the next Firefox candidate while
 * surfer.json still pins the current release. When one of Zen's patches no
 * longer applies cleanly, this wrapper rewrites it in src/ against the real
 * engine files: Zen's hunks are applied with fuzz and whatever applied becomes
 * the new patch. Hunks that could not be placed are carried by the matching
 * Peppermint overlay patch instead, so nothing is lost.
 *
 * Rewritten patches are listed in peppermint/compat-patches.txt. After an
 * upstream merge, take upstream's version of those files and run
 * `npm run import`; the wrapper regenerates them.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  engineDir,
  gitShow,
  listFiles,
  root,
  runPatch,
  srcDir,
  tmpDir,
} from "./lib.mjs";

const listFile = path.join(root, "peppermint", "compat-patches.txt");
const MAX_ROUNDS = 60;

function runSurfer() {
  const result = spawnSync("npx", ["surfer", "import"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1 << 28,
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

function failingPatch(output) {
  const match = /Command failed[^\n]*git apply[^\n]*?(\S+\.patch)/.exec(output);
  if (!match) {
    return null;
  }
  const rel = path.relative(root, match[1]);
  return rel.startsWith("src/") ? rel : null;
}

function targetsOf(text) {
  return [...text.matchAll(/^\+\+\+ b\/(\S+)/gm)].map(m => m[1]);
}

/**
 * What the engine files look like just before `patchPath` is applied:
 * pristine Firefox plus every earlier patch (Surfer applies them in path
 * order) that touches the same files. Built from scratch because engine/ may
 * still hold the result of an older version of the patch.
 */
function stateBefore(patchPath, targets, dir) {
  const seed = target => {
    const dest = path.join(dir, target);
    if (!fs.existsSync(dest)) {
      const content = gitShow(engineDir, `HEAD:${target}`);
      if (content) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, content);
      }
    }
  };
  targets.forEach(seed);
  const earlier = listFiles(srcDir, f => f.endsWith(".patch"))
    .sort()
    .filter(f => f < patchPath);
  for (const other of earlier) {
    const text = fs.readFileSync(other, "utf8");
    const touched = targetsOf(text);
    if (!touched.some(t => targets.includes(t))) {
      continue;
    }
    touched.forEach(seed);
    runPatch(
      ["-p1", "-F3", "--forward", "--force", "--batch", "--no-backup-if-mismatch", "-r", "/dev/null", "-i", other],
      dir
    );
  }
}

function regenerate(patchRel) {
  const patchPath = path.join(root, patchRel);
  const text = fs.readFileSync(patchPath, "utf8");
  const targets = targetsOf(text);
  if (!targets.length || /^--- \/dev\/null/m.test(text)) {
    return false;
  }

  const work = tmpDir("pm-rebase-");
  try {
    const before = path.join(work, "before");
    const after = path.join(work, "after");
    fs.mkdirSync(before, { recursive: true });
    stateBefore(patchPath, targets, before);
    for (const target of targets) {
      if (!fs.existsSync(path.join(before, target))) {
        return false;
      }
      fs.mkdirSync(path.dirname(path.join(after, target)), { recursive: true });
    }
    let applied = false;
    for (const fuzz of ["-F2", "-F3"]) {
      for (const target of targets) {
        fs.copyFileSync(path.join(before, target), path.join(after, target));
      }
      const result = runPatch(
        ["-p1", fuzz, "--forward", "--force", "--batch", "--no-backup-if-mismatch", "-r", "/dev/null", "-i", patchPath],
        after
      );
      applied = result.ok || /succeeded/.test(result.output);
      if (result.ok) {
        break;
      }
    }

    let out = "";
    for (const target of targets) {
      const diff = spawnSync(
        "diff",
        ["-u", "--label", `a/${target}`, "--label", `b/${target}`, path.join(before, target), path.join(after, target)],
        { encoding: "utf8", maxBuffer: 1 << 28 }
      );
      if (diff.status === 1) {
        out += diff.stdout;
      }
    }
    if (!out) {
      return applied;
    }
    fs.writeFileSync(patchPath, out);
    // Surfer applies the new patch on top of this state in the next round.
    for (const target of targets) {
      fs.copyFileSync(path.join(before, target), path.join(engineDir, target));
    }
    return true;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

const rewritten = new Set(
  fs.existsSync(listFile)
    ? fs.readFileSync(listFile, "utf8").split("\n").filter(Boolean)
    : []
);

for (let round = 0; round < MAX_ROUNDS; round++) {
  const { ok, output } = runSurfer();
  if (ok) {
    process.stdout.write(output);
    fs.writeFileSync(listFile, [...rewritten].sort().join("\n") + (rewritten.size ? "\n" : ""));
    console.log(`surfer-import: done, ${rewritten.size} patches adapted to this engine`);
    process.exit(0);
  }
  const bad = failingPatch(output);
  if (!bad) {
    process.stdout.write(output);
    process.exit(1);
  }
  console.log(`surfer-import: ${bad} does not apply to this engine, adapting`);
  if (!regenerate(bad)) {
    process.stdout.write(output);
    console.error(`surfer-import: could not adapt ${bad}`);
    process.exit(1);
  }
  rewritten.add(bad);
}
console.error("surfer-import: gave up after too many rounds");
process.exit(1);
