// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Merge zen-browser/desktop (upstream/dev) into a Peppermint sync branch.
 *
 *   node peppermint/scripts/sync-upstream.mjs [--base mine] [--check-import]
 *                                             [--push] [--pr]
 *
 * 1. fetch upstream/dev and branch sync/upstream-<date> off --base
 * 2. merge it; the drivers registered by setup-git.mjs resolve surfer.json,
 *    package-lock.json and configs/branding on their own
 * 3. resolve what is still mechanical: deliberate deletions, adapted compat
 *    patches (upstream's copy wins, `npm run import` re-adapts it), lockfile
 * 4. commit the merge, optionally run `npm run import` to prove that every
 *    overlay patch still applies, push, and open a pull request
 *
 * Anything else that conflicts is a real decision: the merge is aborted and the
 * conflicting paths are printed.
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};

function git(...a) {
  return execFileSync("git", a, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 }).trim();
}

function tryGit(...a) {
  const r = spawnSync("git", a, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

function run(cmd, cmdArgs, options = {}) {
  const r = spawnSync(cmd, cmdArgs, { cwd: root, stdio: "inherit", ...options });
  return r.status === 0;
}

const owned = JSON.parse(fs.readFileSync(path.join(root, "peppermint", "owned-paths.json"), "utf8"));
const base = option("--base", "mine");
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const branch = `sync/upstream-${stamp}`;

if (git("status", "--porcelain")) {
  console.error("sync-upstream: the working tree has uncommitted changes");
  process.exit(1);
}
run("node", ["peppermint/scripts/setup-git.mjs"]);
git("fetch", "--no-tags", "upstream", "+refs/heads/dev:refs/remotes/upstream/dev");

if (tryGit("merge-base", "--is-ancestor", "upstream/dev", base).ok) {
  console.log(`sync-upstream: ${base} already contains upstream/dev`);
  process.exit(0);
}

const behind = git("rev-list", "--count", `${base}..upstream/dev`);
git("checkout", "-B", branch, base);
console.log(`sync-upstream: merging ${behind} upstream commits into ${branch}`);
const merge = tryGit("merge", "--no-ff", "--no-commit", "upstream/dev");

function conflicts() {
  return git("diff", "--name-only", "--diff-filter=U").split("\n").filter(Boolean);
}

if (!merge.ok) {
  const compat = fs.existsSync(path.join(root, owned.compatList))
    ? fs.readFileSync(path.join(root, owned.compatList), "utf8").split("\n").filter(Boolean)
    : [];
  for (const file of conflicts()) {
    if (owned.deleted.includes(file)) {
      git("rm", "-q", "--", file);
    } else if (compat.includes(file) || owned.regenerated.includes(file)) {
      git("checkout", "--theirs", "--", file);
      git("add", "--", file);
    } else if (owned.ours.some(prefix => file.startsWith(prefix))) {
      git("checkout", "--ours", "--", file);
      git("add", "--", file);
    }
  }
  const left = conflicts();
  if (left.length) {
    git("merge", "--abort");
    git("checkout", base);
    console.error(`sync-upstream: ${left.length} conflicts need a human decision:`);
    left.forEach(f => console.error(`  ${f}`));
    process.exit(2);
  }
}

// Identity fields and the lockfile are always re-derived from Zen's copies.
run("node", ["peppermint/scripts/merge-driver.mjs", "apply", "surfer"]);
run("node", ["peppermint/scripts/merge-driver.mjs", "apply", "lockfile"]);
if (!run("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"])) {
  console.warn("sync-upstream: could not refresh package-lock.json, review it by hand");
}
git("add", "-A", "surfer.json", "package-lock.json");

let importReport = "not run";
if (flag("--check-import")) {
  const ok = run("npm", ["run", "import"]);
  importReport = ok ? "passed" : "FAILED";
  const stale = git("status", "--porcelain", "--", "src", "peppermint");
  if (stale) {
    // Adapted compat patches are rewritten by the import; keep them.
    git("add", "-A", "src", "peppermint/compat-patches.txt");
  }
  if (!ok) {
    console.error(
      "sync-upstream: npm run import failed. A failed overlay patch means Zen changed lines Peppermint edits.\n" +
        "Fix the engine file and run `npm run pm:record -- <engine path> <feature>`."
    );
  }
}

git("-c", "core.hooksPath=/dev/null", "commit", "-q", "-m", `Merge upstream/dev into ${base} (${stamp})`);
console.log(`sync-upstream: committed on ${branch}, import check: ${importReport}`);

if (flag("--push")) {
  const origin = git("remote", "get-url", "--push", "origin").toLowerCase();
  if (origin.includes("zen-browser/desktop")) {
    console.error(`sync-upstream: refusing to push, origin is ${origin}`);
    process.exit(1);
  }
  git("push", "--force-with-lease", "origin", branch);
  if (flag("--pr")) {
    const body =
      `Automated merge of zen-browser/desktop \`dev\` (${behind} commits).\n\n` +
      `- import check: **${importReport}**\n` +
      "- surfer.json, package-lock.json and branding were resolved by the merge drivers\n" +
      "- review any file under `src/` listed in `peppermint/compat-patches.txt`: those are Zen patches re-adapted to the pinned Firefox\n";
    run("gh", ["pr", "create", "--base", base, "--head", branch, "--title", `Merge upstream Zen (${stamp})`, "--body", body]);
  }
}
if (importReport === "FAILED") {
  process.exit(3);
}
