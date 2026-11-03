/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * This tests the behaviour of moving pending tabs to a new window. These
 * pending tabs have yet to be restored and should be restored upon opening
 * in the new window. This test covers moving a single pending tab at once
 * as well as multiple tabs at the same time (using tab multiselection).
 */
add_task(async function test_movePendingTabToNewWindow() {
  const TEST_URIS = [
    "http://www.example.com/1",
    "http://www.example.com/2",
    "http://www.example.com/3",
    "http://www.example.com/4",
  ];

  await SpecialPowers.pushPrefEnv({
    set: [["browser.sessionstore.restore_on_demand", true]],
  });

  let state = {
    windows: [
      {
        tabs: [
          { entries: [{ url: TEST_URIS[0], triggeringPrincipal_base64 }] },
          { entries: [{ url: TEST_URIS[1], triggeringPrincipal_base64 }] },
          { entries: [{ url: TEST_URIS[2], triggeringPrincipal_base64 }] },
          { entries: [{ url: TEST_URIS[3], triggeringPrincipal_base64 }] },
        ],
        selected: 4,
      },
    ],
  };

  await promiseBrowserState(state);

  is(
    gBrowser.visibleTabs.length,
    4,
    "Three tabs are visible to start the test"
  );

  let tabToSelect = gBrowser.visibleTabs[1];
  ok(tabToSelect.hasAttribute("pending"), "Tab should be pending");

  gBrowser.addRangeToMultiSelectedTabs(gBrowser.selectedTab, tabToSelect);
  ok(!gBrowser.visibleTabs[0].multiselected, "First tab not multiselected");
  ok(gBrowser.visibleTabs[1].multiselected, "Second tab multiselected");
  ok(gBrowser.visibleTabs[2].multiselected, "Third tab multiselected");
  ok(gBrowser.visibleTabs[3].multiselected, "Fourth tab multiselected");

  let promiseNewWindow = BrowserTestUtils.waitForNewWindow();
  gBrowser.replaceTabsWithWindow(tabToSelect);

  info("Waiting for new window");
  let newWindow = await promiseNewWindow;
  isnot(newWindow, gBrowser.documentGlobal, "Tab moved to new window");

  let newWindowTabs = newWindow.gBrowser.visibleTabs;
  await TestUtils.waitForCondition(() => {
    return (
      newWindowTabs.length == 3 &&
      newWindowTabs[0].linkedBrowser.currentURI.spec == TEST_URIS[1] &&
      newWindowTabs[1].linkedBrowser.currentURI.spec == TEST_URIS[2] &&
      newWindowTabs[2].linkedBrowser.currentURI.spec == TEST_URIS[3]
    );
  }, "Wait for all three tabs to move to new window and load");

  is(newWindowTabs.length, 3, "Three tabs should be in new window");
  is(
    newWindowTabs[0].linkedBrowser.currentURI.spec,
    TEST_URIS[1],
    "Second tab moved"
  );
  is(
    newWindowTabs[1].linkedBrowser.currentURI.spec,
    TEST_URIS[2],
    "Third tab moved"
  );
  is(
    newWindowTabs[2].linkedBrowser.currentURI.spec,
    TEST_URIS[3],
    "Fourth tab moved"
  );

  ok(
    newWindowTabs[0].hasAttribute("pending"),
    "First tab in new window should still be pending"
  );
  ok(
    newWindowTabs[1].hasAttribute("pending"),
    "Second tab in new window should still be pending"
  );
  newWindow.gBrowser.clearMultiSelectedTabs();
  ok(
    newWindowTabs.every(t => !t.multiselected),
    "No multiselection should be present"
  );

  promiseNewWindow = BrowserTestUtils.waitForNewWindow();
  newWindow.gBrowser.replaceTabsWithWindow(newWindowTabs[0]);

  info("Waiting for second new window");
  let secondNewWindow = await promiseNewWindow;
  await TestUtils.waitForCondition(
    () =>
      secondNewWindow.gBrowser.selectedBrowser.currentURI.spec == TEST_URIS[1],
    "Wait until the URI is updated"
  );
  is(
    secondNewWindow.gBrowser.visibleTabs.length,
    1,
    "Only one tab in second new window"
  );
  is(
    secondNewWindow.gBrowser.selectedBrowser.currentURI.spec,
    TEST_URIS[1],
    "First tab moved"
  );

  await BrowserTestUtils.closeWindow(secondNewWindow);
  await BrowserTestUtils.closeWindow(newWindow);
});
