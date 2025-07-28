/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Basic_Split_View() {
  await basicSplitNTabs(async (tabs) => {
    ok(
      gBrowser.tabpanels.hasAttribute('zen-split-view'),
      'The split view should not have crashed with two tabs in it'
    );
  });
  ok(
    !gBrowser.tabpanels.hasAttribute('zen-split-view'),
    'Unsplit view should not have crashed with two tabs in it'
  );
});

add_task(async function test_Browser_Elements_Attributes() {
  await basicSplitNTabs(async (tabs) => {
    Assert.equal(
      document.querySelectorAll('.browserSidebarContainer[zen-split="true"]').length,
      2,
      'There should be two split browser sidebars'
    );
  });
  ok(
    !document.querySelector('.browserSidebarContainer[zen-split="true"]'),
    'There should be no split browser sidebars in unsplit view'
  );
});
