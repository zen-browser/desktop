/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const SCRIPTS_PREF = "zen.mods.scripts.enabled";
const COMMIT_A = "a".repeat(40);
const COMMIT_B = "b".repeat(40);
const COMMIT_C = "c".repeat(40);

/**
 * Moves the default branch of the fake zen-tests/sample repository.
 *
 * @param {string} sha
 */
async function setHead(sha) {
  await fetch(`${MODS_ROOT}github_api.sjs?head=${sha}`);
}

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.mods.github.api-url", `${MODS_ROOT}github_api.sjs?`],
      ["zen.mods.github.raw-url", `${MODS_ROOT}github/`],
      [SCRIPTS_PREF, true],
    ],
  });
  await setHead(COMMIT_A);

  registerCleanupFunction(async () => {
    await setHead(COMMIT_A);
    delete window.zenTestGitHub;
  });
});

add_task(async function test_only_github_repositories() {
  for (const input of [
    "zen-tests",
    "zen-tests/../sample",
    "https://example.com/zen-tests/sample",
    "zen-tests/sample/tree/main/../outside",
  ]) {
    await Assert.rejects(
      gZenModsManager.fetchGitHubMod(input),
      /Not a GitHub repository/,
      `${input} is refused`
    );
  }
});

add_task(async function test_install_and_update_from_github() {
  const found = await gZenModsManager.fetchGitHubMod(
    "https://github.com/zen-tests/sample.git"
  );

  is(found.name, "GitHub Mod", "The mod is named by its theme.json");
  is(found.sha, COMMIT_A, "It's pinned to the branch's commit");
  ok(found.files.includes("assets/icon.svg"), "Its assets come along");
  ok(
    !found.files.some(path => path.startsWith(".github")),
    "Hidden folders don't"
  );

  const modId = await gZenModsManager.installGitHubMod(found, {
    scriptsApproved: true,
  });
  const folder = gZenModsManager.getModFolder(modId);

  await waitForRootValue(
    window,
    "--zen-test-github",
    '"v1"',
    "The mod's styles apply"
  );
  await TestUtils.waitForCondition(
    () => window.zenTestGitHub === "v1",
    "Its allowed scripts run"
  );
  ok(
    await IOUtils.exists(PathUtils.join(folder, "assets", "icon.svg")),
    "The files are copied into the profile"
  );

  await setHead(COMMIT_B);
  await gZenModsManager.checkForUpdates();
  await waitForRootValue(
    window,
    "--zen-test-github",
    '"v2"',
    "An update with the same scripts applies on its own"
  );

  let mod = (await gZenModsManager.getMods())[modId];

  is(mod.sha, COMMIT_B, "The mod is pinned to the new commit");
  is(
    gZenModsManager.getScriptsState(modId),
    "running",
    "Its scripts stay allowed"
  );

  await setHead(COMMIT_C);
  await gZenModsManager.checkForUpdates();
  mod = (await gZenModsManager.getMods())[modId];

  is(mod.sha, COMMIT_B, "An update that changes the scripts waits");
  is(mod.pendingUpdate?.sha, COMMIT_C, "And says which commit it waits with");
  is(
    rootValue(window, "--zen-test-github"),
    '"v2"',
    "The installed version keeps applying"
  );

  await gZenModsManager.approveUpdate(modId);
  await waitForRootValue(
    window,
    "--zen-test-github",
    '"v3"',
    "Allowing the update applies it"
  );
  mod = (await gZenModsManager.getMods())[modId];
  ok(!mod.pendingUpdate, "Nothing waits anymore");
  is(
    mod.approvedScriptsHash,
    mod.scriptsHash,
    "The new scripts are the allowed ones"
  );

  await gZenModsManager.uninstallMod(modId);
  ok(!(await IOUtils.exists(folder)), "Removing the mod removes its copy");

  await setHead(COMMIT_A);
});

add_task(async function test_scripts_wait_for_approval() {
  const found = await gZenModsManager.fetchGitHubMod("zen-tests/sample");
  const modId = await gZenModsManager.installGitHubMod(found);

  is(
    gZenModsManager.getScriptsState(modId),
    "needs-approval",
    "Scripts nobody allowed wait"
  );

  await gZenModsManager.approveScripts(modId);

  is(
    gZenModsManager.getScriptsState(modId),
    "running",
    "Allowing them runs them"
  );

  await gZenModsManager.uninstallMod(modId);
});

add_task(async function test_a_folder_of_a_branch() {
  const found = await gZenModsManager.fetchGitHubMod(
    "https://github.com/zen-tests/sample/tree/main/sub"
  );

  is(found.name, "sub", "A mod without theme.json is named by its folder");
  is(found.version, COMMIT_A.slice(0, 7), "And versioned by its commit");
  is(found.ref, "main", "The branch is kept for updates");
  Assert.deepEqual(found.files, ["chrome.css"], "Only its folder's files");

  const modId = await gZenModsManager.installGitHubMod(found);

  await waitForRootValue(
    window,
    "--zen-test-github-sub",
    '"sub"',
    "Its styles apply"
  );

  await gZenModsManager.uninstallMod(modId);
});
