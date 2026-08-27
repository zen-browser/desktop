/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
  PlacesTestUtils: "resource://testing-common/PlacesTestUtils.sys.mjs",
  UrlbarShared: "chrome://browser/content/urlbar/UrlbarShared.mjs",
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
});

const PROVIDER_NAME = "ZenUrlbarProviderEssentials";
const TEST_ROOT = "https://example.com/browser/zen/tests/urlbar/";

function addTab(win, path, title, options = {}) {
  const tab = win.gBrowser.addTrustedTab(TEST_ROOT + path, {
    inBackground: true,
    skipAnimation: true,
    ...options,
  });
  tab.setAttribute("label", title);
  return tab;
}

function addEssential(win, path, title, options = {}) {
  const tab = addTab(win, path, title, options);
  win.gZenPinnedTabManager.addToEssentials(tab);
  Assert.ok(tab.hasAttribute("zen-essential"), `${title} is an Essential`);
  return tab;
}

async function search(win, value) {
  await SimpleTest.promiseFocus(win);
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window: win,
    waitForFocus,
    value,
  });

  const rows = [];
  const count = UrlbarTestUtils.getResultCount(win);
  for (let i = 0; i < count; i++) {
    rows.push(await UrlbarTestUtils.getRowAt(win, i));
  }
  return rows;
}

async function closePopup(win) {
  if (UrlbarTestUtils.isPopupOpen(win)) {
    await UrlbarTestUtils.promisePopupClose(win, () =>
      EventUtils.synthesizeKey("KEY_Escape", {}, win)
    );
  }
}

async function pickRow(win, row, condition, message) {
  EventUtils.synthesizeMouseAtCenter(row, {}, win);
  await TestUtils.waitForCondition(condition, message);
}

async function removeTab(tab) {
  if (!tab?.closing && tab?.isConnected) {
    await BrowserTestUtils.removeTab(tab);
  }
}

add_task(async function test_essential_is_first_in_ordinary_search() {
  const source = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    TEST_ROOT + "ranking-source"
  );
  const ordinary = addTab(window, "settings-ordinary", "Settings ordinary tab");
  const essential = addEssential(
    window,
    "settings-essential",
    "Settings Essential"
  );
  const historyUrl = TEST_ROOT + "settings-history";

  try {
    await PlacesTestUtils.addVisits({
      uri: historyUrl,
      title: "Settings history",
    });
    const rows = await search(window, "settings");

    Assert.equal(
      rows[0].result.providerName,
      PROVIDER_NAME,
      "The Essential ranks ahead of all ordinary results"
    );
    Assert.ok(
      rows.some(
        ({ result }) => result.providerName == "ZenUrlbarProviderGlobalActions"
      ),
      "A matching action is present below the Essential"
    );
    Assert.ok(
      rows.some(
        ({ result }) =>
          result.type == UrlbarShared.RESULT_TYPE.TAB_SWITCH &&
          result.providerName != PROVIDER_NAME
      ),
      "An ordinary open-tab match is present below the Essential"
    );
    Assert.ok(
      rows.some(
        ({ result }) =>
          result.payload.url == historyUrl &&
          result.providerName != PROVIDER_NAME
      ),
      "A history match is present below the Essential"
    );
  } finally {
    await closePopup(window);
    await PlacesUtils.history.remove(historyUrl);
    await removeTab(essential);
    await removeTab(ordinary);
    await removeTab(source);
  }
});

add_task(async function test_selection_uses_exact_essential_target() {
  const source = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    TEST_ROOT + "exact-source"
  );
  const urlPath = "duplicate-mail";
  const ordinary = addTab(window, urlPath, "Ordinary duplicate");
  const essential = addEssential(window, urlPath, "Mail Essential");

  try {
    const tabCount = gBrowser.tabs.length;
    const rows = await search(window, "duplicate mail");
    Assert.equal(rows[0].result.providerName, PROVIDER_NAME);

    await pickRow(
      window,
      rows[0].row,
      () => gBrowser.selectedTab == essential,
      "The exact Essential tab should be selected"
    );
    Assert.notEqual(
      gBrowser.selectedTab,
      ordinary,
      "The ordinary tab with the same URL is not selected"
    );
    Assert.equal(
      gBrowser.tabs.length,
      tabCount,
      "Selecting the Essential does not create a duplicate"
    );
  } finally {
    await closePopup(window);
    await removeTab(essential);
    await removeTab(ordinary);
    await removeTab(source);
  }
});

add_task(async function test_multiple_same_url_essentials_keep_identity() {
  const source = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    TEST_ROOT + "multiple-source"
  );
  const first = addEssential(
    window,
    "shared-essential-url",
    "Calendar Essential"
  );
  const second = addEssential(
    window,
    "shared-essential-url",
    "Mail Essential Target"
  );

  try {
    const rows = await search(window, "mail essential target");
    Assert.equal(rows[0].result.providerName, PROVIDER_NAME);
    await pickRow(
      window,
      rows[0].row,
      () => gBrowser.selectedTab == second,
      "The matching Essential instance should be selected"
    );
    Assert.notEqual(
      gBrowser.selectedTab,
      first,
      "The other Essential with the same URL is not selected"
    );
  } finally {
    await closePopup(window);
    await removeTab(second);
    await removeTab(first);
    await removeTab(source);
  }
});

add_task(async function test_container_essential_switches_workspace() {
  const originalWorkspace = gZenWorkspaces.getActiveWorkspaceFromCache();
  const containerWorkspace = await gZenWorkspaces.createAndSaveWorkspace(
    "Essential container workspace",
    undefined,
    false,
    1
  );
  await gZenWorkspaces.changeWorkspace(containerWorkspace);
  const essential = addEssential(
    window,
    "container-mail",
    "Container Mail Essential",
    { userContextId: 1 }
  );
  await gZenWorkspaces.changeWorkspace(originalWorkspace);

  try {
    const rows = await search(window, "container mail");
    Assert.equal(rows[0].result.payload.userContextId, 1);
    await pickRow(
      window,
      rows[0].row,
      () =>
        gZenWorkspaces.activeWorkspace == containerWorkspace.uuid &&
        gBrowser.selectedTab == essential,
      "Selecting the Essential should switch container workspace"
    );
  } finally {
    await closePopup(window);
    await removeTab(essential);
    await gZenWorkspaces.changeWorkspace(originalWorkspace);
    await gZenWorkspaces.removeWorkspace(containerWorkspace.uuid);
  }
});

add_task(async function test_pending_essential_uses_session_state() {
  const source = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    TEST_ROOT + "pending-source"
  );
  const essential = addEssential(
    window,
    "pending-mail",
    "Pending Mail Essential",
    {
      createLazyBrowser: true,
      lazyTabTitle: "Pending Mail Essential",
    }
  );

  try {
    Assert.ok(
      essential.hasAttribute("pending") || !essential.linkedPanel,
      "The Essential starts pending or without a linked panel"
    );
    const rows = await search(window, "pending mail");
    Assert.equal(rows[0].result.providerName, PROVIDER_NAME);
    await pickRow(
      window,
      rows[0].row,
      () => gBrowser.selectedTab == essential,
      "The pending Essential should be selected"
    );
  } finally {
    await closePopup(window);
    await removeTab(essential);
    await removeTab(source);
  }
});

add_task(async function test_stale_result_does_not_open_url() {
  const source = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    TEST_ROOT + "stale-source"
  );
  const essential = addEssential(window, "stale-mail", "Stale Mail Essential");

  try {
    const rows = await search(window, "stale mail");
    const { result, row } = rows[0];
    Assert.equal(result.providerName, PROVIDER_NAME);

    await removeTab(essential);
    const tabCount = gBrowser.tabs.length;
    const sourceUrl = gBrowser.currentURI.spec;
    gURLBar.pickResult(
      result,
      new KeyboardEvent("keydown", { key: "Enter" }),
      row
    );
    await TestUtils.waitForTick();

    Assert.equal(
      gBrowser.tabs.length,
      tabCount,
      "A stale result does not create a tab"
    );
    Assert.equal(
      gBrowser.currentURI.spec,
      sourceUrl,
      "A stale result does not load its URL"
    );
  } finally {
    await closePopup(window);
    await removeTab(source);
  }
});

add_task(async function test_cross_window_switch_and_private_isolation() {
  const otherWin = await BrowserTestUtils.openNewBrowserWindow();
  await otherWin.gZenWorkspaces.promiseInitialized;
  const crossWindowEssential = addTab(
    otherWin,
    "cross-window-mail",
    "Cross Window Mail"
  );
  // Mark directly so window sync does not replicate another Essential into the
  // source window and hide whether the exact cross-window target was selected.
  crossWindowEssential.setAttribute("zen-essential", "true");

  let privateWin;
  try {
    const rows = await search(window, "cross window mail");
    Assert.equal(rows[0].result.providerName, PROVIDER_NAME);
    await pickRow(
      window,
      rows[0].row,
      () => otherWin.gBrowser.selectedTab == crossWindowEssential,
      "The Essential's owning window should select it"
    );

    privateWin = await BrowserTestUtils.openNewBrowserWindow({ private: true });
    await privateWin.gZenWorkspaces.promiseInitialized;
    const privateEssential = addTab(
      privateWin,
      "private-only-essential",
      "Private Only Essential"
    );
    privateEssential.setAttribute("zen-essential", "true");

    await SimpleTest.promiseFocus(window);
    let privateRows = await search(window, "private only essential");
    Assert.ok(
      !privateRows.some(({ result }) => result.providerName == PROVIDER_NAME),
      "A normal window does not see a private Essential"
    );
    await closePopup(window);

    const normalEssential = addEssential(
      window,
      "normal-only-essential",
      "Normal Only Essential"
    );
    try {
      privateRows = await search(privateWin, "normal only essential");
      Assert.ok(
        !privateRows.some(({ result }) => result.providerName == PROVIDER_NAME),
        "A private window does not see a normal Essential"
      );
    } finally {
      await closePopup(privateWin);
      await removeTab(normalEssential);
    }
  } finally {
    await closePopup(window);
    if (privateWin) {
      await BrowserTestUtils.closeWindow(privateWin);
    }
    await BrowserTestUtils.closeWindow(otherWin);
  }
});

add_task(async function test_current_essential_is_not_suggested() {
  const essential = addEssential(
    window,
    "current-mail-essential",
    "Current Mail Essential"
  );
  gBrowser.selectedTab = essential;

  try {
    const rows = await search(window, "current mail essential");
    Assert.ok(
      !rows.some(({ result }) => result.providerName == PROVIDER_NAME),
      "The current Essential is omitted"
    );
  } finally {
    await closePopup(window);
    await removeTab(essential);
  }
});
