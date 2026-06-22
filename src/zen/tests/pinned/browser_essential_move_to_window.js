/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_URL = "https://example.com/";

function isInEssentialsContainer(tab) {
  return !!tab.parentElement.closest(".zen-essentials-container");
}

add_task(async function test_Move_Essential_Tab_To_Window_Duplicates() {
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    TEST_URL,
    true
  );

  gZenPinnedTabManager.addToEssentials(tab);
  ok(tab.hasAttribute("zen-essential"), "The original tab is essential");
  ok(isInEssentialsContainer(tab), "The original tab is in Essentials");

  const essentialCount = gBrowser._numZenEssentials;
  const newWindowPromise = BrowserTestUtils.waitForNewWindow();
  const openedWindow = gBrowser.replaceTabWithWindow(tab);
  is(openedWindow, null, "Moving an Essential tab is deferred until restored");

  const newWindow = await newWindowPromise;
  await BrowserTestUtils.waitForCondition(
    () => newWindow.gBrowser.selectedBrowser.currentURI.spec == TEST_URL,
    "The duplicated tab loaded in the new window"
  );

  const duplicatedTab = newWindow.gBrowser.selectedTab;
  ok(
    tab.hasAttribute("zen-essential"),
    "The original tab remains marked as essential"
  );
  ok(
    isInEssentialsContainer(tab),
    "The original tab remains in the Essentials container"
  );
  is(
    gBrowser._numZenEssentials,
    essentialCount,
    "The source window keeps the same number of Essentials"
  );
  ok(
    !duplicatedTab.hasAttribute("zen-essential"),
    "The new window receives a regular tab copy"
  );
  ok(!duplicatedTab.pinned, "The new window tab is not pinned");
  is(
    duplicatedTab.linkedBrowser.currentURI.spec,
    TEST_URL,
    "The new window tab keeps the original URL"
  );

  await BrowserTestUtils.closeWindow(newWindow);
  await BrowserTestUtils.removeTab(tab);
});

add_task(async function test_Move_Essential_Waits_For_Duplicate_Restore() {
  let newWindow;
  let windowOpened = false;
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    TEST_URL,
    true
  );
  const duplicate = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.org/",
    true
  );

  gZenPinnedTabManager.addToEssentials(tab);
  const originalDuplicateTab = gBrowser.duplicateTab;
  gBrowser.duplicateTab = () => duplicate;

  try {
    const newWindowPromise = BrowserTestUtils.waitForNewWindow().then(win => {
      windowOpened = true;
      return win;
    });

    gBrowser.replaceTabWithWindow(tab);
    await TestUtils.waitForTick();
    ok(!windowOpened, "The new window waits for the duplicate to restore");

    duplicate.dispatchEvent(new CustomEvent("SSTabRestored"));
    newWindow = await newWindowPromise;
    is(
      newWindow.gBrowser.selectedBrowser.currentURI.spec,
      "https://example.org/",
      "The restored duplicate is moved to the new window"
    );
  } finally {
    gBrowser.duplicateTab = originalDuplicateTab;
    if (newWindow && !newWindow.closed) {
      await BrowserTestUtils.closeWindow(newWindow);
    }
    for (const candidate of [tab, duplicate]) {
      if (candidate.isConnected && !candidate.closing) {
        await BrowserTestUtils.removeTab(candidate);
      }
    }
  }
});

add_task(async function test_Move_Multiple_Essentials_Waits_For_Restore() {
  let newWindow;
  let windowOpened = false;
  const sourceTabs = [
    await BrowserTestUtils.openNewForegroundTab(gBrowser, TEST_URL, true),
    await BrowserTestUtils.openNewForegroundTab(
      gBrowser,
      "https://example.org/",
      true
    ),
  ];
  const duplicateTabs = [
    await BrowserTestUtils.openNewForegroundTab(
      gBrowser,
      "https://example.net/",
      true
    ),
    await BrowserTestUtils.openNewForegroundTab(
      gBrowser,
      "https://example.com/?duplicate=2",
      true
    ),
  ];

  for (const tab of sourceTabs) {
    gZenPinnedTabManager.addToEssentials(tab);
    gBrowser.addToMultiSelectedTabs(tab);
  }

  const duplicatesBySource = new Map(
    sourceTabs.map((tab, index) => [tab, duplicateTabs[index]])
  );
  const originalDuplicateTab = gBrowser.duplicateTab;
  gBrowser.duplicateTab = tab => duplicatesBySource.get(tab);

  try {
    const newWindowPromise = BrowserTestUtils.waitForNewWindow().then(win => {
      windowOpened = true;
      return win;
    });

    gBrowser.replaceTabsWithWindow(sourceTabs[0]);
    duplicateTabs[0].dispatchEvent(new CustomEvent("SSTabRestored"));
    await TestUtils.waitForTick();
    ok(!windowOpened, "The new window waits for every duplicate to restore");

    duplicateTabs[1].dispatchEvent(new CustomEvent("SSTabRestored"));
    newWindow = await newWindowPromise;
    const expectedURLs = [
      "https://example.net/",
      "https://example.com/?duplicate=2",
    ];
    await BrowserTestUtils.waitForCondition(
      () =>
        expectedURLs.every(url =>
          newWindow.gBrowser.tabs.some(
            tab => tab.linkedBrowser.currentURI.spec == url
          )
        ),
      "All restored duplicates moved to the new window"
    );

    const movedURLs = newWindow.gBrowser.tabs
      .map(tab => tab.linkedBrowser.currentURI.spec)
      .filter(url => expectedURLs.includes(url));
    Assert.deepEqual(
      movedURLs,
      expectedURLs,
      "The restored duplicates keep their order and URLs"
    );
  } finally {
    gBrowser.duplicateTab = originalDuplicateTab;
    if (newWindow && !newWindow.closed) {
      await BrowserTestUtils.closeWindow(newWindow);
    }
    for (const candidate of [...sourceTabs, ...duplicateTabs]) {
      if (candidate.isConnected && !candidate.closing) {
        await BrowserTestUtils.removeTab(candidate);
      }
    }
  }
});

add_task(async function test_Forced_Sync_Moves_Essential_Tab() {
  let newWindow;
  let duplicated = false;
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    TEST_URL,
    true
  );

  gZenPinnedTabManager.addToEssentials(tab);
  ok(tab.hasAttribute("zen-essential"), "The original tab is essential");

  const originalDuplicateTab = gBrowser.duplicateTab;
  gBrowser.duplicateTab = (...args) => {
    duplicated = true;
    return originalDuplicateTab.apply(gBrowser, args);
  };

  try {
    const newWindowPromise = BrowserTestUtils.waitForNewWindow();
    const openedWindow = gBrowser.replaceTabWithWindow(
      tab,
      {},
      /* zenForceSync = */ true
    );
    ok(openedWindow, "Forced sync opens a new window for the Essential tab");

    newWindow = await newWindowPromise;
    ok(!duplicated, "Forced sync does not duplicate an Essential tab");
  } finally {
    gBrowser.duplicateTab = originalDuplicateTab;

    if (newWindow && !newWindow.closed) {
      await BrowserTestUtils.closeWindow(newWindow);
    }
    for (const candidate of [...gBrowser.tabs]) {
      if (
        candidate.linkedBrowser.currentURI.spec == TEST_URL &&
        !candidate.closing
      ) {
        await BrowserTestUtils.removeTab(candidate);
      }
    }
  }
});

add_task(async function test_Move_Tab_Group_Label_To_Window_Still_Works() {
  let newWindow;
  const tab1 = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    TEST_URL,
    true
  );
  const tab2 = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.org/",
    true
  );

  try {
    const group = gBrowser.addTabGroup([tab1, tab2], { insertBefore: tab1 });

    const newWindowPromise = BrowserTestUtils.waitForNewWindow();
    const openedWindow = gBrowser.replaceTabWithWindow(group.labelElement);
    ok(openedWindow, "Moving a tab group label opens a new window");

    newWindow = await newWindowPromise;
    await BrowserTestUtils.waitForCondition(
      () => newWindow.gBrowser.tabs.length >= 2,
      "The grouped tabs moved to the new window"
    );

    is(
      newWindow.gBrowser.tabs.length,
      2,
      "The new window receives both grouped tabs"
    );
  } finally {
    if (newWindow && !newWindow.closed) {
      await BrowserTestUtils.closeWindow(newWindow);
    }
    const blankTab = await BrowserTestUtils.openNewForegroundTab(
      gBrowser,
      "about:blank",
      true
    );
    for (const tab of [...gBrowser.tabs]) {
      if (tab == blankTab) {
        continue;
      }
      if (tab.isConnected && !tab.closing) {
        await BrowserTestUtils.removeTab(tab);
      }
    }
  }
});
