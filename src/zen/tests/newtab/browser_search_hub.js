/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { AboutNewTab } = ChromeUtils.importESModule(
  "resource:///modules/AboutNewTab.sys.mjs"
);
const { ZenAstraNTP, SEARCH_HUB_URL, LAYOUT_PREF } = ChromeUtils.importESModule(
  "chrome://browser/content/zen-components/ZenAstraNTP.mjs"
);
const { normalizeShortcut, defaultShortcuts } = ChromeUtils.importESModule(
  "chrome://browser/content/zen-newtab/AstraSearchHubShortcuts.mjs"
);

add_setup(async function () {
  ZenAstraNTP.init();
  registerCleanupFunction(() => {
    Services.prefs.clearUserPref(LAYOUT_PREF);
    Services.prefs.clearUserPref("astra.newtab.search-hub.shortcuts");
    ZenAstraNTP.apply();
  });
});

add_task(async function test_default_layout_is_minimal() {
  Assert.equal(
    Services.prefs.getStringPref(LAYOUT_PREF, "minimal"),
    "minimal",
    "Search Hub is opt-in; Minimal remains the default"
  );
  Assert.ok(!ZenAstraNTP.isSearchHub(), "Controller reports minimal");
});

add_task(async function test_minimal_still_intercepts_new_tab() {
  const originalTesting = gZenUIManager.testingEnabled;
  gZenUIManager.testingEnabled = false;
  await SpecialPowers.pushPrefEnv({
    set: [
      ["astra.newtab.layout", "minimal"],
      ["zen.urlbar.replace-newtab", true],
    ],
  });
  try {
    ZenAstraNTP.apply();
    Assert.ok(
      gZenUIManager.handleNewTab(false, false, "tab"),
      "Minimal layout still uses the URL-bar New Tab overlay"
    );
    gZenUIManager.handleUrlbarClose(false, false);
  } finally {
    gZenUIManager.testingEnabled = originalTesting;
    await SpecialPowers.popPrefEnv();
    ZenAstraNTP.apply();
  }
});

add_task(async function test_search_hub_overrides_newtab_url() {
  const originalTesting = gZenUIManager.testingEnabled;
  gZenUIManager.testingEnabled = false;
  await SpecialPowers.pushPrefEnv({
    set: [
      ["astra.newtab.layout", "search-hub"],
      ["zen.urlbar.replace-newtab", true],
    ],
  });
  try {
    ZenAstraNTP.apply();
    Assert.equal(
      AboutNewTab.newTabURL,
      SEARCH_HUB_URL,
      "Search Hub points AboutNewTab at the packaged chrome page"
    );
    Assert.ok(
      !gZenUIManager.handleNewTab(false, false, "tab"),
      "Search Hub does not intercept Ctrl+T as the URL-bar overlay"
    );
  } finally {
    gZenUIManager.testingEnabled = originalTesting;
    await SpecialPowers.popPrefEnv();
    ZenAstraNTP.apply();
  }
  Assert.notEqual(
    AboutNewTab.newTabURL,
    SEARCH_HUB_URL,
    "Switching back to Minimal restores the default New Tab URL"
  );
});

add_task(async function test_search_hub_page_has_no_remote_feed() {
  const tab = BrowserTestUtils.addTab(gBrowser, SEARCH_HUB_URL, {
    skipAnimation: true,
  });
  gBrowser.selectedTab = tab;
  try {
    await TestUtils.waitForCondition(() => {
      try {
        return tab.linkedBrowser?.contentDocument?.querySelector(
          ".astra-search-hub"
        );
      } catch {
        return false;
      }
    }, "Search Hub document should load");
    const doc = tab.linkedBrowser.contentDocument;
    ok(doc.querySelector(".astra-search-hub"), "Search Hub root is present");
    ok(doc.querySelector("#hub-search"), "Search form is present");
    ok(doc.querySelector(".hub-trust"), "Trust badges are present");
    ok(doc.querySelector(".hub-dock"), "Shortcut dock is present");
    ok(doc.getElementById("hub-add-dialog"), "Add shortcut dialog is present");
    is(
      doc.querySelector(
        "[data-discovery], .ds-card, #top-stories, .top-stories"
      ),
      null,
      "No Discovery Stream / news feed markup"
    );
    const html = doc.documentElement.innerHTML;
    ok(
      !/tippytop|activity-stream|pocket\.com|firefoxusercontent/i.test(html),
      "Page source does not reference tippytop, Activity Stream, or Pocket"
    );
    const images = [...doc.querySelectorAll("img")];
    ok(
      images.every(
        img =>
          !img.src ||
          img.src.startsWith("chrome://") ||
          img.src.startsWith("data:image/")
      ),
      "Images are local chrome or data URIs only"
    );
  } finally {
    BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_shortcuts_are_https_only() {
  const defaults = defaultShortcuts();
  Assert.greater(defaults.length, 0, "Catalog defaults exist");
  for (const shortcut of defaults) {
    Assert.ok(
      shortcut.url.startsWith("https://"),
      `${shortcut.id} default URL is https`
    );
  }
  Assert.equal(
    normalizeShortcut({ name: "Evil", url: "http://example.com" }),
    null,
    "HTTP shortcuts are rejected"
  );
  Assert.equal(
    normalizeShortcut({ name: "JS", url: "javascript:alert(1)" }),
    null,
    "javascript: shortcuts are rejected"
  );
  const okShortcut = normalizeShortcut({
    name: "Example",
    url: "https://example.com",
  });
  Assert.ok(okShortcut.url.startsWith("https://example.com"));
});
