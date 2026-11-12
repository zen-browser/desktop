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
  ok(
    !found.files.includes("assets/huge.png"),
    "Files too big for a mod are left out instead of failing the install"
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

add_task(async function test_page_styles_from_github_cant_reach_the_web() {
  const found = await gZenModsManager.fetchGitHubMod("zen-tests/sample/pages");

  is(found.contentStylePath, "userContent.css", "The mod styles pages");

  const modId = await gZenModsManager.installGitHubMod(found);
  const mod = (await gZenModsManager.getMods())[modId];

  ok(
    !mod.contentStylePath && mod.pageStylesBlocked,
    "Page styles that load from the web, through an import too, are turned off"
  );
  is(
    gZenModsManager.getModError(modId)?.type,
    "page-styles-blocked",
    "And the mod says why"
  );
  await waitForRootValue(
    window,
    "--zen-test-pages-chrome",
    '"chrome"',
    "Its styles for Zen, which may load fonts from the web, still apply"
  );

  const pageSheet = await IOUtils.readUTF8(
    PathUtils.join(PathUtils.profileDir, "chrome", "zen-themes-content.css")
  );

  ok(!pageSheet.includes(modId), "Pages don't get its styles");

  await gZenModsManager.uninstallMod(modId);
});

add_task(async function test_every_way_page_styles_reach_the_web_is_caught() {
  const cases = {
    "escaped-url": true,
    "escaped-string": true,
    "import-no-space": true,
    "image-set": true,
    "imported-no-space": true,
    "imported-encoded": true,
    "import-missing": true,
    clean: false,
  };

  for (const [name, isBlocked] of Object.entries(cases)) {
    const found = await gZenModsManager.fetchGitHubMod(
      `zen-tests/sample/remote/${name}`
    );
    const modId = await gZenModsManager.installGitHubMod(found);
    const mod = (await gZenModsManager.getMods())[modId];

    is(
      Boolean(mod.pageStylesBlocked),
      isBlocked,
      `Page styles of "${name}" are ${isBlocked ? "turned off" : "kept"}`
    );

    await gZenModsManager.uninstallMod(modId);
  }
});
