/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const URL = "https://example.com/?archived-switch-to-tab";

add_task(async function test_only_archived_tabs_are_detected() {
  const [first, second] = await createTestSpaces(2);
  await gZenWorkspaces.changeWorkspace(second);
  const archivedTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    URL,
    true,
    { skipAnimation: true }
  );
  await gZenWorkspaces.changeWorkspace(first);

  ok(
    !gZenWorkspaces.isUrlOnlyInArchivedSpaces(URL),
    "A tab in a visible space can be switched to"
  );

  await gZenWorkspaces.archiveWorkspace(second.uuid);
  ok(
    gZenWorkspaces.isUrlOnlyInArchivedSpaces(URL),
    "Once archived, the unloaded tab isn't offered anymore"
  );

  const visibleTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    URL,
    true,
    { skipAnimation: true }
  );
  ok(
    !gZenWorkspaces.isUrlOnlyInArchivedSpaces(URL),
    "The same URL in a visible space is still offered"
  );
  ok(
    !gZenWorkspaces.isUrlOnlyInArchivedSpaces("https://example.com/?nope"),
    "A URL that isn't open anywhere isn't flagged"
  );

  BrowserTestUtils.removeTab(visibleTab);
  await gZenWorkspaces.restoreWorkspace(second.uuid);
  BrowserTestUtils.removeTab(archivedTab);
});
