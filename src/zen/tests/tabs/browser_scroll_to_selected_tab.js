/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ICON_URL = "chrome://branding/content/icon32.png";

let space;
let scrollbox;
let pill;
let openedTabs = [];

function selectedIsVisible() {
  const port = scrollbox.scrollClientRect;
  const rect = gBrowser.selectedTab.getBoundingClientRect();
  return rect.bottom > port.top && rect.top < port.bottom;
}

add_setup(async function () {
  await gZenWorkspaces.promiseInitialized;
  space = gZenWorkspaces.activeWorkspaceElement;
  scrollbox = space.scrollbox;
  pill = space.querySelector(".zen-workspace-scroll-to-tab");
  scrollbox.smoothScroll = false;
  while (!scrollbox.overflowing) {
    openedTabs.push(
      await BrowserTestUtils.openNewForegroundTab(gBrowser, "about:blank", true)
    );
  }
  for (let i = 0; i < 6; i++) {
    openedTabs.push(
      await BrowserTestUtils.openNewForegroundTab(gBrowser, "about:blank", true)
    );
  }

  registerCleanupFunction(async () => {
    for (const tab of openedTabs) {
      if (tab.isConnected) {
        BrowserTestUtils.removeTab(tab);
      }
    }
  });
});

add_task(async function test_points_up_and_scrolls_back() {
  const tab = gBrowser.visibleTabs[0];
  gBrowser.setIcon(tab, ICON_URL);
  gBrowser.selectedTab = tab;
  scrollbox.ensureElementIsVisible(gBrowser.visibleTabs.at(-1), true);

  await TestUtils.waitForCondition(
    () => !pill.hidden,
    "The pill appears once the selected tab is scrolled out of sight"
  );
  Assert.equal(
    pill.getAttribute("direction"),
    "up",
    "It points up at a selected tab that is above the strip"
  );
  Assert.equal(
    pill.querySelector(".zen-workspace-scroll-to-tab-icon").src,
    ICON_URL,
    "It carries the selected tab's icon"
  );

  const port = scrollbox.scrollClientRect;
  Assert.greaterOrEqual(
    Math.round(pill.getBoundingClientRect().top),
    Math.round(port.top),
    "It sits below the space indicator, inside the scrolling area"
  );

  pill.click();
  await TestUtils.waitForCondition(
    () => pill.hidden,
    "Clicking it brings the selected tab back and takes the pill away"
  );
  Assert.ok(selectedIsVisible(), "The selected tab really is back in view");
});

add_task(async function test_points_down() {
  gBrowser.selectedTab = gBrowser.visibleTabs.at(-1);
  await TestUtils.waitForCondition(
    () => selectedIsVisible(),
    "The selected tab settles into view"
  );
  scrollbox.scrollbox.scrollTop = 0;

  await TestUtils.waitForCondition(
    () => !pill.hidden,
    "The pill appears for a selected tab below the strip"
  );
  Assert.equal(
    pill.getAttribute("direction"),
    "down",
    "It points down at a selected tab that is below the strip"
  );

  /* eslint-disable-next-line mozilla/no-arbitrary-setTimeout */
  await new Promise(resolve => setTimeout(resolve, 300));
  Assert.equal(
    Math.round(scrollbox.scrollbox.scrollTop),
    0,
    "Showing the pill leaves the strip where the user put it"
  );
  Assert.ok(!pill.hidden, "And the pill is still being offered");
  Assert.lessOrEqual(
    Math.round(pill.getBoundingClientRect().bottom),
    Math.round(scrollbox.scrollClientRect.bottom),
    "The bottom pill stays inside the scrolling area too"
  );

  scrollbox.ensureElementIsVisible(gBrowser.selectedTab, true);
  await TestUtils.waitForCondition(
    () => pill.hidden,
    "The pill goes away once the selected tab is back in view"
  );
});

add_task(async function test_never_offered_for_an_essential() {
  const essential = openedTabs.pop();
  gZenPinnedTabManager.addToEssentials(essential);
  await TestUtils.waitForCondition(
    () => essential.hasAttribute("zen-essential"),
    "The tab is set aside as an essential"
  );
  gBrowser.selectedTab = gBrowser.visibleTabs[1];
  await TestUtils.waitForCondition(
    () => selectedIsVisible(),
    "The selected tab settles into view"
  );

  scrollbox.scrollbox.scrollTop = scrollbox.scrollbox.scrollTopMax;
  await TestUtils.waitForCondition(() => !pill.hidden, "The pill is showing");

  gBrowser.selectedTab = essential;
  await TestUtils.waitForCondition(
    () => pill.hidden,
    "Selecting an essential takes the pill away"
  );

  gZenPinnedTabManager.removeEssentials(essential);
  BrowserTestUtils.removeTab(essential);
  gBrowser.selectedTab = gBrowser.visibleTabs.at(-1);
  await TestUtils.waitForCondition(
    () => selectedIsVisible(),
    "Back on a tab in the strip"
  );
});

add_task(async function test_never_offered_for_the_empty_tab() {
  const emptyTab = space.querySelector("tab[zen-empty-tab]");
  if (!emptyTab) {
    info("This space has no empty tab to check");
    return;
  }

  gBrowser.selectedTab = emptyTab;
  scrollbox.scrollbox.scrollTop = scrollbox.scrollbox.scrollTopMax;
  /* eslint-disable-next-line mozilla/no-arbitrary-setTimeout */
  await new Promise(resolve => setTimeout(resolve, 300));
  Assert.ok(pill.hidden, "The empty tab is never offered");

  gBrowser.selectedTab = gBrowser.visibleTabs.at(-1);
  await TestUtils.waitForCondition(
    () => selectedIsVisible(),
    "Back to a real tab"
  );
});

add_task(async function test_never_offered_while_the_sidebar_is_collapsed() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.view.sidebar-expanded", false]],
  });
  try {
    await TestUtils.waitForCondition(
      () => !document.documentElement.hasAttribute("zen-sidebar-expanded"),
      "The sidebar collapses"
    );

    gBrowser.selectedTab = gBrowser.visibleTabs[1];
    await TestUtils.waitForCondition(
      () => selectedIsVisible(),
      "The selected tab settles into view"
    );
    Assert.ok(
      scrollbox.overflowing,
      "The strip still overflows when collapsed"
    );

    scrollbox.scrollbox.scrollTop = scrollbox.scrollbox.scrollTopMax;
    /* eslint-disable-next-line mozilla/no-arbitrary-setTimeout */
    await new Promise(resolve => setTimeout(resolve, 400));
    Assert.equal(
      getComputedStyle(pill).display,
      "none",
      "A collapsed sidebar never draws the pill"
    );
  } finally {
    await SpecialPowers.popPrefEnv();
    await TestUtils.waitForCondition(
      () => document.documentElement.hasAttribute("zen-sidebar-expanded"),
      "The sidebar is expanded again"
    );
  }
});

add_task(async function test_hidden_when_the_strip_does_not_overflow() {
  for (const tab of openedTabs) {
    if (tab.isConnected) {
      BrowserTestUtils.removeTab(tab);
    }
  }
  openedTabs = [];

  await TestUtils.waitForCondition(
    () => !scrollbox.overflowing,
    "The strip no longer overflows"
  );
  await TestUtils.waitForCondition(
    () => pill.hidden,
    "A strip that fits never offers the pill"
  );
});
