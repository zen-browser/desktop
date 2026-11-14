/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
});

const PENDING_URL = httpURL("pending_load.sjs");

add_task(async function test_copy_url_while_new_tab_is_loading() {
  const startTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com/"
  );
  // The default single toolbar layout reverts the URL bar when it closes,
  // but the test window does not end up in that layout, so set its flag.
  const { _hasSetSingleToolbar } = gZenVerticalTabsManager;
  gZenVerticalTabsManager._hasSetSingleToolbar = true;
  // Open the new tab URL bar through the same command as Cmd/Ctrl+T, which
  // only uses it when testing mode is off.
  const { testingEnabled } = gZenUIManager;
  gZenUIManager.testingEnabled = false;
  registerCleanupFunction(() => {
    gZenVerticalTabsManager._hasSetSingleToolbar = _hasSetSingleToolbar;
    gZenUIManager.testingEnabled = testingEnabled;
    BrowserTestUtils.removeTab(startTab);
    document.getElementById("zen-toast-container").replaceChildren();
  });

  await UrlbarTestUtils.promisePopupOpen(window, () =>
    document.getElementById("cmd_newNavigatorTab").doCommand()
  );
  ok(gURLBar.hasAttribute("zen-newtab"), "The new tab URL bar opened");

  const onLoaded = BrowserTestUtils.waitForNewTab(gBrowser, PENDING_URL);
  const onClosed = BrowserTestUtils.waitForEvent(window, "ZenURLBarClosed");
  EventUtils.sendString(PENDING_URL);
  EventUtils.synthesizeKey("KEY_Enter");
  await onClosed;
  // Let the blur reset in UrlbarInputBase's #closePopover run as well.
  await new Promise(r => requestAnimationFrame(() => setTimeout(r)));

  const pendingTab = gBrowser.selectedTab;
  Assert.notEqual(pendingTab, startTab, "The URL opened in a new tab");
  Assert.equal(
    pendingTab.linkedBrowser.currentURI.spec,
    "about:blank",
    "The load has not committed yet"
  );
  Assert.equal(
    gURLBar.untrimmedValue,
    PENDING_URL,
    "The URL bar shows the pending URL"
  );

  await SimpleTest.promiseClipboardChange(PENDING_URL, () =>
    document.getElementById("cmd_zenCopyCurrentURL").doCommand()
  );
  ok(true, "Copy URL copies the pending URL instead of about:blank");

  await onLoaded;
  BrowserTestUtils.removeTab(pendingTab);
});
