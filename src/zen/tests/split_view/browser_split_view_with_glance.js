/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

const { openGlanceOnTab } = ChromeUtils.importESModule(
  'resource://testing-common/GlanceTestUtils.sys.mjs'
);

add_task(async function test_Basic_Split_View_Glance() {
  await basicSplitNTabs(async (tabs) => {
    await openGlanceOnTab(window, async (glanceTab) => {
      ok(
        glanceTab.hasAttribute('zen-glance-tab'),
        'The glance tab should have the zen-glance-tab attribute'
      );
      ok(
        gBrowser.tabpanels.hasAttribute('zen-split-view'),
        'The split view should not have crashed with two tabs in it'
      );
    });
  });
});

add_task(async function test_Basic_Split_View_Glance_Expand() {
  await basicSplitNTabs(async (tabs) => {
    await openGlanceOnTab(
      window,
      async (glanceTab) => {
        await gZenGlanceManager.fullyOpenGlance();
        ok(
          !glanceTab.hasAttribute('zen-glance-tab'),
          'The glance tab should not have the zen-glance-tab attribute after expanding'
        );
        ok(!glanceTab.group, 'The glance tab should not be in a split group after expanding');
        for (const tab of tabs) {
          ok(
            tab.group.hasAttribute('split-view-group'),
            'All tabs in the split view should still be in a split group after expanding glance'
          );
        }
        const selectedBrowser = document.querySelectorAll('.browserSidebarContainer.deck-selected');
        Assert.equal(
          selectedBrowser.length,
          1,
          'There should be one selected browser sidebar after expanding glance'
        );
        BrowserTestUtils.removeTab(glanceTab);
      },
      false
    );
  });
});

add_task(async function test_Basic_Split_View_Glance_No_More_Split() {
  await basicSplitNTabs(
    async (tabs) => {
      await openGlanceOnTab(window, async (glanceTab) => {
        ok(
          document.getElementById('cmd_zenGlanceSplit').getAttribute('disabled') === 'true',
          'The split command should be disabled when glance is open'
        );
      });
    },
    'grid',
    4
  );
});

add_task(async function test_Basic_Split_View_Glance_Split() {
  const tab = await addTabTo(gBrowser, getUrlForNthTab(1));
  gBrowser.selectedTab = tab;
  await openGlanceOnTab(
    window,
    async (glanceTab) => {
      const waitForSplitPromise = BrowserTestUtils.waitForEvent(
        window,
        'ZenViewSplitter:SplitViewActivated'
      );
      document.getElementById('cmd_zenGlanceSplit').doCommand();
      await waitForSplitPromise;
      ok(
        !glanceTab.hasAttribute('zen-glance-tab'),
        'The glance tab should not have the zen-glance-tab attribute after splitting'
      );
      ok(
        gBrowser.tabpanels.hasAttribute('zen-split-view'),
        'The split view should not have crashed with two tabs in it'
      );
      ok(
        glanceTab.group.hasAttribute('split-view-group'),
        'The glance tab should be in a split group after splitting'
      );
      Assert.equal(
        tab.group,
        glanceTab.group,
        'The original tab should be in the same split group as the glance tab after splitting'
      );
      BrowserTestUtils.removeTab(glanceTab);
    },
    false
  );
  BrowserTestUtils.removeTab(tab);
});
