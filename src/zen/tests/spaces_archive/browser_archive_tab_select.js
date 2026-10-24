/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_selecting_archived_tab_moves_it_here() {
  const [first, second] = await createTestSpaces(2);
  await gZenWorkspaces.changeWorkspace(second);
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "data:text/html,<title>Stray</title>",
    true,
    { skipAnimation: true }
  );
  await gZenWorkspaces.changeWorkspace(first);
  await gZenWorkspaces.archiveWorkspace(second.uuid);

  await gZenWorkspaces.switchTabIfNeeded(tab);

  is(
    gZenWorkspaces.activeWorkspace,
    first.uuid,
    "Selecting the tab does not bring the archived space back"
  );
  is(
    tab.getAttribute("zen-workspace-id"),
    first.uuid,
    "Tab moved into the active space"
  );
  is(gBrowser.selectedTab, tab, "Tab is selected");

  await gZenWorkspaces.restoreWorkspace(second.uuid);
  BrowserTestUtils.removeTab(tab);
});
