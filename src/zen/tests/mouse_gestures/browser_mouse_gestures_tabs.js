/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function openTabs() {
  const tabs = [];
  for (let i = 0; i < 3; i++) {
    tabs.push(
      await BrowserTestUtils.openNewForegroundTab(
        gBrowser,
        MOUSE_GESTURES_TEST_PAGE,
      ),
    );
  }
  return tabs;
}

function closeTabs(tabs) {
  for (const tab of tabs) {
    BrowserTestUtils.removeTab(tab);
  }
}

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.mouse-gestures.action.left", "tab-prev"],
      ["zen.mouse-gestures.action.right", "tab-next"],
      ["zen.mouse-gestures.action.up-left", "tab-prev"],
      ["zen.mouse-gestures.action.up-right", "tab-next"],
    ],
  });
});

add_task(async function test_single_stroke_switches_tabs() {
  const [first, middle, last] = await openTabs();
  gBrowser.selectedTab = middle;

  let selected = BrowserTestUtils.waitForEvent(
    gBrowser.tabContainer,
    "TabSelect",
  );
  await synthesizeRightDrag(middle.linkedBrowser, 300, 200, [[-150, 0]]);
  await selected;
  is(gBrowser.selectedTab, first, "Dragging left selects the previous tab");

  gBrowser.selectedTab = middle;
  selected = BrowserTestUtils.waitForEvent(gBrowser.tabContainer, "TabSelect");
  await synthesizeRightDrag(middle.linkedBrowser, 300, 200, [[150, 0]]);
  await selected;
  is(gBrowser.selectedTab, last, "Dragging right selects the next tab");

  closeTabs([first, middle, last]);
});

add_task(async function test_two_stroke_gesture() {
  const [first, middle, last] = await openTabs();
  gBrowser.selectedTab = middle;

  let selected = BrowserTestUtils.waitForEvent(
    gBrowser.tabContainer,
    "TabSelect",
  );
  await synthesizeRightDrag(middle.linkedBrowser, 300, 300, [
    [0, -100],
    [-100, 0],
  ]);
  await selected;
  is(gBrowser.selectedTab, first, "Up then left selects the previous tab");

  gBrowser.selectedTab = middle;
  selected = BrowserTestUtils.waitForEvent(gBrowser.tabContainer, "TabSelect");
  await synthesizeRightDrag(middle.linkedBrowser, 300, 300, [
    [0, -100],
    [100, 0],
  ]);
  await selected;
  is(gBrowser.selectedTab, last, "Up then right selects the next tab");

  closeTabs([first, middle, last]);
});

add_task(async function test_short_diagonal_and_overlong_drags_do_nothing() {
  const [first, middle, last] = await openTabs();
  gBrowser.selectedTab = middle;

  await synthesizeRightDrag(middle.linkedBrowser, 300, 200, [[-20, 0]]);
  is(gBrowser.selectedTab, middle, "A short drag is not a gesture");

  await synthesizeRightDrag(middle.linkedBrowser, 300, 200, [[-100, 100]]);
  is(gBrowser.selectedTab, middle, "A diagonal drag is not a gesture");

  await synthesizeRightDrag(middle.linkedBrowser, 300, 300, [
    [0, -100],
    [-100, 0],
    [0, 100],
  ]);
  is(gBrowser.selectedTab, middle, "Three strokes cancel the gesture");

  // Control: a proper drag still works afterwards.
  const selected = BrowserTestUtils.waitForEvent(
    gBrowser.tabContainer,
    "TabSelect",
  );
  await synthesizeRightDrag(middle.linkedBrowser, 300, 200, [[-150, 0]]);
  await selected;
  is(
    gBrowser.selectedTab,
    first,
    "The control gesture selects the previous tab",
  );

  closeTabs([first, middle, last]);
});

add_task(async function test_action_follows_pref() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.mouse-gestures.action.left", "none"]],
  });
  const [first, middle, last] = await openTabs();
  gBrowser.selectedTab = middle;

  await synthesizeRightDrag(middle.linkedBrowser, 300, 200, [[-150, 0]]);
  is(gBrowser.selectedTab, middle, "An action set to none does nothing");

  closeTabs([first, middle, last]);
  await SpecialPowers.popPrefEnv();
});
