/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_resolve_workspace_from_string() {
  const originalWorkspaceUUID = gZenWorkspaces.activeWorkspace;
  await gZenWorkspaces.createAndSaveWorkspace("Cmdline Space");
  const created = gZenWorkspaces
    .getWorkspaces()
    .find(workspace => workspace.name === "Cmdline Space");
  Assert.ok(created, "The new workspace should exist.");
  registerCleanupFunction(async () => {
    if (gZenWorkspaces.getWorkspaceFromId(created.uuid)) {
      await gZenWorkspaces.changeWorkspaceWithID(originalWorkspaceUUID);
      await gZenWorkspaces.removeWorkspace(created.uuid);
    }
  });

  Assert.strictEqual(
    gZenWorkspaces.resolveWorkspaceFromCLIString(created.uuid)?.uuid,
    created.uuid,
    "Workspaces should resolve by UUID."
  );
  Assert.strictEqual(
    gZenWorkspaces.resolveWorkspaceFromCLIString("cmdline space")?.uuid,
    created.uuid,
    "Workspaces should resolve by name, case-insensitively."
  );
  Assert.strictEqual(
    gZenWorkspaces.resolveWorkspaceFromCLIString("does-not-exist"),
    null,
    "Unknown workspaces should resolve to null."
  );
  Assert.strictEqual(
    gZenWorkspaces.resolveWorkspaceFromCLIString(null),
    null,
    "Empty values should resolve to null."
  );

  await gZenWorkspaces.removeWorkspace(created.uuid);
  Assert.strictEqual(
    gZenWorkspaces.activeWorkspace,
    originalWorkspaceUUID,
    "We should be back on the original workspace."
  );
});

add_task(async function test_change_workspace_from_command_line() {
  const originalWorkspaceUUID = gZenWorkspaces.activeWorkspace;
  await gZenWorkspaces.createAndSaveWorkspace("Cmdline Target");
  const target = gZenWorkspaces
    .getWorkspaces()
    .find(workspace => workspace.name === "Cmdline Target");
  Assert.ok(target, "The target workspace should exist.");
  registerCleanupFunction(async () => {
    if (gZenWorkspaces.getWorkspaceFromId(target.uuid)) {
      await gZenWorkspaces.changeWorkspaceWithID(originalWorkspaceUUID);
      await gZenWorkspaces.removeWorkspace(target.uuid);
    }
  });

  await gZenWorkspaces.changeWorkspaceWithID(originalWorkspaceUUID);
  Assert.strictEqual(
    gZenWorkspaces.activeWorkspace,
    originalWorkspaceUUID,
    "We should start from the original workspace."
  );

  // Matching by name is case-insensitive.
  await gZenWorkspaces.changeWorkspaceFromCommandLine("cmdline target");
  Assert.strictEqual(
    gZenWorkspaces.activeWorkspace,
    target.uuid,
    "The command line flag should switch to the target workspace."
  );

  await gZenWorkspaces.changeWorkspaceWithID(originalWorkspaceUUID);
  // Matching by UUID also works.
  await gZenWorkspaces.changeWorkspaceFromCommandLine(target.uuid);
  Assert.strictEqual(
    gZenWorkspaces.activeWorkspace,
    target.uuid,
    "The command line flag should switch to the target workspace by UUID."
  );

  await gZenWorkspaces.changeWorkspaceWithID(originalWorkspaceUUID);
  await gZenWorkspaces.removeWorkspace(target.uuid);
  Assert.strictEqual(
    gZenWorkspaces.activeWorkspace,
    originalWorkspaceUUID,
    "We should be back on the original workspace."
  );
});

add_task(async function test_command_line_space_container_used_immediately() {
  const { ContextualIdentityService } = ChromeUtils.importESModule(
    "moz-src:///toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs"
  );
  const targetContainer =
    ContextualIdentityService.getPublicIdentities()[0].userContextId;

  const originalWorkspaceUUID = gZenWorkspaces.activeWorkspace;
  await gZenWorkspaces.createAndSaveWorkspace(
    "Cmdline Container",
    undefined,
    /* dontChange */ true,
    targetContainer
  );
  const target = gZenWorkspaces
    .getWorkspaces()
    .find(workspace => workspace.name === "Cmdline Container");
  Assert.ok(target, "The target workspace should exist.");
  registerCleanupFunction(async () => {
    if (gZenWorkspaces.getWorkspaceFromId(target.uuid)) {
      await gZenWorkspaces.changeWorkspaceWithID(originalWorkspaceUUID);
      await gZenWorkspaces.removeWorkspace(target.uuid);
    }
  });

  Assert.strictEqual(
    gZenWorkspaces.activeWorkspace,
    originalWorkspaceUUID,
    "We should still be on the original workspace."
  );
  Assert.notStrictEqual(
    gZenWorkspaces.getWorkspaceFromId(originalWorkspaceUUID)?.containerTabId,
    targetContainer,
    "The two workspaces must use different containers for this to mean anything."
  );

  // Deliberately not awaited: BrowserContentHandler opens a URL from the same
  // command line in the same tick, before the switch has finished.
  const switching =
    gZenWorkspaces.changeWorkspaceFromCommandLine("cmdline container");

  Assert.strictEqual(
    gZenWorkspaces.getContextIdIfNeeded(undefined, false, null)[0],
    targetContainer,
    "A tab opened while the switch runs gets the destination's container."
  );

  await switching;
  Assert.strictEqual(
    gZenWorkspaces.activeWorkspace,
    target.uuid,
    "The command line flag should switch to the target workspace."
  );
  Assert.strictEqual(
    gZenWorkspaces.getContextIdIfNeeded(undefined, false, null)[0],
    targetContainer,
    "The container still comes from the destination once it is active."
  );

  await gZenWorkspaces.changeWorkspaceWithID(originalWorkspaceUUID);
  Assert.notStrictEqual(
    gZenWorkspaces.getContextIdIfNeeded(undefined, false, null)[0],
    targetContainer,
    "Switching back makes new tabs follow the active space again."
  );
  await gZenWorkspaces.removeWorkspace(target.uuid);
});

add_task(async function test_unknown_workspace_does_not_switch() {
  const originalWorkspaceUUID = gZenWorkspaces.activeWorkspace;

  await gZenWorkspaces.changeWorkspaceFromCommandLine("does-not-exist");

  Assert.strictEqual(
    gZenWorkspaces.activeWorkspace,
    originalWorkspaceUUID,
    "An unknown workspace should not switch spaces."
  );
});

add_task(async function test_initial_tab_gets_cmdline_space_container() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.testing.enabled", false],
      ["zen.urlbar.open-on-startup", false],
    ],
  });
  const { ContextualIdentityService } = ChromeUtils.importESModule(
    "moz-src:///toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs"
  );
  const container =
    ContextualIdentityService.getPublicIdentities()[0].userContextId;

  const originalWorkspaceUUID = gZenWorkspaces.activeWorkspace;
  await gZenWorkspaces.createAndSaveWorkspace(
    "Cmdline Container Cold",
    undefined,
    /* dontChange */ true,
    container
  );
  const target = gZenWorkspaces
    .getWorkspaces()
    .find(workspace => workspace.name === "Cmdline Container Cold");
  Assert.ok(target, "The target workspace should exist.");
  registerCleanupFunction(async () => {
    Services.prefs.clearUserPref("zen.workspaces.cmdline-initial-workspace");
    if (gZenWorkspaces.getWorkspaceFromId(target.uuid)) {
      await gZenWorkspaces.changeWorkspaceWithID(originalWorkspaceUUID);
      await gZenWorkspaces.removeWorkspace(target.uuid);
    }
  });

  // A window being created has no space cache of its own yet, so the lookup
  // falls back to the session store. Collect into it the way a session save
  // would, which is what has happened by the time a real cold start gets here.
  const { ZenSessionStore } = ChromeUtils.importESModule(
    "resource:///modules/zen/ZenSessionManager.sys.mjs"
  );
  ZenSessionStore.saveState(JSON.parse(SessionStore.getBrowserState()), true);
  Assert.ok(
    gZenWorkspaces
      .getWorkspaces(true)
      .some(workspace => workspace.uuid === target.uuid),
    "The session store knows about the target workspace."
  );

  // Simulates the pref stashed by `--space` on a cold start, see
  // BrowserContentHandler.sys.mjs.
  Services.prefs.setStringPref(
    "zen.workspaces.cmdline-initial-workspace",
    "cmdline container cold"
  );

  const newWindow = await BrowserTestUtils.openNewBrowserWindow();
  await newWindow.gZenWorkspaces.promiseInitialized;

  Assert.strictEqual(
    newWindow.gZenWorkspaces.activeWorkspace,
    target.uuid,
    "The new window should start on the requested workspace."
  );
  // Zen puts its own empty tab first, so the tab carrying the startup URI is
  // the one that is not it.
  const initialTab = [...newWindow.gBrowser.tabs].find(
    tab => !tab.hasAttribute("zen-empty-tab")
  );
  Assert.ok(initialTab, "The new window has a real initial tab.");
  // A tab's container is fixed when it is created, so this is the assertion
  // that the flag was honoured before the initial tab existed.
  Assert.strictEqual(
    initialTab.getAttribute("usercontextid"),
    String(container),
    "The initial tab is created in the requested space's container."
  );
  Assert.strictEqual(
    initialTab.getAttribute("zenDefaultUserContextId"),
    "true",
    "The container counts as the space's default, not one the tab asked for."
  );

  await BrowserTestUtils.closeWindow(newWindow);
  await gZenWorkspaces.changeWorkspaceWithID(originalWorkspaceUUID);
  await gZenWorkspaces.removeWorkspace(target.uuid);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_initial_workspace_pref_consumed_on_restore() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.testing.enabled", false],
      ["zen.urlbar.open-on-startup", false],
    ],
  });
  const originalWorkspaceUUID = gZenWorkspaces.activeWorkspace;
  await gZenWorkspaces.createAndSaveWorkspace("Cmdline Cold Start");
  const target = gZenWorkspaces
    .getWorkspaces()
    .find(workspace => workspace.name === "Cmdline Cold Start");
  Assert.ok(target, "The target workspace should exist.");
  registerCleanupFunction(async () => {
    Services.prefs.clearUserPref("zen.workspaces.cmdline-initial-workspace");
    if (gZenWorkspaces.getWorkspaceFromId(target.uuid)) {
      await gZenWorkspaces.changeWorkspaceWithID(originalWorkspaceUUID);
      await gZenWorkspaces.removeWorkspace(target.uuid);
    }
  });

  // Simulates the pref stashed by `--space` on a cold start, see
  // BrowserContentHandler.sys.mjs.
  Services.prefs.setStringPref(
    "zen.workspaces.cmdline-initial-workspace",
    "cmdline cold start"
  );

  const newWindow = await BrowserTestUtils.openNewBrowserWindow();
  await newWindow.gZenWorkspaces.promiseInitialized;

  Assert.strictEqual(
    newWindow.gZenWorkspaces.activeWorkspace,
    target.uuid,
    "The restored window should start on the requested workspace."
  );
  Assert.strictEqual(
    Services.prefs.getStringPref(
      "zen.workspaces.cmdline-initial-workspace",
      ""
    ),
    "",
    "The pref should be consumed by the restored window."
  );

  await BrowserTestUtils.closeWindow(newWindow);
  await gZenWorkspaces.changeWorkspaceWithID(originalWorkspaceUUID);
  await gZenWorkspaces.removeWorkspace(target.uuid);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_initial_workspace_pref_survives_private_window() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.testing.enabled", false],
      ["zen.urlbar.open-on-startup", false],
    ],
  });
  Services.prefs.setStringPref(
    "zen.workspaces.cmdline-initial-workspace",
    "does-not-matter"
  );
  registerCleanupFunction(() => {
    Services.prefs.clearUserPref("zen.workspaces.cmdline-initial-workspace");
  });

  const privateWindow = await BrowserTestUtils.openNewBrowserWindow({
    private: true,
  });
  await privateWindow.gZenWorkspaces.promiseInitialized;

  Assert.strictEqual(
    Services.prefs.getStringPref(
      "zen.workspaces.cmdline-initial-workspace",
      ""
    ),
    "does-not-matter",
    "A private window should not consume the initial workspace pref."
  );

  await BrowserTestUtils.closeWindow(privateWindow);
  Services.prefs.clearUserPref("zen.workspaces.cmdline-initial-workspace");
  await SpecialPowers.popPrefEnv();
});
