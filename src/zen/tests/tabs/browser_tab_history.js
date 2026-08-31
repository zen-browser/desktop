/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_ROOT = "data:text/plain,tab-history-";

async function selectTab(tab, browserWindow = window) {
  if (browserWindow.gBrowser.selectedTab == tab) {
    return;
  }
  const selected = BrowserTestUtils.waitForEvent(
    browserWindow,
    "TabSelect",
    false,
    event => event.target == tab
  );
  browserWindow.gBrowser.selectedTab = tab;
  await selected;
}

add_task(async function test_tab_history_back_forward_and_branching() {
  const originalTab = gBrowser.selectedTab;
  const tabs = ["a", "b", "c", "d"].map(name =>
    BrowserTestUtils.addTab(gBrowser, TEST_ROOT + name, {
      inBackground: true,
      skipAnimation: true,
    })
  );
  const [tabA, tabB, tabC, tabD] = tabs;

  try {
    await SimpleTest.promiseFocus(window);
    await selectTab(tabA);
    await selectTab(tabB);
    await selectTab(tabC);

    Assert.ok(gZenTabHistory.canGoBack(window), "Back history is available");
    Assert.ok(
      !gZenTabHistory.canGoForward(window),
      "Forward history is unavailable at the newest entry"
    );

    const selectedB = BrowserTestUtils.waitForEvent(
      window,
      "TabSelect",
      false,
      event => event.target == tabB
    );
    document.getElementById("cmd_zenTabHistoryBack").doCommand();
    await selectedB;
    Assert.equal(gBrowser.selectedTab, tabB, "The Back command selects tab B");

    Assert.ok(await gZenTabHistory.goBack(window), "A second Back succeeds");
    Assert.equal(gBrowser.selectedTab, tabA, "A second Back selects tab A");

    const selectedBAgain = BrowserTestUtils.waitForEvent(
      window,
      "TabSelect",
      false,
      event => event.target == tabB
    );
    document.getElementById("cmd_zenTabHistoryForward").doCommand();
    await selectedBAgain;
    Assert.equal(
      gBrowser.selectedTab,
      tabB,
      "The Forward command selects tab B"
    );

    await selectTab(tabD);
    Assert.ok(
      !gZenTabHistory.canGoForward(window),
      "A manual selection clears the forward branch"
    );
    Assert.ok(
      !(await gZenTabHistory.goForward(window)),
      "Forward is a no-op after branching"
    );
    Assert.equal(
      gBrowser.selectedTab,
      tabD,
      "The branched tab remains selected"
    );
  } finally {
    if (!originalTab.closing) {
      await selectTab(originalTab);
    }
    for (const tab of tabs) {
      if (!tab.closing) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});

add_task(async function test_tab_history_skips_closed_tabs() {
  const originalTab = gBrowser.selectedTab;
  const tabA = BrowserTestUtils.addTab(gBrowser, TEST_ROOT + "closed-a", {
    inBackground: true,
    skipAnimation: true,
  });
  const tabB = BrowserTestUtils.addTab(gBrowser, TEST_ROOT + "closed-b", {
    inBackground: true,
    skipAnimation: true,
  });
  const tabC = BrowserTestUtils.addTab(gBrowser, TEST_ROOT + "closed-c", {
    inBackground: true,
    skipAnimation: true,
  });

  try {
    await SimpleTest.promiseFocus(window);
    await selectTab(tabA);
    await selectTab(tabB);
    await selectTab(tabC);
    await BrowserTestUtils.removeTab(tabB);

    Assert.ok(await gZenTabHistory.goBack(window), "Back skips a closed entry");
    Assert.equal(
      gBrowser.selectedTab,
      tabA,
      "Back selects the previous open tab"
    );
  } finally {
    if (!originalTab.closing) {
      await selectTab(originalTab);
    }
    for (const tab of [tabA, tabC]) {
      if (!tab.closing) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});

add_task(async function test_tab_history_navigates_across_workspaces() {
  const originalWorkspace = gZenWorkspaces.getActiveWorkspaceFromCache();
  const originalTab = gBrowser.selectedTab;
  const sourceTab = BrowserTestUtils.addTab(
    gBrowser,
    TEST_ROOT + "workspace-source",
    {
      inBackground: true,
      skipAnimation: true,
    }
  );
  const targetWorkspace = await gZenWorkspaces.createAndSaveWorkspace(
    "Tab history target workspace"
  );
  let targetTab;

  try {
    await SimpleTest.promiseFocus(window);
    await selectTab(sourceTab);
    await gZenWorkspaces.changeWorkspace(targetWorkspace);
    targetTab = BrowserTestUtils.addTab(
      gBrowser,
      TEST_ROOT + "workspace-target",
      {
        inBackground: true,
        skipAnimation: true,
      }
    );
    await gZenWorkspaces.changeWorkspace(originalWorkspace);

    Assert.ok(
      await gZenTabHistory.navigateTo(window, window, targetTab),
      "A history navigation selects a tab in another workspace"
    );
    Assert.equal(
      gZenWorkspaces.activeWorkspace,
      targetWorkspace.uuid,
      "The target workspace becomes active"
    );
    Assert.equal(gBrowser.selectedTab, targetTab, "The target tab is selected");

    Assert.ok(
      await gZenTabHistory.goBack(window),
      "Back returns to the source workspace"
    );
    Assert.equal(
      gZenWorkspaces.activeWorkspace,
      originalWorkspace.uuid,
      "Back restores the source workspace"
    );
    Assert.equal(
      gBrowser.selectedTab,
      sourceTab,
      "Back restores the source tab"
    );

    Assert.ok(
      await gZenTabHistory.goForward(window),
      "Forward returns to the target workspace"
    );
    Assert.equal(
      gBrowser.selectedTab,
      targetTab,
      "Forward restores the target tab"
    );
  } finally {
    if (targetTab && !targetTab.closing) {
      await BrowserTestUtils.removeTab(targetTab);
    }
    await gZenWorkspaces.changeWorkspace(originalWorkspace);
    await gZenWorkspaces.removeWorkspace(targetWorkspace.uuid);
    if (!originalTab.closing) {
      await selectTab(originalTab);
    }
    if (!sourceTab.closing) {
      await BrowserTestUtils.removeTab(sourceTab);
    }
  }
});

add_task(async function test_tab_history_navigates_across_windows() {
  const originalTabs = new Set(gBrowser.tabs);
  const originalTab = gBrowser.selectedTab;
  const sourceTab = BrowserTestUtils.addTab(
    gBrowser,
    TEST_ROOT + "cross-window-source",
    {
      inBackground: true,
      skipAnimation: true,
    }
  );
  let otherWindow;

  try {
    await SimpleTest.promiseFocus(window);
    await selectTab(sourceTab);

    otherWindow = await BrowserTestUtils.openNewBrowserWindow();
    await otherWindow.gZenWorkspaces.promiseInitialized;
    const targetTab = BrowserTestUtils.addTab(
      otherWindow.gBrowser,
      TEST_ROOT + "cross-window-target",
      {
        inBackground: true,
        skipAnimation: true,
      }
    );

    await SimpleTest.promiseFocus(window);
    Assert.ok(
      await gZenTabHistory.navigateTo(window, otherWindow, targetTab),
      "A cross-window navigation selects its target"
    );
    Assert.equal(
      otherWindow.gBrowser.selectedTab,
      targetTab,
      "The target tab is selected in its owning window"
    );

    Assert.ok(
      await otherWindow.gZenTabHistory.goBack(otherWindow),
      "Back returns to the source window"
    );
    Assert.equal(
      gBrowser.selectedTab,
      sourceTab,
      "Back restores the source tab"
    );
    Assert.equal(
      Services.wm.getMostRecentWindow("navigator:browser"),
      window,
      "Back focuses the source window"
    );

    Assert.ok(
      await gZenTabHistory.goForward(window),
      "Forward returns to the target window"
    );
    Assert.equal(
      otherWindow.gBrowser.selectedTab,
      targetTab,
      "Forward restores the target tab"
    );
    Assert.equal(
      Services.wm.getMostRecentWindow("navigator:browser"),
      otherWindow,
      "Forward focuses the target window"
    );
  } finally {
    if (otherWindow && !otherWindow.closed) {
      await BrowserTestUtils.closeWindow(otherWindow);
    }
    await SimpleTest.promiseFocus(window);
    if (!originalTab.closing) {
      await selectTab(originalTab);
    }
    for (const tab of [...gBrowser.tabs]) {
      if (!originalTabs.has(tab) && !tab.closing) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});
