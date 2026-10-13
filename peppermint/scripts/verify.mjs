// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Regression guard for the layered fork structure.
 *
 * `snapshot` hashes everything that makes engine/ differ from stock Firefox
 * after `npm run import` (patched files, symlinked src files, branding and
 * en-US locale packs). `compare` diffs two snapshots, optionally translating
 * moved paths, so a restructure can prove it produced the same build input.
 *
 *   node peppermint/scripts/verify.mjs snapshot [out.json]
 *   node peppermint/scripts/verify.mjs compare baseline.json [current.json]
 *        [--moves peppermint/verify-moves.json] [--allow peppermint/verify-allow.json]
 */

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const engineDir = path.join(root, "engine");
const srcDir = path.join(root, "src");

const WALKED_ENGINE_DIRS = [
  "browser/branding/release",
  "browser/branding/twilight",
  "browser/locales/en-US",
];

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function git(args) {
  return execFileSync("git", args, {
    cwd: engineDir,
    encoding: "utf8",
    maxBuffer: 1 << 28,
  })
    .split("\n")
    .filter(Boolean);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (fs.existsSync(full)) {
      out.push(full);
    }
  }
  return out;
}

function snapshot() {
  const files = new Set();
  for (const f of git(["diff", "--name-only", "HEAD"])) {
    files.add(f);
  }
  for (const f of git(["ls-files", "-o", "--exclude-standard"])) {
    files.add(f);
  }
  for (const abs of walk(srcDir)) {
    const rel = path.relative(srcDir, abs).split(path.sep).join("/");
    if (!rel.endsWith(".patch") && !rel.endsWith(".patch.new")) {
      files.add(rel);
    }
  }
  for (const dir of WALKED_ENGINE_DIRS) {
    for (const abs of walk(path.join(engineDir, dir))) {
      files.add(path.relative(engineDir, abs).split(path.sep).join("/"));
    }
  }
  const result = {};
  for (const rel of [...files].sort()) {
    const abs = path.join(engineDir, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      result[rel] = sha256(abs);
    }
  }
  return result;
}

function applyMoves(map, moves) {
  const out = {};
  for (const [file, hash] of Object.entries(map)) {
    let target = file;
    for (const { from, to } of moves) {
      if (file.startsWith(from)) {
        target = to + file.slice(from.length);
        break;
      }
    }
    out[target] = hash;
  }
  return out;
}

function readJson(file, fallback) {
  return file && fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : fallback;
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

const [command, ...rest] = process.argv.slice(2);

if (command === "snapshot") {
  const out = rest[0] || "peppermint/baseline/engine-snapshot.json";
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const data = snapshot();
  fs.writeFileSync(out, JSON.stringify(data, null, 1) + "\n");
  console.log(`verify: wrote ${Object.keys(data).length} file hashes to ${out}`);
} else if (command === "compare") {
  const positional = rest.filter(
    (arg, i) => !arg.startsWith("--") && !rest[i - 1]?.startsWith("--")
  );
  const baselineFile = positional[0];
  if (!baselineFile) {
    console.error("verify: compare needs a baseline snapshot");
    process.exit(2);
  }
  const moves = readJson(option("--moves"), []);
  const allow = readJson(option("--allow"), []).map(p => new RegExp(p));
  const baseline = applyMoves(readJson(baselineFile, {}), moves);
  const current = positional[1] ? readJson(positional[1], {}) : snapshot();
  const isAllowed = file => allow.some(re => re.test(file));

  const missing = [];
  const added = [];
  const changed = [];
  for (const file of Object.keys(baseline)) {
    if (!(file in current)) {
      missing.push(file);
    } else if (baseline[file] !== current[file]) {
      changed.push(file);
    }
  }
  for (const file of Object.keys(current)) {
    if (!(file in baseline)) {
      added.push(file);
    }
  }
  const report = (label, list) => {
    const kept = list.filter(f => !isAllowed(f));
    console.log(`${label}: ${kept.length}${list.length !== kept.length ? ` (+${list.length - kept.length} allowed)` : ""}`);
    for (const f of kept.slice(0, 80)) {
      console.log(`  ${f}`);
    }
    if (kept.length > 80) {
      console.log(`  ... ${kept.length - 80} more`);
    }
    return kept.length;
  };
  const problems =
    report("missing", missing) + report("changed", changed) + report("added", added);
  if (problems) {
    process.exit(1);
  }
  console.log("verify: engine output matches the baseline");
} else {
  console.error("usage: verify.mjs snapshot [out] | compare baseline [current] [--moves f] [--allow f]");
  process.exit(2);
}
