/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const SLOW_URL = "http://mochi.test:8888/browser/zen/tests/ui/slow_load.sjs";

function indicator() {
  return document.getElementById("zen-loading-progress-bar");
}

function waitForIndicator(message) {
  return TestUtils.waitForCondition(indicator, message);
}

function waitForNoIndicator(message) {
  return TestUtils.waitForCondition(() => !indicator(), message);
}

function startSlowLoad(browser, delay) {
  const url = `${SLOW_URL}?delay=${delay}`;
  const loaded = BrowserTestUtils.browserLoaded(browser, false, url);
  BrowserTestUtils.startLoadingURIString(browser, url);
  return loaded;
}

add_setup(async function () {
  await waitForNoIndicator("No tab is loading when the test starts");
});

add_task(async function test_indicator_while_selected_tab_loads() {
  const tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  gBrowser.selectedTab = tab;
  const loaded = startSlowLoad(tab.linkedBrowser, 1500);

  const bar = await waitForIndicator("The indicator appears for the load");
  is(
    bar.closest(".browserSidebarContainer"),
    gBrowser.getPanel(tab.linkedBrowser),
    "The indicator sits in the loading tab's panel"
  );
  ok(!bar.hasAttribute("long-load"), "A fresh load is not marked as long");

  await loaded;
  await waitForNoIndicator("The indicator goes away once the load finishes");

  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_long_loads_are_marked() {
  const tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  gBrowser.selectedTab = tab;
  const loaded = startSlowLoad(tab.linkedBrowser, 4000);

  const bar = await waitForIndicator("The indicator appears");
  await TestUtils.waitForCondition(
    () => bar.hasAttribute("long-load"),
    "A load that takes a few seconds is marked as a long load",
    500,
    20
  );

  await loaded;
  await waitForNoIndicator("The indicator goes away once the load finishes");

  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_only_the_selected_tab_shows_it() {
  const original = gBrowser.selectedTab;
  const background = BrowserTestUtils.addTab(gBrowser, "about:blank");
  const loaded = startSlowLoad(background.linkedBrowser, 4000);

  // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
  await new Promise(resolve => setTimeout(resolve, 500));
  ok(!indicator(), "A background tab's load shows no indicator");

  gBrowser.selectedTab = background;
  const bar = await waitForIndicator(
    "Selecting the loading tab shows its indicator"
  );
  is(
    bar.closest(".browserSidebarContainer"),
    gBrowser.getPanel(background.linkedBrowser),
    "The indicator is in the newly selected tab's panel"
  );

  gBrowser.selectedTab = original;
  await waitForNoIndicator("Leaving the loading tab hides the indicator");

  await loaded;
  BrowserTestUtils.removeTab(background);
});
