/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Every test works inside a fresh folder of its own. Nothing here points the
// Janitor at the real temp folder, caches or home directory.

const { JanitorCleaner, UnitStatus, MAX_AGE_MS, toFile } =
  ChromeUtils.importESModule(
    "moz-src:///peppermint/janitor/PeppermintJanitorCleaner.sys.mjs"
  );
const { normalizePath } = ChromeUtils.importESModule(
  "moz-src:///peppermint/janitor/PeppermintJanitorTargets.sys.mjs"
);
const { PeppermintJanitor, PREFS } = ChromeUtils.importESModule(
  "moz-src:///peppermint/janitor/PeppermintJanitor.sys.mjs"
);
const { Subprocess } = ChromeUtils.importESModule(
  "resource://gre/modules/Subprocess.sys.mjs"
);

const HOUR = 60 * 60 * 1000;
const IS_WINDOWS = AppConstants.platform === "win";
const MIB = 1024 * 1024;

let gBase;

add_setup(async function () {
  const dir = await IOUtils.createUniqueDirectory(
    PathUtils.tempDir,
    "janitor-test"
  );
  gBase = normalizePath(dir);
  registerCleanupFunction(() =>
    IOUtils.remove(gBase, { recursive: true, ignoreAbsent: true })
  );
});

function join(...parts) {
  return PathUtils.join(...parts);
}

function setAge(path, hours) {
  const time = Date.now() - hours * HOUR;
  const file = toFile(path);
  file.lastModifiedTime = time;
  file.lastAccessedTime = time;
}

async function write(path, { bytes = 10, hours = 100 } = {}) {
  await IOUtils.makeDirectory(PathUtils.parent(path), {
    createAncestors: true,
  });
  await IOUtils.write(path, new Uint8Array(bytes));
  setAge(path, hours);
}

async function exists(path) {
  return IOUtils.exists(path);
}

async function scenario(name) {
  const root = join(gBase, name);
  await IOUtils.makeDirectory(root, { createAncestors: true });
  return root;
}

function unit(path, root, extra = {}) {
  return { group: "temp", path, root, mode: "self", ageGated: true, ...extra };
}

function cleaner(root, options = {}) {
  return new JanitorCleaner({
    home: join(root, "home"),
    protectedTrees: [],
    protectedInside: [],
    ...options,
  });
}

async function runUnits(units, root, options) {
  const [result] = await cleaner(root, options).run(units);
  return result;
}

async function symlink(target, link) {
  const proc = await Subprocess.call({
    command: "/bin/ln",
    arguments: ["-s", target, link],
  });
  const { exitCode } = await proc.wait();
  Assert.equal(exitCode, 0, "The symlink was created");
}

// A link keeps its own times; touch -h sets those, not the target's.
async function ageLink(path, hours) {
  const d = new Date(Date.now() - hours * HOUR);
  const pad = n => String(n).padStart(2, "0");
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}`;
  const proc = await Subprocess.call({
    command: "/usr/bin/touch",
    arguments: ["-h", "-t", stamp, path],
  });
  Assert.equal((await proc.wait()).exitCode, 0, "The link was aged");
}

function linkExists(path) {
  try {
    return toFile(path).isSymlink();
  } catch (e) {
    return false;
  }
}

add_task(async function test_prefs_default_off() {
  Assert.equal(Services.prefs.getBoolPref(PREFS.enabled), false, "Opt-in");
  Assert.equal(Services.prefs.getBoolPref(PREFS.prompted), false);
  Assert.equal(
    Services.prefs.getBoolPref(PREFS.groups.trash),
    false,
    "The recycle bin is off by default"
  );
  for (const group of ["temp", "traces", "updates", "caches"]) {
    Assert.ok(Services.prefs.getBoolPref(PREFS.groups[group]), `${group} on`);
  }
  Assert.ok(Services.prefs.getBoolPref(PREFS.notifications));
  Assert.equal(Services.prefs.getBoolPref(PREFS.dryRun), false);
});

add_task(async function test_opt_in_prompt_only_once() {
  Assert.ok(PeppermintJanitor.shouldPrompt(), "Asked on a fresh profile");
  Services.prefs.setBoolPref(PREFS.prompted, true);
  Assert.ok(!PeppermintJanitor.shouldPrompt(), "Never asked twice");
  Services.prefs.setBoolPref(PREFS.prompted, false);
  Services.prefs.setBoolPref(PREFS.enabled, true);
  Assert.ok(!PeppermintJanitor.shouldPrompt(), "Not asked once enabled");
  Services.prefs.clearUserPref(PREFS.enabled);
  Services.prefs.clearUserPref(PREFS.prompted);
});

add_task(async function test_stale_unit_is_deleted() {
  const root = await scenario("stale");
  const dir = join(root, "tmp", "old-app");
  await write(join(dir, "a.bin"), { bytes: 100 });
  await write(join(dir, "nested", "b.bin"), { bytes: 50 });

  const result = await runUnits([unit(dir, join(root, "tmp"))], root);
  Assert.equal(result.status, UnitStatus.CLEANED);
  Assert.equal(result.bytes, 150, "Freed bytes are counted");
  Assert.equal(result.files, 2);
  Assert.ok(!(await exists(dir)), "A stale unit goes away entirely");
});

add_task(async function test_contents_mode_keeps_directory() {
  const root = await scenario("contents");
  const dir = join(root, "caches", "SomeApp");
  await write(join(dir, "blob"), { bytes: 20 });
  await write(join(dir, "sub", "blob2"), { bytes: 20 });

  const result = await runUnits(
    [unit(dir, join(root, "caches"), { mode: "contents" })],
    root
  );
  Assert.equal(result.status, UnitStatus.CLEANED);
  Assert.ok(await exists(dir), "The cache folder itself stays");
  Assert.deepEqual(await IOUtils.getChildren(dir), [], "It is emptied");
});

add_task(async function test_one_fresh_file_keeps_the_whole_unit() {
  const root = await scenario("fresh");
  const dir = join(root, "caches", "RunningApp");
  await write(join(dir, "old"), { hours: 200 });
  await write(join(dir, "deep", "new"), { hours: 1 });

  const result = await runUnits(
    [unit(dir, join(root, "caches"), { mode: "contents" })],
    root
  );
  Assert.equal(result.status, UnitStatus.ACTIVE);
  Assert.ok(await exists(join(dir, "old")), "Stale files stay with it");
  Assert.ok(await exists(join(dir, "deep", "new")), "Fresh files stay");
});

add_task(async function test_age_boundary_uses_72_hours() {
  Assert.equal(MAX_AGE_MS, 72 * HOUR);
  const root = await scenario("boundary");
  const young = join(root, "tmp", "young");
  const old = join(root, "tmp", "old");
  await write(young, { hours: 71 });
  await write(old, { hours: 73 });

  const results = await cleaner(root).run([
    unit(young, join(root, "tmp")),
    unit(old, join(root, "tmp")),
  ]);
  Assert.equal(results[0].status, UnitStatus.ACTIVE, "71h is still in use");
  Assert.equal(results[1].status, UnitStatus.CLEANED, "73h is stale");
  Assert.ok(await exists(young));
  Assert.ok(!(await exists(old)));
});

add_task(async function test_unaged_units_ignore_age() {
  const root = await scenario("ungated");
  const recent = join(root, "lists", "recent");
  await write(recent, { hours: 0 });
  const result = await runUnits(
    [unit(recent, join(root, "lists"), { ageGated: false })],
    root
  );
  Assert.equal(result.status, UnitStatus.CLEANED);
  Assert.ok(!(await exists(recent)));
});

add_task(async function test_dry_run_deletes_nothing() {
  const root = await scenario("dryrun");
  const dir = join(root, "tmp", "old-app");
  await write(join(dir, "a.bin"), { bytes: 100 });

  const result = await runUnits([unit(dir, join(root, "tmp"))], root, {
    dryRun: true,
  });
  Assert.equal(result.status, UnitStatus.DRY_RUN);
  Assert.equal(result.bytes, 100, "It reports what it would free");
  Assert.ok(await exists(join(dir, "a.bin")), "and deletes nothing");
});

add_task(async function test_invalid_and_protected_units_are_refused() {
  const root = await scenario("refused");
  const home = join(root, "home");
  const tmp = join(root, "tmp");
  const docs = join(home, "Documents", "report");
  const profile = join(tmp, "ok", "profile");
  await write(join(docs, "thesis.txt"));
  await write(join(profile, "places.sqlite"));
  await write(join(tmp, "ok", "f"));
  await write(join(root, "elsewhere", "f"));

  const options = {
    protectedTrees: [profile],
    protectedInside: [join(home, "Documents")],
  };
  const check = async (path, rootPath, status, message) => {
    const result = await runUnits([unit(path, rootPath)], root, options);
    Assert.equal(result.status, status, message);
  };

  await check(docs, join(home, "Documents"), UnitStatus.PROTECTED, "Documents");
  await check(profile, tmp, UnitStatus.PROTECTED, "The profile folder");
  await check(
    join(profile, "sub"),
    tmp,
    UnitStatus.PROTECTED,
    "Inside the profile folder"
  );
  await check(
    join(tmp, "ok"),
    tmp,
    UnitStatus.PROTECTED,
    "A folder that holds the profile"
  );
  await check(tmp, home, UnitStatus.INVALID, "A root that is the home folder");
  await check(
    join(tmp, "ok"),
    root,
    UnitStatus.INVALID,
    "A root that holds the home folder"
  );
  await check(
    join(root, "elsewhere"),
    tmp,
    UnitStatus.INVALID,
    "A unit outside its root"
  );
  const sep = IS_WINDOWS ? "\\" : "/";
  await check(
    `${tmp}${sep}..${sep}elsewhere`,
    tmp,
    UnitStatus.INVALID,
    "A unit that leaves its root through .."
  );
  await check(
    PathUtils.parent(root),
    PathUtils.parent(PathUtils.parent(root)),
    UnitStatus.INVALID,
    "A folder above the home folder"
  );

  Assert.ok(await exists(join(docs, "thesis.txt")), "Documents are intact");
  Assert.ok(await exists(join(profile, "places.sqlite")), "Profile intact");
  Assert.ok(await exists(join(root, "elsewhere", "f")), "Outside intact");
  Assert.ok(await exists(join(tmp, "ok", "f")), "Refused units are intact");
});

add_task(
  { skip_if: () => IS_WINDOWS },
  async function test_symlinks_are_never_followed() {
    const root = await scenario("symlinks");
    const outside = join(root, "outside");
    const canary = join(outside, "canary.txt");
    await write(canary, { hours: 500 });
    await write(join(outside, "dir", "deep.txt"), { hours: 500 });

    // Fresh links keep the unit, whatever they point to.
    const busy = join(root, "tmp", "fresh-link");
    await write(join(busy, "old.txt"));
    await symlink(outside, join(busy, "link-to-dir"));
    const kept = await runUnits([unit(busy, join(root, "tmp"))], root);
    Assert.equal(kept.status, UnitStatus.ACTIVE, "A fresh link is activity");
    Assert.ok(await exists(join(busy, "old.txt")));

    // Stale links inside a stale unit are unlinked, never entered.
    const dir = join(root, "tmp", "has-link");
    await write(join(dir, "old.txt"));
    await symlink(outside, join(dir, "link-to-dir"));
    await symlink(canary, join(dir, "link-to-file"));
    await ageLink(join(dir, "link-to-dir"), 100);
    await ageLink(join(dir, "link-to-file"), 100);

    const result = await runUnits([unit(dir, join(root, "tmp"))], root);
    Assert.equal(result.status, UnitStatus.CLEANED);
    Assert.ok(!(await exists(dir)), "The unit is gone");
    Assert.ok(await exists(canary), "The file behind a link is untouched");
    Assert.ok(
      await exists(join(outside, "dir", "deep.txt")),
      "The folder behind a link is untouched"
    );

    // A unit reached through a link is refused outright.
    await symlink(outside, join(root, "tmp", "via"));
    const viaLink = await runUnits(
      [unit(join(root, "tmp", "via", "dir"), join(root, "tmp"))],
      root
    );
    Assert.equal(viaLink.status, UnitStatus.INVALID, "Linked ancestor");
    Assert.ok(await exists(join(outside, "dir", "deep.txt")));

    // A link as the unit itself is removed as a link only.
    const direct = join(root, "tmp", "direct");
    await symlink(outside, direct);
    await ageLink(direct, 100);
    const alone = await runUnits([unit(direct, join(root, "tmp"))], root);
    Assert.equal(alone.status, UnitStatus.CLEANED);
    Assert.ok(!linkExists(direct), "The link itself was removed");
    Assert.ok(await exists(canary), "Its target is untouched");
    Assert.ok(await exists(join(outside, "dir", "deep.txt")));
  }
);

add_task(
  { skip_if: () => IS_WINDOWS },
  async function test_special_files_keep_the_unit() {
    const root = await scenario("special");
    const dir = join(root, "tmp", "has-fifo");
    await write(join(dir, "old.txt"));
    const proc = await Subprocess.call({
      command: "/usr/bin/mkfifo",
      arguments: [join(dir, "pipe")],
    });
    Assert.equal((await proc.wait()).exitCode, 0, "FIFO created");

    const result = await runUnits([unit(dir, join(root, "tmp"))], root);
    Assert.equal(result.status, UnitStatus.ACTIVE, "Something live is near");
    Assert.ok(await exists(join(dir, "old.txt")), "Nothing was deleted");
  }
);

add_task(async function test_many_entries_are_all_cleaned() {
  const root = await scenario("many");
  const dir = join(root, "tmp", "many-files");
  for (let i = 0; i < 300; i++) {
    await write(join(dir, `f${i}`), { bytes: 1 });
  }
  const result = await runUnits([unit(dir, join(root, "tmp"))], root);
  Assert.equal(result.status, UnitStatus.CLEANED);
  Assert.equal(result.files, 300);
  Assert.ok(!(await exists(dir)));
});

// A machine-shaped fixture for the whole pipeline.
async function fixtureMachine(name) {
  const root = await scenario(name);
  const home = join(root, "home");
  const tmp = join(root, "tmp");
  const os = Services.appinfo.OS;
  let environment;
  let cacheDir;
  switch (os) {
    case "Darwin":
      cacheDir = join(home, "Library", "Caches", "SomeApp");
      environment = { os, home, tmp, extraTmp: [] };
      break;
    case "Linux":
      cacheDir = join(home, ".cache", "SomeApp");
      environment = {
        os,
        home,
        tmp,
        xdgCache: join(home, ".cache"),
        xdgData: join(home, ".local", "share"),
      };
      break;
    default: {
      const localAppData = join(home, "AppData", "Local");
      cacheDir = join(localAppData, "SomeApp", "Cache");
      environment = {
        os,
        home,
        tmp,
        localAppData,
        appData: join(home, "AppData", "Roaming"),
      };
    }
  }
  await IOUtils.makeDirectory(tmp, { createAncestors: true });
  await write(join(tmp, "junk", "x"), { bytes: 3 * MIB });
  await write(join(cacheDir, "blob"), { bytes: 2 * MIB });
  return { root, environment, cacheDir, tmpJunk: join(tmp, "junk") };
}

function pipelineOptions(machine, extra = {}) {
  return {
    environment: machine.environment,
    protectedTrees: [],
    protectedFolders: [],
    notify: false,
    ...extra,
  };
}

add_task(async function test_pipeline_cleans_enabled_groups_only() {
  const machine = await fixtureMachine("pipeline");
  const summary = await PeppermintJanitor.run(
    pipelineOptions(machine, { groups: ["temp"] })
  );
  Assert.deepEqual(
    summary.groups.map(g => g.group),
    ["temp"],
    "Only the enabled group ran"
  );
  Assert.equal(summary.groups[0].bytes, 3 * MIB);
  Assert.ok(!(await exists(machine.tmpJunk)), "Temp junk is gone");
  Assert.ok(
    await exists(join(machine.cacheDir, "blob")),
    "Caches were not asked for, so they stay"
  );

  const second = await PeppermintJanitor.run(
    pipelineOptions(machine, { groups: ["temp", "caches"] })
  );
  Assert.deepEqual(
    second.groups.map(g => g.group),
    ["caches"]
  );
  Assert.equal(second.totalBytes, 2 * MIB);
  Assert.ok(!(await exists(join(machine.cacheDir, "blob"))));
});

add_task(async function test_pipeline_uses_group_prefs() {
  const machine = await fixtureMachine("prefs");
  Services.prefs.setBoolPref(PREFS.groups.caches, false);
  Services.prefs.setBoolPref(PREFS.groups.temp, false);
  const summary = await PeppermintJanitor.run(pipelineOptions(machine));
  Services.prefs.clearUserPref(PREFS.groups.caches);
  Services.prefs.clearUserPref(PREFS.groups.temp);
  Assert.equal(summary.totalBytes, 0, "Switched-off groups are skipped");
  Assert.ok(await exists(machine.tmpJunk));
  Assert.ok(await exists(join(machine.cacheDir, "blob")));
});

add_task(async function test_pipeline_dry_run_pref() {
  const machine = await fixtureMachine("dryprefs");
  const summary = await PeppermintJanitor.run(
    pipelineOptions(machine, { dryRun: true })
  );
  Assert.ok(summary.dryRun);
  Assert.equal(summary.totalBytes, 5 * MIB, "It reports the plan");
  Assert.ok(await exists(machine.tmpJunk), "Nothing is deleted");
  Assert.ok(await exists(join(machine.cacheDir, "blob")));
});

function watchToasts() {
  const seen = [];
  const container = document.getElementById("zen-toast-container");
  const observer = new MutationObserver(() => {
    for (const toast of container.querySelectorAll(".zen-toast")) {
      const id = toast.querySelector("label")?.getAttribute("data-l10n-id");
      if (id && !seen.some(entry => entry.id === id)) {
        seen.push({
          id,
          icon: toast.querySelector(".zen-toast-icon")?.getAttribute("src"),
          frosted: toast.hasAttribute("frosted"),
          description: toast
            .querySelector(".description")
            ?.getAttribute("data-l10n-id"),
        });
      }
    }
  });
  observer.observe(container, { childList: true, subtree: true });
  return { seen, stop: () => observer.disconnect() };
}

add_task(async function test_toasts_one_per_group_with_check_icon() {
  const machine = await fixtureMachine("toasts");
  const watcher = watchToasts();
  const summary = await PeppermintJanitor.run(
    pipelineOptions(machine, { groups: ["temp", "caches"], notify: true })
  );
  watcher.stop();

  Assert.equal(summary.groups.length, 2);
  Assert.deepEqual(
    watcher.seen.map(entry => entry.id),
    ["peppermint-janitor-toast-temp", "peppermint-janitor-toast-caches"],
    "One toast per cleaned group, in order"
  );
  for (const entry of watcher.seen) {
    Assert.equal(
      entry.icon,
      "chrome://global/skin/icons/check-filled.svg",
      "A checkmark on the left"
    );
    Assert.ok(entry.frosted, "Frosted like the other notices");
    Assert.equal(entry.description, "peppermint-janitor-toast-description");
  }
});

add_task(async function test_notifications_off_and_small_groups_are_silent() {
  const big = await fixtureMachine("silent-big");
  const watcher = watchToasts();
  await PeppermintJanitor.run(
    pipelineOptions(big, { groups: ["temp", "caches"], notify: false })
  );

  const small = await scenario("silent-small");
  const tmp = join(small, "tmp");
  await write(join(tmp, "tiny", "x"), { bytes: 10 });
  const summary = await PeppermintJanitor.run({
    environment: { os: Services.appinfo.OS, home: join(small, "home"), tmp },
    protectedTrees: [],
    protectedFolders: [],
    groups: ["temp"],
    notify: true,
  });
  watcher.stop();
  Assert.equal(summary.groups[0].bytes, 10, "The small group was cleaned");
  Assert.deepEqual(watcher.seen, [], "but neither run showed a toast");
});

add_task(async function test_manual_run_says_when_nothing_was_cleaned() {
  const machine = await fixtureMachine("nothing");
  await PeppermintJanitor.run(
    pipelineOptions(machine, { groups: ["temp", "caches"] })
  );
  const run = PeppermintJanitor.run(
    pipelineOptions(machine, {
      groups: ["temp", "caches"],
      manual: true,
      notify: undefined,
    })
  );
  const toast = await TestUtils.waitForCondition(
    () =>
      document.querySelector(
        '#zen-toast-container [data-l10n-id="peppermint-janitor-toast-nothing"]'
      ),
    "The empty run is acknowledged"
  );
  Assert.ok(toast);
  await run;
});

add_task(async function test_only_one_run_at_a_time() {
  const machine = await fixtureMachine("single");
  const first = PeppermintJanitor.run(
    pipelineOptions(machine, { groups: ["temp"] })
  );
  const second = PeppermintJanitor.run(
    pipelineOptions(machine, { groups: ["caches"] })
  );
  Assert.strictEqual(first, second, "A second caller joins the running one");
  Assert.ok(PeppermintJanitor.running);
  await first;
  Assert.ok(!PeppermintJanitor.running);
});

add_task(async function test_automatic_start_is_off_in_tests() {
  Assert.ok(Cu.isInAutomation, "Tests run in automation");
  // init() returns before scheduling anything, so nothing runs by itself.
  PeppermintJanitor.init(window);
  Assert.ok(!PeppermintJanitor.running, "No run was started");
});
