/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["test.wait300msAfterTabSwitch", true]],
  });
});

/**
 * Ensure that a pending tab has label and icon correctly set.
 */
add_task(async function test_label_and_icon() {
  // Make sure that tabs are restored on demand as otherwise the tab will start
  // loading immediately and we can't check its icon and label.
  await SpecialPowers.pushPrefEnv({
    set: [["browser.sessionstore.restore_on_demand", true]],
  });

  // Create a new tab.
  let tab = BrowserTestUtils.addTab(gBrowser, "about:robots");
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);
  // Because there is debounce logic in FaviconLoader.sys.mjs to reduce the
  // favicon loads, we have to wait some time before checking that icon was
  // stored properly.
  await TestUtils.waitForCondition(
    () => {
      return gBrowser.getIcon(tab) != null;
    },
    "wait for favicon load to finish",
    100,
    5
  );

  // Retrieve the tab state.
  await TabStateFlusher.flush(browser);
  let state = ss.getTabState(tab);
  BrowserTestUtils.removeTab(tab);
  browser = null;

  // Open a new tab to restore into.
  tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  ss.setTabState(tab, state);
  await promiseTabRestoring(tab);

  // Check that label and icon are set for the restoring tab.
  is(
    gBrowser.getIcon(tab),
    "chrome://browser/content/robot.ico",
    "icon is set"
  );
  is(tab.label, "Gort! Klaatu barada nikto!", "label is set");

  // Cleanup.
  BrowserTestUtils.removeTab(tab);
});
