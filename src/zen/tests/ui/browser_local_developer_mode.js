/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { HttpServer } = ChromeUtils.importESModule(
  "resource://testing-common/httpd.sys.mjs"
);
const { isLocalDevelopmentURI } = ChromeUtils.importESModule(
  "resource:///modules/zen/urlbar/ZenDeveloperMode.sys.mjs"
);

const PREF = "zen.urlbar.local-developer-mode.enabled";
let localURL;

function devToolbar(win = window) {
  return win.document.getElementById("zen-developer-mode-toolbar");
}

add_setup(function () {
  const server = new HttpServer();
  server.registerPathHandler("/dev", (request, response) => {
    response.setHeader("Content-Type", "text/html");
    response.write("<!doctype html><title>Local development test</title>");
  });
  server.start(-1);
  localURL = `http://localhost:${server.identity.primaryPort}/dev?test=1`;
  registerCleanupFunction(() => new Promise(resolve => server.stop(resolve)));
});

add_task(function test_local_development_uris() {
  const cases = [
    ["http://localhost:3000", true],
    ["http://127.0.0.1:5173", true],
    // eslint-disable-next-line sdl/no-insecure-url -- IPv6 loopback must work with HTTP.
    ["http://[::1]:8080", true],
    ["https://localhost:3000", true],
    ["http://LOCALHOST:4000/path?q=1#fragment", true],
    ["https://example.com", false],
    ["https://localhost.example.com", false],
    ["http://localhost@example.com", false],
    ["http://127.0.0.2:5173", false],
    ["ftp://localhost", false],
    ["about:blank", false],
  ];

  for (const [spec, expected] of cases) {
    is(isLocalDevelopmentURI(Services.io.newURI(spec)), expected, spec);
  }
});

add_task(async function test_selection_navigation_and_reload() {
  const publicTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com/"
  );
  try {
    ok(!devToolbar(), "Public sites do not show the Developer Mode toolbar");

    await BrowserTestUtils.withNewTab(localURL, async browser => {
      const tab = gBrowser.selectedTab;
      const toolbar = devToolbar();
      is(
        toolbar.parentElement,
        gBrowser.getBrowserContainer(browser),
        "The toolbar belongs to the selected browser"
      );
      ok(
        tab.hasAttribute("zen-local-development"),
        "The sidebar tab is marked"
      );
      const address = toolbar.firstElementChild;
      is(
        address.querySelector(".zen-developer-mode-url").textContent,
        localURL,
        "The full local URL is displayed"
      );

      await BrowserTestUtils.switchTab(gBrowser, publicTab);
      ok(!toolbar.isConnected, "Switching to a public tab removes the toolbar");
      const badge = tab.querySelector(".zen-developer-mode-tab-badge");
      await document.l10n.translateElements([badge]);
      is(
        badge.getAttribute("value"),
        "DEV",
        "The local background tab keeps a DEV badge"
      );
      isnot(
        getComputedStyle(badge).display,
        "none",
        "The background badge is visible"
      );
      ok(
        !publicTab.hasAttribute("zen-local-development"),
        "The public tab stays unmarked"
      );

      const reloaded = BrowserTestUtils.browserLoaded(browser, {
        wantLoad: localURL,
      });
      browser.reload();
      await reloaded;
      ok(!devToolbar(), "A background reload does not show the toolbar");
      is(
        tab.querySelector(".zen-developer-mode-tab-badge"),
        badge,
        "A reload reuses the badge"
      );

      const blank = BrowserTestUtils.browserLoaded(browser, {
        wantLoad: "about:blank",
      });
      BrowserTestUtils.startLoadingURIString(browser, "about:blank");
      await blank;
      ok(!badge.isConnected, "A background navigation away removes the badge");

      const local = BrowserTestUtils.browserLoaded(browser, {
        wantLoad: localURL,
      });
      BrowserTestUtils.startLoadingURIString(browser, localURL);
      await local;
      ok(
        tab.querySelector(".zen-developer-mode-tab-badge"),
        "A background local navigation adds a badge"
      );

      await BrowserTestUtils.switchTab(gBrowser, tab);
      is(devToolbar(), toolbar, "Returning to a local tab reuses the toolbar");

      const loaded = BrowserTestUtils.browserLoaded(browser, {
        wantLoad: "about:blank",
      });
      BrowserTestUtils.startLoadingURIString(browser, "about:blank");
      await loaded;
      ok(!devToolbar(), "Navigating away removes the toolbar");
      ok(
        !tab.hasAttribute("zen-local-development"),
        "Navigating away clears the tab marker"
      );

      const nextURL = localURL + "&next=2";
      const back = BrowserTestUtils.browserLoaded(browser, {
        wantLoad: nextURL,
      });
      BrowserTestUtils.startLoadingURIString(browser, nextURL);
      await back;
      is(
        devToolbar().querySelector(".zen-developer-mode-url").textContent,
        nextURL,
        "Local navigation updates the full address"
      );
    });

    ok(!devToolbar(), "Closing the local tab removes the toolbar");
  } finally {
    await BrowserTestUtils.removeTab(publicTab);
  }
});

add_task(async function test_badge_recovers_when_out_of_sync() {
  await BrowserTestUtils.withNewTab(localURL, async browser => {
    const tab = gBrowser.selectedTab;
    const badgeSelector = ".zen-developer-mode-tab-badge";
    tab.querySelector(badgeSelector).remove();
    ok(
      tab.hasAttribute("zen-local-development"),
      "The local marker remains after removing the badge"
    );

    const nextURL = localURL + "&restore-badge=1";
    const loaded = BrowserTestUtils.browserLoaded(browser, {
      wantLoad: nextURL,
    });
    BrowserTestUtils.startLoadingURIString(browser, nextURL);
    await loaded;
    Assert.ok(
      tab.querySelector(badgeSelector),
      "A local update recreates the badge"
    );

    tab.removeAttribute("zen-local-development");
    const blank = BrowserTestUtils.browserLoaded(browser, {
      wantLoad: "about:blank",
    });
    BrowserTestUtils.startLoadingURIString(browser, "about:blank");
    await blank;
    ok(
      !tab.querySelector(badgeSelector),
      "A non-local update removes a stale badge"
    );
  });
});

add_task(async function test_window_isolation_and_preferences() {
  await BrowserTestUtils.withNewTab(localURL, async () => {
    const other = await BrowserTestUtils.openNewBrowserWindow({
      zenSyncedWindow: false,
    });
    try {
      ok(devToolbar(), "The original window stays in Developer Mode");
      ok(!devToolbar(other), "The other window tracks its own selected tab");

      for (const [pref, value] of [
        [PREF, false],
        ["devtools.policy.disabled", true],
      ]) {
        await SpecialPowers.pushPrefEnv({ set: [[pref, value]] });
        try {
          ok(!devToolbar(), `The toolbar respects ${pref}`);
        } finally {
          await SpecialPowers.popPrefEnv();
        }
        ok(devToolbar(), "Restoring the preference brings back the toolbar");
        ok(!devToolbar(other), "The other window stays outside Developer Mode");
      }
    } finally {
      await BrowserTestUtils.closeWindow(other);
    }
  });
});

add_task(async function test_background_adoption_between_windows() {
  await BrowserTestUtils.withNewTab(localURL, async sourceBrowser => {
    const sourceTab = gBrowser.selectedTab;
    const other = await BrowserTestUtils.openNewBrowserWindow({
      zenSyncedWindow: false,
    });
    try {
      const destinationURL = localURL + "&destination=1";
      await BrowserTestUtils.withNewTab(
        { gBrowser: other.gBrowser, url: destinationURL },
        async destinationBrowser => {
          const toolbar = devToolbar(other);
          const swapped = BrowserTestUtils.waitForEvent(
            other,
            "EndSwapDocShells",
            true,
            event => event.detail === sourceBrowser
          );
          const adopted = other.gBrowser.adoptTab(sourceTab, {
            tabIndex: other.gBrowser.tabs.length,
            selectTab: false,
          });
          Assert.ok(adopted, "The loaded local tab was adopted");
          is(
            (await swapped).target,
            adopted.linkedBrowser,
            "The destination receives the swap event"
          );
          is(
            adopted.linkedBrowser.currentURI.spec,
            localURL,
            "The adopted tab keeps its URL"
          );
          ok(
            adopted.hasAttribute("zen-local-development"),
            "The adopted tab is marked in the background"
          );
          ok(
            adopted.querySelector(".zen-developer-mode-tab-badge"),
            "The adopted tab has a DEV badge before selection"
          );
          is(
            other.gBrowser.selectedBrowser,
            destinationBrowser,
            "Adoption preserves the destination selection"
          );
          is(
            devToolbar(other),
            toolbar,
            "The destination keeps its existing toolbar"
          );
          is(
            toolbar.querySelector(".zen-developer-mode-url").textContent,
            destinationURL,
            "The toolbar still displays the selected tab's address"
          );
        }
      );
    } finally {
      await BrowserTestUtils.closeWindow(other);
    }
  });
});

add_task(async function test_toolbar_layouts_and_address_command() {
  await BrowserTestUtils.withNewTab(localURL, async browser => {
    const toolbar = devToolbar();
    const address = toolbar.firstElementChild;
    await document.l10n.translateElements([address]);
    is(
      address.getAttribute("aria-label"),
      "Edit address",
      "The address action is labeled"
    );
    is(
      toolbar.querySelectorAll("[data-tool-id]").length,
      4,
      "Four native tools are available"
    );

    for (const single of [true, false]) {
      await SpecialPowers.pushPrefEnv({
        set: [["zen.view.use-single-toolbar", single]],
      });
      try {
        await TestUtils.waitForCondition(
          () => gZenVerticalTabsManager._hasSetSingleToolbar === single,
          "The requested layout is active"
        );
        const barBounds = toolbar.getBoundingClientRect();
        const pageBounds = browser.getBoundingClientRect();
        Assert.greater(
          address.getBoundingClientRect().width,
          100,
          "The address has room to display"
        );
        Assert.greaterOrEqual(
          barBounds.width,
          pageBounds.width - 1,
          "The bar spans the page width"
        );
        Assert.lessOrEqual(
          barBounds.bottom,
          pageBounds.top,
          "The toolbar appears above the page"
        );
      } finally {
        await SpecialPowers.popPrefEnv();
      }
    }

    await SimpleTest.promiseFocus(window);
    address.focus();
    is(document.activeElement, address, "The address is keyboard focusable");
    for (const button of [...toolbar.querySelectorAll("toolbarbutton")].slice(
      1
    )) {
      EventUtils.synthesizeKey("KEY_Tab");
      is(document.activeElement, button, "Each shortcut is reached in order");
    }
    address.focus();
    EventUtils.synthesizeKey(" ");
    ok(gURLBar.focused, "The address action focuses Zen's URL editor");
  });
});

add_task(async function test_toolbar_wraps_and_copies_in_a_narrow_split() {
  const longURL = `${localURL}&path=${"x".repeat(256)}&next=%2Fkeep%3Fx%3D1#section`;
  const otherURL = "https://example.com/";
  await BrowserTestUtils.withNewTab(longURL, async () => {
    const localTab = gBrowser.selectedTab;
    const otherTab = BrowserTestUtils.addTab(gBrowser, otherURL);
    try {
      await BrowserTestUtils.browserLoaded(otherTab.linkedBrowser, {
        wantLoad: otherURL,
      });
      const activated = BrowserTestUtils.waitForEvent(
        window,
        "ZenViewSplitter:SplitViewActivated"
      );
      gZenViewSplitter.splitTabs([localTab, otherTab], "vsep");
      await activated;
      gBrowser.selectedTab = localTab;

      const leaf = gZenViewSplitter.getSplitNodeFromTab(localTab);
      const narrowShare =
        (150 / gBrowser.tabpanels.getBoundingClientRect().width) * 100;
      for (const node of leaf.parent.children) {
        node.sizeInParent = node === leaf ? narrowShare : 100 - narrowShare;
      }
      gZenViewSplitter.applyGridLayout(leaf.parent);

      const toolbar = devToolbar();
      await TestUtils.waitForCondition(
        () => toolbar.getBoundingClientRect().width < 180,
        "The local pane reaches its narrow width"
      );
      const bounds = toolbar.getBoundingClientRect();
      Assert.greater(
        toolbar.firstElementChild.getBoundingClientRect().width,
        64,
        "The address retains readable space in a narrow pane"
      );
      for (const button of toolbar.querySelectorAll("toolbarbutton")) {
        const rect = button.getBoundingClientRect();
        ok(
          rect.width > 0 &&
            rect.left >= bounds.left &&
            rect.right <= bounds.right,
          "The button fits inside the narrow toolbar"
        );
      }

      const addressText = toolbar.querySelector(".zen-developer-mode-url");
      Assert.greater(
        addressText.scrollWidth,
        addressText.clientWidth,
        "The long URL is truncated visually"
      );
      is(
        addressText.textContent,
        longURL,
        "The toolbar retains the complete URL"
      );
      gBrowser.addToMultiSelectedTabs(otherTab);
      ok(
        gBrowser.selectedTabs.includes(otherTab),
        "The other tab is multiselected"
      );
      const copyButton = toolbar.querySelector(
        '[data-l10n-id="zen-developer-mode-copy-address"]'
      );
      await SimpleTest.promiseClipboardChange(longURL, () =>
        copyButton.doCommand()
      );
    } finally {
      await BrowserTestUtils.removeTab(otherTab);
    }
  });
});
