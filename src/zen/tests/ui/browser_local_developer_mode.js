/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { HttpServer } = ChromeUtils.importESModule(
  "resource://testing-common/httpd.sys.mjs"
);
const { isLocalDevelopmentURI } = ChromeUtils.importESModule(
  "resource:///modules/zen/urlbar/ZenDeveloperMode.sys.mjs"
);
const { UrlbarTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/UrlbarTestUtils.sys.mjs"
);

const PREF = "zen.urlbar.local-developer-mode.enabled";
let localURL;

function devToolbar(win = window) {
  return win.document.getElementById("zen-developer-mode-toolbar");
}

function devNavControls() {
  return document.getElementById("zen-developer-mode-nav-controls");
}

async function checkLocalizedAttribute(element, id, name, description) {
  const [message] = await document.l10n.formatMessages([{ id }]);
  const expected = message?.attributes?.find(
    attribute => attribute.name === name
  )?.value;
  Assert.ok(expected, `${id} provides a ${name} attribute`);
  await document.l10n.translateElements([element]);
  is(element.getAttribute(name), expected, description);
}

function checkOverflowIndicator(button) {
  const indicator = button.querySelector(".zen-developer-mode-menu-indicator");
  const icon = button.icon.getBoundingClientRect();
  const marker = indicator.getBoundingClientRect();
  const bounds = button.getBoundingClientRect();
  const rtl = getComputedStyle(button).direction === "rtl";
  is(
    indicator.getAttribute("aria-hidden"),
    "true",
    "The indicator is decorative"
  );
  ok(
    marker.width > 0 &&
      marker.height <= icon.height &&
      marker.left >= bounds.left &&
      marker.right <= bounds.right &&
      (rtl ? marker.right <= icon.left : marker.left >= icon.right),
    "The chevron fits at the inline end of the developer icon"
  );
}

async function withMultipleToolbars(task) {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.view.use-single-toolbar", false]],
  });
  try {
    await TestUtils.waitForCondition(
      () => !gZenVerticalTabsManager._hasSetSingleToolbar,
      "Multiple Toolbars is active"
    );
    await task();
  } finally {
    await SpecialPowers.popPrefEnv();
    await TestUtils.waitForCondition(
      () => gZenVerticalTabsManager._hasSetSingleToolbar,
      "Single Toolbar is restored"
    );
  }
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
      await checkLocalizedAttribute(
        badge,
        "zen-developer-mode-tab-badge",
        "value",
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
    await checkLocalizedAttribute(
      address,
      "zen-developer-mode-edit-address",
      "aria-label",
      "The address action is labeled"
    );
    is(
      toolbar.querySelectorAll(".zen-developer-mode-shortcuts [data-tool-id]")
        .length,
      4,
      "Four native tools are available"
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
      "The toolbar is above the page"
    );
    ok(
      devNavControls().hidden,
      "Single Toolbar hides the top developer controls"
    );
    isnot(
      getComputedStyle(toolbar).backgroundImage,
      "none",
      "The fallback has stripes"
    );
    is(
      getComputedStyle(
        toolbar.querySelector(".zen-developer-mode-control .toolbarbutton-text")
      ).display,
      "none",
      "The fallback uses icon-only shortcuts"
    );

    await SimpleTest.promiseFocus(window);
    address.focus();
    is(document.activeElement, address, "The address is keyboard focusable");
    for (const button of toolbar.querySelectorAll(
      ".zen-developer-mode-shortcuts toolbarbutton"
    )) {
      EventUtils.synthesizeKey("KEY_Tab");
      is(document.activeElement, button, "Each shortcut is reached in order");
    }
    address.focus();
    EventUtils.synthesizeKey(" ");
    ok(gURLBar.focused, "The address action focuses Zen's URL editor");
  });
});

add_task(async function test_multiple_toolbar_keeps_native_address_commands() {
  await BrowserTestUtils.withNewTab(localURL, async browser => {
    const urlbar = gURLBar;
    const anchor = urlbar.parentNode;
    const controls = devNavControls();
    await SimpleTest.promiseFocus(window);
    urlbar.focus();
    await withMultipleToolbars(async () => {
      await TestUtils.waitForCondition(
        () => !controls.hidden,
        "The top controls are shown"
      );
      ok(!devToolbar(), "Multiple Toolbars does not show a duplicate URL row");
      is(gURLBar, urlbar, "The existing URL bar is reused");
      is(gURLBar.parentNode, anchor, "The autocomplete anchor stays in place");
      is(
        controls.previousElementSibling.id,
        "nav-bar-customization-target",
        "Utilities are at the end of the customizable area"
      );

      const background = gURLBar.querySelector(".urlbar-background");
      gURLBar.blur();
      await TestUtils.waitForCondition(
        () =>
          getComputedStyle(background).backgroundImage.includes(
            "repeating-linear-gradient"
          ),
        "The resting local URL field has stripes"
      );
      await UrlbarTestUtils.promisePopupOpen(window, () =>
        EventUtils.synthesizeKey("l", { accelKey: true })
      );
      ok(gURLBar.focused, "Cmd/Ctrl+L focuses the existing URL bar");
      is(
        getComputedStyle(background).backgroundImage,
        "none",
        "The stripe treatment leaves the field while editing"
      );
      await UrlbarTestUtils.promisePopupClose(window, () =>
        EventUtils.synthesizeKey("KEY_Escape")
      );
      is(browser.currentURI.spec, localURL, "Escape keeps the committed URL");

      const nextURL = localURL + "&native-navigation=1#committed";
      await UrlbarTestUtils.promiseAutocompleteResultPopup({
        window,
        waitForFocus: SimpleTest.waitForFocus,
        value: nextURL,
      });
      ok(gURLBar.view.isOpen, "Native autocomplete opens on a local page");
      const loaded = BrowserTestUtils.browserLoaded(browser, {
        wantLoad: nextURL,
      });
      EventUtils.synthesizeKey("KEY_Enter");
      await loaded;
      is(
        browser.currentURI.spec,
        nextURL,
        "Enter navigates using the native field"
      );
      const pendingURL = localURL + "&native-navigation=draft#uncommitted";
      browser.userTypedValue = pendingURL.replace("://", "://dev:example@");
      try {
        await SimpleTest.promiseClipboardChange(pendingURL, () =>
          document.getElementById("cmd_zenCopyCurrentURL").doCommand()
        );
        await SimpleTest.promiseClipboardChange(nextURL, () =>
          controls.querySelector("toolbarbutton[data-copy-address]").doCommand()
        );
      } finally {
        browser.userTypedValue = null;
      }

      await SpecialPowers.pushPrefEnv({
        set: [["zen.urlbar.replace-newtab", false]],
      });
      let newTab;
      try {
        const opened = BrowserTestUtils.waitForNewTab(gBrowser, "about:blank");
        EventUtils.synthesizeKey("t", { accelKey: true });
        newTab = await opened;
        ok(
          gURLBar.focused,
          "Cmd/Ctrl+T opens a tab and focuses the native URL bar"
        );
        ok(controls.hidden, "A non-loopback tab hides developer controls");
      } finally {
        if (newTab) {
          await BrowserTestUtils.removeTab(newTab);
        }
        await SpecialPowers.popPrefEnv();
      }
    });
    await TestUtils.waitForCondition(
      () => devToolbar() && controls.hidden,
      "The page toolbar returns after the live layout change"
    );
  });
});

add_task(async function test_native_copy_visibility_with_developer_controls() {
  await SpecialPowers.pushPrefEnv({
    set: [
      [PREF, true],
      ["zen.urlbar.single-toolbar-show-copy-url", true],
    ],
  });
  try {
    await BrowserTestUtils.withNewTab(localURL, async browser => {
      const nativeCopy = document.getElementById("zen-copy-url-button");
      const controls = devNavControls();
      const otherURL = "https://example.com/?native-copy=1#restored";
      const visible = () => nativeCopy.checkVisibility();
      gURLBar.blur();
      ok(visible(), "Single Toolbar honors the native copy preference");

      await withMultipleToolbars(async () => {
        ok(!visible(), "Native copy is hidden on the local tab");
        await BrowserTestUtils.withNewTab(otherURL, async () => {
          ok(visible(), "Switching to a non-loopback tab restores native copy");
          await SimpleTest.promiseClipboardChange(otherURL, () =>
            nativeCopy.click()
          );
        });
        is(
          gBrowser.selectedBrowser,
          browser,
          "The local tab is selected again"
        );
        ok(!visible(), "Returning to the local tab hides native copy again");

        await SpecialPowers.pushPrefEnv({ set: [[PREF, false]] });
        try {
          ok(visible(), "Disabling Developer Mode restores native copy");
        } finally {
          await SpecialPowers.popPrefEnv();
        }
        ok(!visible(), "Re-enabling Developer Mode hides native copy again");

        for (const [url, expected] of [
          [otherURL, true],
          [localURL, false],
        ]) {
          const loaded = BrowserTestUtils.browserLoaded(browser, {
            wantLoad: url,
          });
          BrowserTestUtils.startLoadingURIString(browser, url);
          await loaded;
          is(
            visible(),
            expected,
            `Navigation updates native copy visibility for ${url}`
          );
        }
      });

      ok(
        controls.hidden && devToolbar(),
        "Switching layouts restores the page toolbar"
      );
      ok(visible(), "Switching back to Single Toolbar restores native copy");
    });
  } finally {
    await SpecialPowers.popPrefEnv();
  }
});

add_task(async function test_developer_toolbar_contrast_preferences() {
  const context = window.docShell.browsingContext;
  const contrast = context.prefersContrastOverride;
  const colors = context.forcedColorsOverride;

  function checkStripes(surface) {
    const background = () => getComputedStyle(surface).backgroundImage;
    try {
      context.prefersContrastOverride = "more";
      ok(
        matchMedia("(prefers-contrast: more)").matches,
        "Increased contrast is active"
      );
      is(
        background(),
        "none",
        "Increased contrast removes the decorative stripes"
      );

      context.prefersContrastOverride = "no-preference";
      context.forcedColorsOverride = "active";
      ok(
        matchMedia("(forced-colors: active)").matches,
        "Forced colors are active"
      );
      is(background(), "none", "Forced colors remove the decorative stripes");
    } finally {
      context.forcedColorsOverride = colors;
      context.prefersContrastOverride = contrast;
    }
  }

  await BrowserTestUtils.withNewTab(localURL, async () => {
    checkStripes(devToolbar());
    await withMultipleToolbars(async () => {
      gURLBar.blur();
      const background = gURLBar.querySelector(".urlbar-background");
      await TestUtils.waitForCondition(
        () => getComputedStyle(background).backgroundImage !== "none",
        "The native field has stripes before applying contrast overrides"
      );
      checkStripes(background);
    });
  });
});

add_task(async function test_compact_toolbar_placement() {
  await withMultipleToolbars(async () => {
    await BrowserTestUtils.withNewTab(localURL, async () => {
      const manager = gZenCompactModeManager;
      const controls = devNavControls();
      const topWrapper = document.getElementById(
        "zen-appcontent-navbar-wrapper"
      );
      await SpecialPowers.pushPrefEnv({
        set: [
          ["zen.view.compact.hide-tabbar", true],
          ["zen.view.compact.hide-toolbar", false],
          ["zen.view.compact.enable-at-startup", false],
          [
            "zen.tabs.vertical.right-side",
            !gZenVerticalTabsManager.isWindowsStyledButtons,
          ],
        ],
      });
      async function toggleCompact(value) {
        const toggled = BrowserTestUtils.waitForEvent(
          window,
          "ZenCompactMode:Toggled",
          false,
          event => event.detail === value
        );
        manager.preference = value;
        await toggled;
      }
      try {
        await toggleCompact(true);
        ok(
          !controls.hidden && !devToolbar(),
          "Compact hide-sidebar keeps the persistent top controls"
        );
        manager.hideBoth();
        await TestUtils.waitForCondition(
          () => controls.hidden && devToolbar(),
          "Compact hide-both uses the page fallback"
        );
        const fallback = devToolbar();
        topWrapper.setAttribute("zen-has-hover", "true");
        await TestUtils.waitForTick();
        ok(
          controls.hidden,
          "A temporary top-toolbar reveal does not move the controls"
        );
        is(
          devToolbar(),
          fallback,
          "The page fallback stays mounted during the reveal"
        );
        topWrapper.removeAttribute("zen-has-hover");
        manager.hideToolbar();
        await TestUtils.waitForCondition(
          () => !manager.canHideSidebar && manager.canHideToolbar,
          "The toolbar-only hidden layout is active"
        );
        ok(
          controls.hidden && devToolbar(),
          "Compact hide-toolbar keeps the page fallback"
        );
        manager.hideSidebar();
        await TestUtils.waitForCondition(
          () => !controls.hidden && !devToolbar(),
          "Keeping the top toolbar visible restores its controls"
        );
        await SpecialPowers.pushPrefEnv({
          set: [["zen.view.use-single-toolbar", true]],
        });
        try {
          await TestUtils.waitForCondition(
            () => controls.hidden && devToolbar(),
            "Single Toolbar uses the page fallback in Compact Mode"
          );
        } finally {
          await SpecialPowers.popPrefEnv();
          await TestUtils.waitForCondition(
            () => !controls.hidden && !devToolbar(),
            "The top controls return to Compact Multiple Toolbars"
          );
        }
      } finally {
        topWrapper.removeAttribute("zen-has-hover");
        if (manager.preference) {
          await toggleCompact(false);
        }
        await SpecialPowers.popPrefEnv();
      }
    });
  });
});

add_task(async function test_narrow_native_toolbar_overflow() {
  await withMultipleToolbars(async () => {
    await BrowserTestUtils.withNewTab(localURL, async browser => {
      const originalWidth = window.outerWidth;
      const originalHeight = window.outerHeight;
      const controls = devNavControls();
      const overflow = controls.querySelector(".zen-developer-mode-overflow");
      const firstShortcut = controls.querySelector(
        ".zen-developer-mode-control"
      );
      const tabStop = controls.querySelector("toolbartabstop");
      await SpecialPowers.pushPrefEnv({
        set: [["browser.toolbars.keyboard_navigation", true]],
      });
      try {
        await SimpleTest.promiseFocus(window);
        window.resizeTo(1200, originalHeight);
        await TestUtils.waitForCondition(
          () => !controls.hidden && !overflow.checkVisibility(),
          "Wide top chrome exposes the direct shortcuts"
        );
        tabStop.focus();
        is(
          document.activeElement,
          firstShortcut,
          "The tab stop enters the shortcut group"
        );
        window.resizeTo(650, originalHeight);
        await TestUtils.waitForCondition(
          () =>
            document.activeElement === overflow &&
            !firstShortcut.checkVisibility(),
          "Focus moves to the overflow when top chrome narrows"
        );
        ok(
          !devToolbar(),
          "The narrow native layout still has only one address row"
        );
        Assert.greater(
          gURLBar.getBoundingClientRect().width,
          100,
          "The native field retains usable width"
        );
        const field = gURLBar.querySelector(".urlbar-background");
        const menuFollowsField = () => {
          const fieldBounds = field.getBoundingClientRect();
          const menuBounds = overflow.getBoundingClientRect();
          return Services.locale.isAppLocaleRTL
            ? menuBounds.right <= fieldBounds.left
            : fieldBounds.right <= menuBounds.left;
        };
        await TestUtils.waitForCondition(
          menuFollowsField,
          "The overflow button does not overlap the native field"
        );
        await checkLocalizedAttribute(
          overflow,
          "zen-developer-mode-overflow",
          "label",
          "The native menu has an accessible label"
        );
        checkOverflowIndicator(overflow);
        window.resizeTo(1200, originalHeight);
        await TestUtils.waitForCondition(
          () =>
            document.activeElement === firstShortcut &&
            !overflow.checkVisibility(),
          "Focus moves back to a shortcut when top chrome widens"
        );

        gURLBar.focus();
        window.resizeTo(650, originalHeight);
        await TestUtils.waitForCondition(
          () => overflow.checkVisibility(),
          "The overflow appears while the URL bar holds focus"
        );
        is(
          document.activeElement,
          gURLBar.inputField,
          "Narrowing preserves focus in the URL bar"
        );
        gURLBar.view.close();
        browser.focus();
        window.resizeTo(1200, originalHeight);
        await TestUtils.waitForCondition(
          () => !overflow.checkVisibility(),
          "The shortcuts return while the page holds focus"
        );
        is(
          document.activeElement,
          browser,
          "Widening preserves focus in the page"
        );
      } finally {
        window.resizeTo(originalWidth, originalHeight);
        await SpecialPowers.popPrefEnv();
      }
    });
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
      function resizeLocalPane(width) {
        const share =
          (width / gBrowser.tabpanels.getBoundingClientRect().width) * 100;
        for (const node of leaf.parent.children) {
          node.sizeInParent = node === leaf ? share : 100 - share;
        }
        gZenViewSplitter.applyGridLayout(leaf.parent);
      }

      const toolbar = devToolbar();
      const overflow = toolbar.querySelector(".zen-developer-mode-overflow");
      const firstShortcut = toolbar.querySelector(
        ".zen-developer-mode-control"
      );
      resizeLocalPane(430);
      await TestUtils.waitForCondition(
        () => firstShortcut.checkVisibility(),
        "The wide pane shows the direct shortcuts"
      );
      firstShortcut.focus();
      is(
        document.activeElement,
        firstShortcut,
        "A split-pane shortcut has focus"
      );
      resizeLocalPane(150);
      await TestUtils.waitForCondition(
        () =>
          document.activeElement === overflow &&
          !firstShortcut.checkVisibility(),
        "Narrowing the split pane moves focus to its overflow"
      );
      resizeLocalPane(430);
      await TestUtils.waitForCondition(
        () =>
          document.activeElement === firstShortcut &&
          !overflow.checkVisibility(),
        "Widening the split pane moves focus back to a shortcut"
      );
      resizeLocalPane(150);
      await TestUtils.waitForCondition(
        () =>
          toolbar.getBoundingClientRect().width < 180 &&
          document.activeElement === overflow,
        "The local pane reaches its narrow width"
      );
      const bounds = toolbar.getBoundingClientRect();
      Assert.greater(
        toolbar.firstElementChild.getBoundingClientRect().width,
        64,
        "The address retains readable space in a narrow pane"
      );
      await checkLocalizedAttribute(
        overflow,
        "zen-developer-mode-overflow",
        "label",
        "The narrow pane has a labeled overflow menu"
      );
      checkOverflowIndicator(overflow);
      for (const button of [toolbar.firstElementChild, overflow]) {
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
      const popup = overflow.menupopup;
      toolbar.firstElementChild.focus();
      EventUtils.synthesizeKey("KEY_Tab");
      is(document.activeElement, overflow, "Tab reaches the fallback menu");
      const shown = BrowserTestUtils.waitForEvent(popup, "popupshown");
      overflow.open = true;
      await shown;
      await SimpleTest.promiseClipboardChange(longURL, () =>
        popup.querySelector("[data-copy-address]").doCommand()
      );
      popup.hidePopup();
    } finally {
      await BrowserTestUtils.removeTab(otherTab);
    }
  });
});
