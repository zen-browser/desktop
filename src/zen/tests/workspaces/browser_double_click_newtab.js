/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [['zen.urlbar.replace-newtab', false]],
  });

  registerCleanupFunction(async () => {
    await SpecialPowers.popPrefEnv();
  });
});

add_task(async function test_Check_Creation() {
  const placeToDoubleClick = gZenWorkspaces.activeWorkspaceElement.querySelector(
    '.zen-workspace-empty-space'
  );
  ok(placeToDoubleClick, 'We should have found the place to double click.');
  EventUtils.sendMouseEvent({ type: 'dblclick' }, placeToDoubleClick, window);
  await TestUtils.waitForCondition(() => gBrowser.tabs.length === 3, 'New tab should be opened.');
  ok(true, 'New tab should be opened.');
  await BrowserTestUtils.removeTab(gBrowser.tabs[1]);
  ok(gBrowser.tabs.length === 2, 'There should be one tab.');
});
