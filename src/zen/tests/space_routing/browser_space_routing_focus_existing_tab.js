/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_setup(async function () {
  clearAllRoutes();
  gZenSpaceRoutingManager.setFocusExistingTab(false);
  registerCleanupFunction(() => {
    clearAllRoutes();
    gZenSpaceRoutingManager.setFocusExistingTab(false);
  });
});

add_task(async function test_focus_existing_tab_defaults_to_false() {
  Assert.equal(
    gZenSpaceRoutingManager.getFocusExistingTab(),
    false,
    "focusExistingTab defaults to false"
  );
});

add_task(async function test_focus_existing_tab_can_be_toggled() {
  gZenSpaceRoutingManager.setFocusExistingTab(true);
  Assert.equal(
    gZenSpaceRoutingManager.getFocusExistingTab(),
    true,
    "focusExistingTab can be set to true"
  );
  gZenSpaceRoutingManager.setFocusExistingTab(false);
  Assert.equal(
    gZenSpaceRoutingManager.getFocusExistingTab(),
    false,
    "focusExistingTab can be set back to false"
  );
});

const FOCUS_WS = { uuid: "ws-focus", containerTabId: 10, name: "Focus WS" };

add_task(async function test_onBeforeAddTab_focuses_existing_tab_when_enabled() {
  clearAllRoutes();
  gZenSpaceRoutingManager.setFocusExistingTab(true);

  const existingTab = makeFakeTab("https://github.com/user/repo/pull/42", FOCUS_WS.uuid);
  const win = makeFakeWindow({
    ready: true,
    workspaces: [FOCUS_WS],
    tabs: [existingTab],
  });

  const result = gZenSpaceRoutingManager.onBeforeAddTab(
    "https://github.com/user/repo/pull/42",
    { fromExternal: true },
    win
  );

  Assert.equal(result.shouldEarlyExit, true, "Should early exit when existing tab found");
  Assert.equal(win.gBrowser.selectedTab, existingTab, "The existing tab is selected");
  await TestUtils.waitForCondition(
    () => win.gZenWorkspaces.changeCalls.length === 1,
    "changeWorkspace was called"
  );
  Assert.equal(
    win.gZenWorkspaces.changeCalls[0].uuid,
    FOCUS_WS.uuid,
    "Switched to the existing tab's workspace"
  );
});

add_task(async function test_onBeforeAddTab_skips_focus_when_disabled() {
  clearAllRoutes();
  gZenSpaceRoutingManager.setFocusExistingTab(false);

  const existingTab = makeFakeTab("https://github.com/user/repo/pull/42", FOCUS_WS.uuid);
  const win = makeFakeWindow({
    ready: true,
    workspaces: [FOCUS_WS],
    tabs: [existingTab],
  });

  const result = gZenSpaceRoutingManager.onBeforeAddTab(
    "https://github.com/user/repo/pull/42",
    { fromExternal: true },
    win
  );

  Assert.equal(result.shouldEarlyExit, false, "Should not early exit when setting is off");
  Assert.equal(win.gBrowser.selectedTab, null, "No tab was selected");
});

add_task(async function test_onBeforeAddTab_skips_focus_for_internal_links() {
  clearAllRoutes();
  gZenSpaceRoutingManager.setFocusExistingTab(true);

  const existingTab = makeFakeTab("https://github.com/user/repo/pull/42", FOCUS_WS.uuid);
  const win = makeFakeWindow({
    ready: true,
    workspaces: [FOCUS_WS],
    tabs: [existingTab],
  });

  const result = gZenSpaceRoutingManager.onBeforeAddTab(
    "https://github.com/user/repo/pull/42",
    { fromExternal: false },
    win
  );

  Assert.equal(result.shouldEarlyExit, false, "Internal links bypass focus-existing-tab");
});

add_task(async function test_onBeforeAddTab_no_match_proceeds_normally() {
  clearAllRoutes();
  gZenSpaceRoutingManager.setFocusExistingTab(true);

  const existingTab = makeFakeTab("https://github.com/user/repo/pull/42", FOCUS_WS.uuid);
  const win = makeFakeWindow({
    ready: true,
    workspaces: [FOCUS_WS],
    tabs: [existingTab],
  });

  const result = gZenSpaceRoutingManager.onBeforeAddTab(
    "https://github.com/user/repo/pull/99",
    { fromExternal: true },
    win
  );

  Assert.equal(result.shouldEarlyExit, false, "No match means normal tab creation");
});

add_task(async function test_onBeforeAddTab_matches_with_trailing_slash() {
  clearAllRoutes();
  gZenSpaceRoutingManager.setFocusExistingTab(true);

  const existingTab = makeFakeTab("https://github.com/", FOCUS_WS.uuid);
  const win = makeFakeWindow({
    ready: true,
    workspaces: [FOCUS_WS],
    tabs: [existingTab],
  });

  const result = gZenSpaceRoutingManager.onBeforeAddTab(
    "https://github.com",
    { fromExternal: true },
    win
  );

  Assert.equal(result.shouldEarlyExit, true, "Trailing slash difference still matches");
  Assert.equal(win.gBrowser.selectedTab, existingTab, "The existing tab is selected");
});

add_task(async function test_onBeforeAddTab_matches_case_insensitive() {
  clearAllRoutes();
  gZenSpaceRoutingManager.setFocusExistingTab(true);

  const existingTab = makeFakeTab("https://github.com/user/repo", FOCUS_WS.uuid);
  const win = makeFakeWindow({
    ready: true,
    workspaces: [FOCUS_WS],
    tabs: [existingTab],
  });

  const result = gZenSpaceRoutingManager.onBeforeAddTab(
    "https://GitHub.com/User/Repo",
    { fromExternal: true },
    win
  );

  Assert.equal(result.shouldEarlyExit, true, "Case difference still matches");
  Assert.equal(win.gBrowser.selectedTab, existingTab, "The existing tab is selected");
});

add_task(async function test_onBeforeAddTab_matches_ignoring_fragment() {
  clearAllRoutes();
  gZenSpaceRoutingManager.setFocusExistingTab(true);

  const existingTab = makeFakeTab("https://github.com/user/repo", FOCUS_WS.uuid);
  const win = makeFakeWindow({
    ready: true,
    workspaces: [FOCUS_WS],
    tabs: [existingTab],
  });

  const result = gZenSpaceRoutingManager.onBeforeAddTab(
    "https://github.com/user/repo#section",
    { fromExternal: true },
    win
  );

  Assert.equal(result.shouldEarlyExit, true, "Fragment difference still matches");
  Assert.equal(win.gBrowser.selectedTab, existingTab, "The existing tab is selected");
});
