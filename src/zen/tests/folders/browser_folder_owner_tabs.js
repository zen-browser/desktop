/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Duplicate_Tab_Inside_Folder() {
  const selectedTab = gBrowser.selectedTab;
  const tab = BrowserTestUtils.addTab(gBrowser, 'about:blank');
  const folder = await gZenFolders.createFolder([tab], {
    renameFolder: false,
  });
  gBrowser.selectedTab = tab;
  const triggeringPrincipal = Services.scriptSecurityManager.getSystemPrincipal();
  gBrowser.addTab('https://example.com', {
    tabIndex: undefined,
    relatedToCurrent: true,
    ownerTab: tab,
    triggeringPrincipal,
  });

  Assert.equal(
    folder.tabs.length,
    3,
    'Folder contains the original tab and the two duplicated tabs'
  );

  await new Promise((resolve) => setTimeout(resolve, 100));

  for (const t of folder.tabs) {
    ok(t.pinned, 'All tabs in the folder should be pinned');
    if (!t.hasAttribute('zen-empty-tab')) {
      ok(t.hasAttribute('zen-pin-id'), 'All non-empty tabs should have a zen-pinned-id attribute');
    }
  }

  gBrowser.selectedTab = selectedTab;
  await removeFolder(folder);
});
