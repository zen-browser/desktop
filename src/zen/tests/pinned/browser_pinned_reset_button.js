/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function pinAndNavigateTab(url, navigateTo) {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, url);
  gBrowser.pinTab(tab);
  await gBrowser.TabStateFlusher.flush(tab.linkedBrowser);
  await new Promise(r => setTimeout(r, 500));

  BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, navigateTo);
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser, false, navigateTo);
  return tab;
}

add_task(async function test_ResetPinButton_SelectsTab() {
  const tab = await pinAndNavigateTab(
    "https://example.com/1",
    "https://example.com/2"
  );

  // Open another tab and select it
  const otherTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com/other"
  );
  Assert.notEqual(
    gBrowser.selectedTab,
    tab,
    "The pinned tab should not be selected initially"
  );

  // Simulate clicking the reset pin button (without Accel key)
  gZenPinnedTabManager._onTabResetPinButton(
    {
      stopPropagation() {},
      getModifierState() {
        return false;
      },
    },
    tab
  );

  // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
  await new Promise(r => setTimeout(r, 100));

  Assert.strictEqual(
    gBrowser.selectedTab,
    tab,
    "The pinned tab should be selected after reset"
  );
  ok(
    !tab.hasAttribute("zen-pinned-changed"),
    "zen-pinned-changed should be removed after reset"
  );

  gBrowser.removeTab(otherTab);
  gBrowser.removeTab(tab);
});

add_task(async function test_ResetPinButton_CmdClick_DuplicatesAndResets() {
  const originalUrl = "https://example.com/1";
  const navigatedUrl = "https://example.com/2";
  const tab = await pinAndNavigateTab(originalUrl, navigatedUrl);
  const tabCountBefore = gBrowser.tabs.length;

  // Simulate CMD+click on the reset pin button
  gZenPinnedTabManager._onTabResetPinButton(
    {
      stopPropagation() {},
      getModifierState() {
        return true;
      },
    },
    tab
  );

  // Wait for the duplicate tab to be restored
  const restoredEvent = await BrowserTestUtils.waitForEvent(
    gBrowser.tabContainer,
    "SSTabRestored"
  );
  const newTab = restoredEvent.target;
  // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
  await new Promise(r => setTimeout(r, 100));

  Assert.equal(
    gBrowser.tabs.length,
    tabCountBefore + 1,
    "A new tab should be created from the duplicate"
  );
  Assert.equal(
    newTab.linkedBrowser.currentURI.spec,
    navigatedUrl,
    "The duplicated tab should have the navigated URL"
  );
  ok(!newTab.pinned, "The duplicated tab should not be pinned");

  Assert.strictEqual(
    gBrowser.selectedTab,
    tab,
    "The pinned tab should be selected after CMD+click reset"
  );
  ok(
    !tab.hasAttribute("zen-pinned-changed"),
    "zen-pinned-changed should be removed after reset"
  );
  Assert.equal(
    tab.linkedBrowser.currentURI.spec,
    originalUrl,
    "The pinned tab should be reset to the original URL"
  );

  gBrowser.removeTab(newTab);
  gBrowser.removeTab(tab);
});

add_task(async function test_Hover_SublabelChangesWithAccelKey() {
  const tab = await pinAndNavigateTab(
    "https://example.com/1",
    "https://example.com/2"
  );

  // Track calls to document.l10n.setArgs to verify sublabel updates
  const sublabelArgs = [];
  const label = tab.querySelector(".zen-tab-sublabel");
  const origSetArgs = document.l10n.setArgs;
  document.l10n.setArgs = (el, args) => {
    if (el === label) {
      sublabelArgs.push(args.tabSubtitle);
    }
    origSetArgs.call(document.l10n, el, args);
  };

  try {
    // Simulate hovering with no modifier key held
    gZenPinnedTabManager.onResetPinButtonMouseOver(tab, {
      getModifierState() {
        return false;
      },
      metaKey: false,
      type: "mouseover",
    });

    Assert.equal(
      sublabelArgs.at(-1),
      "zen-default-pinned",
      "Sublabel should show default text on hover without Accel"
    );

    // Simulate pressing CMD while hovering
    gZenPinnedTabManager._onAccelKeyChange({
      getModifierState() {
        return true;
      },
      metaKey: true,
      type: "keydown",
    });

    Assert.equal(
      sublabelArgs.at(-1),
      "zen-default-pinned-cmd",
      "Sublabel should show CMD text when Accel key is pressed"
    );

    // Simulate releasing CMD while still hovering
    gZenPinnedTabManager._onAccelKeyChange({
      getModifierState() {
        return false;
      },
      metaKey: false,
      type: "keyup",
    });

    Assert.equal(
      sublabelArgs.at(-1),
      "zen-default-pinned",
      "Sublabel should revert to default text when Accel key is released"
    );

    // Simulate mouse out
    gZenPinnedTabManager.onResetPinButtonMouseOut(tab);

    Assert.equal(
      sublabelArgs.at(-1),
      "zen-default-pinned",
      "Sublabel should show default text after mouse out"
    );
    ok(
      !gZenPinnedTabManager._tabWithResetPinButtonHovered,
      "Hovered tab reference should be cleared after mouse out"
    );
  } finally {
    document.l10n.setArgs = origSetArgs;
  }

  gBrowser.removeTab(tab);
});
