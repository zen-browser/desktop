/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const URL1 = "data:text/plain,tab1";

const kHoursToMs = 60 * 60 * 1000;

/** Makes a tab look like it was last used `hours` ago. */
function age(tab, hours) {
  tab.updateLastAccessed(Date.now() - hours * kHoursToMs);
}

async function withAutoClose(afterHours, callback) {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.tabs.auto-close.enabled", true],
      ["zen.tabs.auto-close.after-hours", afterHours],
    ],
  });
  try {
    await callback();
  } finally {
    await SpecialPowers.popPrefEnv();
  }
}

add_task(async function test_closesStaleTabsOnly() {
  await withAutoClose(24, async () => {
    const stale = BrowserTestUtils.addTab(gBrowser, URL1);
    const recent = BrowserTestUtils.addTab(gBrowser, URL1);
    age(stale, 48);
    age(recent, 1);

    const closed = await gZenAutoCloseTabs.sweep();

    Assert.equal(closed.length, 1, "One tab is past the threshold");
    Assert.equal(closed[0], stale, "The stale tab is the one that closed");
    Assert.ok(!gBrowser.tabs.includes(stale), "The stale tab is gone");
    Assert.ok(gBrowser.tabs.includes(recent), "The recent tab is untouched");

    BrowserTestUtils.removeTab(recent);
  });
});

add_task(async function test_neverClosesPinnedOrSelectedTabs() {
  await withAutoClose(24, async () => {
    const pinned = BrowserTestUtils.addTab(gBrowser, URL1);
    const essential = BrowserTestUtils.addTab(gBrowser, URL1);
    const selected = BrowserTestUtils.addTab(gBrowser, URL1);

    gBrowser.pinTab(pinned);
    gZenPinnedTabManager.addToEssentials(essential);
    gBrowser.selectedTab = selected;

    for (const tab of [pinned, essential, selected]) {
      age(tab, 48);
    }

    const closed = await gZenAutoCloseTabs.sweep();

    Assert.equal(closed.length, 0, "Nothing is closed");
    for (const tab of [pinned, essential, selected]) {
      Assert.ok(gBrowser.tabs.includes(tab), "The protected tab is still open");
    }

    gZenPinnedTabManager.removeEssentials(essential);
    BrowserTestUtils.removeTab(essential);
    BrowserTestUtils.removeTab(pinned);
    BrowserTestUtils.removeTab(selected);
  });
});

add_task(async function test_doesNothingWhenDisabled() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.tabs.auto-close.enabled", false],
      ["zen.tabs.auto-close.after-hours", 24],
    ],
  });

  const stale = BrowserTestUtils.addTab(gBrowser, URL1);
  age(stale, 48);

  const wouldClose = gZenAutoCloseTabs.collectStaleTabs();
  Assert.equal(wouldClose.length, 1, "A sweep would have closed the tab");
  Assert.ok(
    gBrowser.tabs.includes(stale),
    "The tab is still open, since no sweep is armed while the feature is off"
  );

  BrowserTestUtils.removeTab(stale);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_thresholdIsRespected() {
  const stale = BrowserTestUtils.addTab(gBrowser, URL1);
  age(stale, 36);

  await withAutoClose(24, async () => {
    Assert.equal(
      gZenAutoCloseTabs.collectStaleTabs().length,
      1,
      "36 hours is past a one day threshold"
    );
  });

  await withAutoClose(168, async () => {
    Assert.equal(
      gZenAutoCloseTabs.collectStaleTabs().length,
      0,
      "36 hours is within a one week threshold"
    );
  });

  BrowserTestUtils.removeTab(stale);
});

add_task(async function test_splitViewsCloseAsAUnit() {
  await withAutoClose(24, async () => {
    const stale = BrowserTestUtils.addTab(gBrowser, URL1);
    const recent = BrowserTestUtils.addTab(gBrowser, URL1);
    const other = BrowserTestUtils.addTab(gBrowser, URL1);

    const activated = BrowserTestUtils.waitForEvent(
      window,
      "ZenViewSplitter:SplitViewActivated"
    );
    gZenViewSplitter.splitTabs([stale, recent], "grid");
    await activated;

    // Neither half may be the selected tab, or it would be protected for that
    // reason instead of the one being tested.
    gBrowser.selectedTab = other;
    age(stale, 48);
    age(recent, 1);

    Assert.equal(
      gZenAutoCloseTabs.collectStaleTabs().length,
      0,
      "A split view stays whole while one of its tabs is still in use"
    );

    age(recent, 48);
    const closed = await gZenAutoCloseTabs.sweep();

    Assert.equal(closed.length, 2, "Both halves of the split view close");
    for (const tab of [stale, recent]) {
      Assert.ok(!gBrowser.tabs.includes(tab), "The split view tab is gone");
    }

    BrowserTestUtils.removeTab(other);
  });
});
