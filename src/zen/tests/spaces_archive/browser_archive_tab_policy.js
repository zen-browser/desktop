/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function openTabsInSpace(space) {
  await gZenWorkspaces.changeWorkspace(space);
  const normal = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "data:text/html,<title>Normal</title>",
    true,
    { skipAnimation: true }
  );
  const pinned = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "data:text/html,<title>Pinned</title>",
    true,
    { skipAnimation: true }
  );
  gBrowser.pinTab(pinned);
  return { normal, pinned };
}

add_task(async function test_keep_policy_unloads_normal_tabs() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.workspaces.archive.normal-tabs", "keep"]],
  });
  const [first, second] = await createTestSpaces(2);
  const { normal, pinned } = await openTabsInSpace(second);
  await gZenWorkspaces.changeWorkspace(first);

  await gZenWorkspaces.archiveWorkspace(second.uuid);

  ok(normal.isConnected, "Normal tab is kept");
  ok(normal.hasAttribute("pending"), "Normal tab is unloaded");
  ok(pinned.isConnected, "Pinned tab is kept");
  ok(pinned.hasAttribute("pending"), "Pinned tab is unloaded");

  await gZenWorkspaces.restoreWorkspace(second.uuid);
  BrowserTestUtils.removeTab(normal);
  BrowserTestUtils.removeTab(pinned);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_close_policy_closes_only_normal_tabs() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.workspaces.archive.normal-tabs", "close"]],
  });
  const [first, second] = await createTestSpaces(2);
  const { normal, pinned } = await openTabsInSpace(second);
  await gZenWorkspaces.changeWorkspace(first);

  const closed = BrowserTestUtils.waitForTabClosing(normal);
  await gZenWorkspaces.archiveWorkspace(second.uuid);
  await closed;

  ok(!normal.isConnected, "Normal tab is closed");
  ok(pinned.isConnected, "Pinned tab is kept");

  await gZenWorkspaces.restoreWorkspace(second.uuid);
  BrowserTestUtils.removeTab(pinned);
  await SpecialPowers.popPrefEnv();
});
