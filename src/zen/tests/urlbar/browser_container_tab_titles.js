/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { PlacesTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PlacesTestUtils.sys.mjs"
);
const { UrlbarProviderOpenTabs } = ChromeUtils.importESModule(
  "moz-src:///browser/components/urlbar/UrlbarProviderOpenTabs.sys.mjs"
);

const TEST_URL = "https://example.com/?zen-urlbar-container-title-test=617db8";
const ESSENTIAL_TEST_URL =
  "https://example.com/?zen-urlbar-essential-title-test=617db8";
const WORKSPACE_NAMES = [
  "URLbar Personal Container 617db8",
  "URLbar Work Container 617db8",
];

add_setup(async function () {
  await PlacesUtils.promiseLargeCacheDBConnection();
  await UrlbarProviderOpenTabs.promiseDBPopulated;
});

add_task(async function test_container_tabs_use_their_live_labels() {
  const tabs = [];

  try {
    for (const userContextId of [1, 2]) {
      const tab = BrowserTestUtils.addTab(gBrowser, TEST_URL, {
        skipAnimation: true,
        userContextId,
      });
      tabs.push(tab);
      await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
    }

    const labels = ["Personal Gmail", "Work Gmail"];
    tabs.forEach((tab, index) => {
      tab.zenStaticLabel = labels[index];
      gBrowser._setTabLabel(tab, labels[index], {
        _zenChangeLabelFlag: true,
      });
    });
    Assert.deepEqual(
      tabs.map(tab => tab.label),
      labels,
      "The container tabs should have distinct live labels"
    );

    await PlacesTestUtils.promiseAsyncUpdates();

    const searchTab = await BrowserTestUtils.openNewForegroundTab(
      gBrowser,
      "about:newtab"
    );
    tabs.push(searchTab);

    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window,
      waitForFocus,
      value: "% zen-urlbar-container-title-test",
    });

    const queryContext = await gURLBar.lastQueryContextPromise;
    const results = queryContext.results
      .filter(result => result.payload.url == TEST_URL)
      .map(result => ({
        title: result.payload.title,
        userContextId: result.payload.userContextId,
      }))
      .sort((a, b) => a.userContextId - b.userContextId);

    Assert.deepEqual(
      results,
      [
        { title: labels[0], userContextId: 1 },
        { title: labels[1], userContextId: 2 },
      ],
      "Switch-to-tab results should use each container tab's live label"
    );
  } finally {
    for (const tab of tabs.reverse()) {
      if (gBrowser.tabs.includes(tab)) {
        BrowserTestUtils.removeTab(tab);
      }
    }
  }
});

add_task(async function test_inactive_container_essential_uses_live_label() {
  const originalWorkspaceId = gZenWorkspaces.activeWorkspace;
  const workspaceIds = [];
  const tabs = [];
  const labels = ["Personal Gmail", "Work Gmail"];

  try {
    for (let index = 0; index < WORKSPACE_NAMES.length; index++) {
      await gZenWorkspaces.createAndSaveWorkspace(
        WORKSPACE_NAMES[index],
        undefined,
        false,
        index + 1
      );
      const workspace = gZenWorkspaces
        .getWorkspaces()
        .find(candidate => candidate.name == WORKSPACE_NAMES[index]);
      Assert.ok(workspace, `Created ${WORKSPACE_NAMES[index]}`);
      workspaceIds.push(workspace.uuid);

      await gZenWorkspaces.changeWorkspace(workspace);
      const tab = BrowserTestUtils.addTab(gBrowser, ESSENTIAL_TEST_URL, {
        skipAnimation: true,
        userContextId: index + 1,
      });
      tabs.push(tab);
      await BrowserTestUtils.browserLoaded(tab.linkedBrowser);

      tab.zenStaticLabel = labels[index];
      gBrowser._setTabLabel(tab, labels[index], {
        _zenChangeLabelFlag: true,
      });
      Assert.ok(
        gZenPinnedTabManager.addToEssentials(tab),
        `Added ${labels[index]} to Essentials`
      );
      await TestUtils.waitForCondition(
        () =>
          tab.hasAttribute("zen-essential") &&
          tab.parentNode?.getAttribute("container") == String(index + 1),
        `${labels[index]} should enter its container-specific Essential section`
      );
    }

    const activeWorkspace = gZenWorkspaces
      .getWorkspaces()
      .find(workspace => workspace.uuid == workspaceIds[1]);
    await gZenWorkspaces.changeWorkspace(activeWorkspace);

    Assert.ok(
      !gBrowser.tabs.includes(tabs[0]),
      "The inactive workspace Essential should not be in gBrowser.tabs"
    );
    Assert.ok(
      gZenWorkspaces.allStoredTabs.includes(tabs[0]),
      "The inactive workspace Essential should remain in allStoredTabs"
    );

    const searchTab = BrowserTestUtils.addTab(gBrowser, "about:newtab", {
      skipAnimation: true,
      userContextId: 2,
    });
    tabs.push(searchTab);
    await BrowserTestUtils.switchTab(gBrowser, searchTab);

    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window,
      waitForFocus,
      value: "% zen-urlbar-essential-title-test",
    });

    const queryContext = await gURLBar.lastQueryContextPromise;
    const results = queryContext.results
      .filter(result => result.payload.url == ESSENTIAL_TEST_URL)
      .map(result => ({
        title: result.payload.title,
        userContextId: result.payload.userContextId,
      }))
      .sort((a, b) => a.userContextId - b.userContextId);

    Assert.deepEqual(
      results,
      [
        { title: labels[0], userContextId: 1 },
        { title: labels[1], userContextId: 2 },
      ],
      "Switch-to-tab results should include the inactive Essential's live label"
    );
  } finally {
    if (UrlbarTestUtils.isPopupOpen(window)) {
      await UrlbarTestUtils.promisePopupClose(window);
    }
    for (const tab of tabs.reverse()) {
      if (gZenWorkspaces.allStoredTabs.includes(tab)) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
    if (
      gZenWorkspaces
        .getWorkspaces()
        .some(workspace => workspace.uuid == originalWorkspaceId)
    ) {
      await gZenWorkspaces.changeWorkspace(originalWorkspaceId);
    }
    for (const workspaceId of workspaceIds.reverse()) {
      if (
        gZenWorkspaces
          .getWorkspaces()
          .some(workspace => workspace.uuid == workspaceId)
      ) {
        await gZenWorkspaces.removeWorkspace(workspaceId);
      }
    }
  }
});
