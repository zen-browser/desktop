/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  PlacesTestUtils: "resource://testing-common/PlacesTestUtils.sys.mjs",
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
  UrlbarShared: "chrome://browser/content/urlbar/UrlbarShared.mjs",
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
});

const PROVIDER_NAME = "ZenUrlbarProviderRecentHistory";
const ENABLED_PREF = "zen.urlbar.suggestions.recent-history";
const MAX_RESULTS_PREF = "zen.urlbar.suggestions.recent-history.max-results";

const PAGES = [1, 2, 3, 4, 5, 6, 7].map(i => ({
  url: `https://example.com/zen-recent-${i}`,
  title: `Zen recent ${i}`,
}));

async function seedHistory(pages) {
  await PlacesUtils.history.clear();
  // Visit the pages oldest-first so the last entry is the most recent.
  const now = Date.now();
  await PlacesTestUtils.addVisits(
    pages.map((page, index) => ({
      ...page,
      visitDate: new Date(now - (pages.length - index) * 60_000),
    }))
  );
}

// Opens the view the way a user does, by focusing the bar. Typing an empty
// string instead would mark the value as typed and change how Enter behaves.
async function openEmptyUrlbar() {
  await SimpleTest.promiseFocus(window);
  await UrlbarTestUtils.promisePopupOpen(window, () => {
    EventUtils.synthesizeKey("l", { accelKey: true });
  });
  await UrlbarTestUtils.promiseSearchComplete(window);
}

async function getProviderRows() {
  const rows = [];
  for (let index = 0; index < UrlbarTestUtils.getResultCount(window); index++) {
    const { result } = await UrlbarTestUtils.getRowAt(window, index);
    if (result.providerName == PROVIDER_NAME) {
      rows.push({ index, result });
    }
  }
  return rows;
}

async function closeUrlbar() {
  await UrlbarTestUtils.promisePopupClose(window);
  gURLBar.handleRevert();
}

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      [ENABLED_PREF, true],
      [MAX_RESULTS_PREF, 5],
    ],
  });
  registerCleanupFunction(async () => {
    await PlacesUtils.history.clear();
  });
});

add_task(async function test_shows_recent_pages_newest_first() {
  await seedHistory(PAGES);
  await BrowserTestUtils.withNewTab("about:blank", async () => {
    await openEmptyUrlbar();
    const rows = await getProviderRows();
    Assert.deepEqual(
      rows.map(row => row.result.payload.url),
      PAGES.slice(-5)
        .reverse()
        .map(page => page.url),
      "The 5 most recent pages are listed, newest first"
    );
    Assert.equal(
      rows[0].result.type,
      UrlbarShared.RESULT_TYPE.URL,
      "Pages that are not open are plain URL results"
    );
    await closeUrlbar();
  });
  await PlacesUtils.history.clear();
});

add_task(async function test_first_result_is_selected() {
  await seedHistory(PAGES);
  await BrowserTestUtils.withNewTab("about:blank", async () => {
    await openEmptyUrlbar();
    const rows = await getProviderRows();
    Assert.ok(rows.length, "There are recent history results");
    Assert.equal(
      UrlbarTestUtils.getSelectedRowIndex(window),
      rows[0].index,
      "The most recent page is preselected"
    );
    Assert.equal(gURLBar.value, "", "The input value stays empty");
    await closeUrlbar();
  });
  await PlacesUtils.history.clear();
});

add_task(async function test_max_results_pref() {
  await seedHistory(PAGES);
  await SpecialPowers.pushPrefEnv({ set: [[MAX_RESULTS_PREF, 2]] });
  await BrowserTestUtils.withNewTab("about:blank", async () => {
    await openEmptyUrlbar();
    const rows = await getProviderRows();
    Assert.equal(rows.length, 2, "Only max-results pages are listed");
    await closeUrlbar();
  });
  await SpecialPowers.popPrefEnv();
  await PlacesUtils.history.clear();
});

add_task(async function test_disabled_pref() {
  await seedHistory(PAGES);
  await SpecialPowers.pushPrefEnv({ set: [[ENABLED_PREF, false]] });
  await BrowserTestUtils.withNewTab("about:blank", async () => {
    await openEmptyUrlbar();
    Assert.equal(
      (await getProviderRows()).length,
      0,
      "No recent pages are shown when the pref is off"
    );
    await closeUrlbar();
  });
  await SpecialPowers.popPrefEnv();
  await PlacesUtils.history.clear();
});

add_task(async function test_not_shown_when_typing() {
  await seedHistory(PAGES);
  await BrowserTestUtils.withNewTab("about:blank", async () => {
    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window,
      waitForFocus,
      value: "zen-recent",
    });
    Assert.equal(
      (await getProviderRows()).length,
      0,
      "The provider is inactive for a non-empty search string"
    );
    await closeUrlbar();
  });
  await PlacesUtils.history.clear();
});

add_task(async function test_current_page_is_excluded() {
  await seedHistory(PAGES);
  const current = PAGES[PAGES.length - 1];
  await BrowserTestUtils.withNewTab(current.url, async () => {
    await openEmptyUrlbar();
    const urls = (await getProviderRows()).map(row => row.result.payload.url);
    Assert.ok(!urls.includes(current.url), "The current page is not listed");
    Assert.equal(urls.length, 5, "The list is still filled up to the limit");
    await closeUrlbar();
  });
  await PlacesUtils.history.clear();
});

add_task(async function test_open_page_switches_to_tab() {
  await seedHistory(PAGES);
  const target = PAGES[PAGES.length - 1];
  const otherTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    target.url
  );
  const originalTab = gBrowser.selectedTab;
  await BrowserTestUtils.withNewTab("about:blank", async () => {
    await openEmptyUrlbar();
    const rows = await getProviderRows();
    Assert.equal(rows[0].result.payload.url, target.url, "Open page is first");
    Assert.equal(
      rows[0].result.type,
      UrlbarShared.RESULT_TYPE.TAB_SWITCH,
      "An already open page is a switch-to-tab result"
    );

    const tabCount = gBrowser.tabs.length;
    EventUtils.synthesizeKey("KEY_Enter");
    await TestUtils.waitForCondition(
      () => gBrowser.selectedTab == otherTab,
      "Waiting for the open tab to be selected"
    );
    Assert.equal(gBrowser.selectedTab, otherTab, "Jumped to the open tab");
    // The empty tab the urlbar was opened from is replaced by the switch.
    Assert.lessOrEqual(gBrowser.tabs.length, tabCount, "No new tab was opened");
    await closeUrlbar();
    gBrowser.selectedTab = originalTab;
  });
  BrowserTestUtils.removeTab(otherTab);
  await PlacesUtils.history.clear();
});

add_task(async function test_browsing_results_keeps_input_empty() {
  await seedHistory(PAGES);
  await BrowserTestUtils.withNewTab("about:blank", async () => {
    await openEmptyUrlbar();
    for (let i = 0; i < 3; i++) {
      EventUtils.synthesizeKey("KEY_ArrowDown");
      Assert.equal(gURLBar.value, "", `Input stays empty after arrow ${i + 1}`);
    }
    EventUtils.synthesizeKey("KEY_ArrowUp");
    Assert.equal(gURLBar.value, "", "Input stays empty after arrow up");
    await closeUrlbar();
  });
  await PlacesUtils.history.clear();
});

add_task(async function test_deleting_last_character_keeps_view_open() {
  await seedHistory(PAGES);
  await BrowserTestUtils.withNewTab("about:blank", async () => {
    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window,
      waitForFocus,
      value: "z",
    });
    EventUtils.synthesizeKey("KEY_Backspace");
    await UrlbarTestUtils.promiseSearchComplete(window);
    Assert.ok(gURLBar.view.isOpen, "The view stays open on an empty query");
    const rows = await getProviderRows();
    Assert.equal(rows.length, 5, "Recent pages are shown again");
    Assert.equal(
      UrlbarTestUtils.getSelectedRowIndex(window),
      rows[0].index,
      "The first page is preselected again"
    );
    await closeUrlbar();
  });
  await PlacesUtils.history.clear();
});
