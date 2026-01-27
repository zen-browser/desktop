/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const URL1 = "data:text/plain,tab1";
const URL2 = "data:text/plain,tab2";
const URL3 = "data:text/plain,tab3";

const threshold = Math.min(
  1.0,
  Math.max(0.5, Services.prefs.getIntPref("browser.tabs.dragDrop.moveOverThresholdPercent") / 100) +
    0.01
);

/**
 * Virtually drag and drop a `source` element onto the `target` element,
 * offset by `clientX`, `clientY` pixels from the top-left of the viewport.
 *
 * @param {Element} source
 * @param {Element} target
 * @param {number} clientX
 * @param {number} clientY
 * @param {Window} win
 */
async function drop(source, target, clientX, clientY, win) {
  const tabMove = BrowserTestUtils.waitForEvent(source, "TabMove");
  EventUtils.synthesizeDrop(source, target, null, "move", win, win, {
    clientX,
    clientY,
  });
  await tabMove;
}

/**
 * @param {Element} el
 * @returns {DOMRect}
 */
const bounds = (el) => window.windowUtils.getBoundsWithoutFlushing(el);

/**
 * Virtually drag and drop one tab strip item after another.
 *
 * @param {Element} itemToDrag
 * @param {Element} itemToDropAfter
 * @param {Window} win
 */
async function dropAfter(itemToDrag, itemToDropAfter, win) {
  const sourceRect = bounds(itemToDrag);
  const rect = bounds(itemToDropAfter);

  const midline = rect.left + 0.5 * rect.width;
  // Point where bottom edge of `itemToDrag` overlaps `itemToDropAfter` enough
  // for `itemToDrag` to come after.
  const afterPoint = Math.ceil(rect.top + (threshold + 0.5) * rect.height);
  const dragTo = afterPoint - sourceRect.height / 2;
  await drop(itemToDrag, itemToDropAfter, midline, dragTo, win);
}

/**
 * Virtually drag and drop one tab strip item before another.
 *
 * @param {Element} itemToDrag
 * @param {Element} itemToDropBefore
 * @param {Window} win
 */
async function dropBefore(itemToDrag, itemToDropBefore, win) {
  const sourceRect = bounds(itemToDrag);
  const rect = bounds(itemToDropBefore);

  const midline = rect.left + 0.5 * rect.width;
  // Point where top edge of `itemToDrag` overlaps `itemToDropBefore` enough
  // for `itemToDrag` to come before.
  const beforePoint = Math.floor(rect.top + (1 - threshold - 0.5) * rect.height);
  const dragTo = beforePoint + sourceRect.height / 2;
  await drop(itemToDrag, itemToDropBefore, midline, dragTo, win);
}

/**
 * Ensure that the tab strip can fit the test tabs without overflowing.
 */
async function ensureNotOverflowing() {
  const tabHeight = Number.parseFloat(
    getComputedStyle(gBrowser.tabs[0]).getPropertyValue("--tab-height-with-margin-padding")
  );
  const requiredTabSpace = tabHeight * gBrowser.tabs.length;
  const scrollboxWidth = gBrowser.tabContainer.arrowScrollbox.scrollSize;
  if (requiredTabSpace > scrollboxWidth) {
    // resize the window to ensure that the tabs will fit
    const increaseBy = requiredTabSpace - scrollboxWidth;
    info(`increasing window height by ${increaseBy} to fit tabs`);
    window.resizeBy(0, increaseBy);
  }

  await BrowserTestUtils.waitForCondition(
    () => !gBrowser.tabContainer.arrowScrollbox.overflowing,
    "tabs scrollbox should not be overflowing",
    100,
    5
  );
}

add_setup(async () => {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.view.show-newtab-button-top", false]],
  });

  // Wait for sidebar animations to complete so that the position of the tab
  // strip does not adjust during the tests.
  await SidebarController.waitUntilStable();
  const tabToRemove = gBrowser.selectedTab;
  const [tab1, tab2, tab3] = await Promise.all([
    addTabTo(gBrowser, URL1),
    addTabTo(gBrowser, URL2),
    addTabTo(gBrowser, URL3),
  ]);
  // remove the default new tab from the test window
  BrowserTestUtils.removeTab(tabToRemove);
  const emptyTab = gBrowser.tabs[0];

  Assert.deepEqual(gBrowser.tabs, [emptyTab, tab1, tab2, tab3], "confirm tabs' starting order");

  await ensureNotOverflowing();

  registerCleanupFunction(async () => {
    // replace the default new tab in the test window
    addTabTo(gBrowser, "about:blank");

    BrowserTestUtils.removeTab(tab1);
    BrowserTestUtils.removeTab(tab2);
    BrowserTestUtils.removeTab(tab3);

    await SpecialPowers.popPrefEnv();
  });
});

add_task(async function test_basic_unpinned_vertical_ltr() {
  const [emptyTab, tab1, tab2, tab3] = gBrowser.tabs;

  // Validate that dragging and dropping into the same position will result in
  // the tab not moving
  for (const tab of [tab1, tab2, tab3]) {
    EventUtils.synthesizeDrop(tab, tab, null, "move", window, window, {});
    Assert.deepEqual(
      gBrowser.tabs,
      [emptyTab, tab1, tab2, tab3],
      "confirm that the tabs' order did not change"
    );
  }

  // Validate that it's possible to drag and drop a tab forward
  await dropAfter(tab1, tab2, window);
  Assert.deepEqual(
    gBrowser.tabs,
    [emptyTab, tab2, tab1, tab3],
    "confirm that tab1 moved after tab2"
  );
  await dropAfter(tab1, tab3, window);
  Assert.deepEqual(
    gBrowser.tabs,
    [emptyTab, tab2, tab3, tab1],
    "confirm that tab1 moved after tab3"
  );

  // Validate that it's possible to drag and drop a tab backward
  await dropBefore(tab1, tab3, window);
  Assert.deepEqual(
    gBrowser.tabs,
    [emptyTab, tab2, tab1, tab3],
    "confirm that tab1 moved before tab3"
  );
  await dropBefore(tab1, tab2, window);
  Assert.deepEqual(
    gBrowser.tabs,
    [emptyTab, tab1, tab2, tab3],
    "confirm that tab1 moved before tab2"
  );
});
