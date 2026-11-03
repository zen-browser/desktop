/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const URL1 = "data:text/plain,tab1";
const URL2 = "data:text/plain,tab2";
const URL3 = "data:text/plain,tab3";

add_task(async function test_blurToRecentlyClosedTab() {
  const [tab1, tab2, tab3] = [
    BrowserTestUtils.addTab(gBrowser, URL1),
    BrowserTestUtils.addTab(gBrowser, URL2),
    BrowserTestUtils.addTab(gBrowser, URL3),
  ];

  gBrowser.selectedTab = tab2;
  gBrowser.selectedTab = tab3;
  gBrowser.selectedTab = tab1;

  gBrowser.selectedTab = tab2;
  gBrowser.removeTab(tab2);

  Assert.equal(
    gBrowser.selectedTab,
    tab1,
    "After closing the most recently used tab, the selection moves to the last used tab"
  );

  gBrowser.selectedTab = tab3;
  gBrowser.removeTab(tab3);

  Assert.equal(
    gBrowser.selectedTab,
    tab1,
    "After closing the most recently used tab, the selection moves to the last used tab"
  );

  gBrowser.removeTab(tab1);
});

add_task(async function test_closeToLastTab() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.tabs.select-recently-used-on-close", false],
      ["zen.view.show-newtab-button-top", false],
    ],
  });

  const [tab1, tab2, tab3] = [
    BrowserTestUtils.addTab(gBrowser, URL1),
    BrowserTestUtils.addTab(gBrowser, URL2),
    BrowserTestUtils.addTab(gBrowser, URL3),
  ];

  gBrowser.selectedTab = tab2;
  gBrowser.selectedTab = tab3;
  gBrowser.selectedTab = tab1;

  gBrowser.selectedTab = tab2;
  gBrowser.removeTab(tab2);

  Assert.equal(
    gBrowser.selectedTab,
    tab3,
    "After closing the current tab, the selection moves to the next tab in order"
  );

  gBrowser.selectedTab = tab1;
  gBrowser.removeTab(tab1);

  Assert.equal(
    gBrowser.selectedTab,
    tab3,
    "After closing the current tab, the selection moves to the next tab in order"
  );

  gBrowser.removeTab(tab3);
  await SpecialPowers.popPrefEnv();
});
