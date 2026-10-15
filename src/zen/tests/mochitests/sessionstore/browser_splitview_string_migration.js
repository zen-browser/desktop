/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ORIG_STATE = SessionStore.getBrowserState();
forgetClosedWindows();

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

add_task(async function test_string_id_migration_preserves_grouping() {
  let state = {
    windows: [
      {
        tabs: [
          {
            entries: [
              {
                url: "about:mozilla",
                triggeringPrincipal_base64,
              },
            ],
            splitViewId: "1706789123456-42",
          },
          {
            entries: [
              {
                url: "about:robots",
                triggeringPrincipal_base64,
              },
            ],
            splitViewId: "1706789123456-42",
          },
          {
            entries: [
              {
                url: "about:about",
                triggeringPrincipal_base64,
              },
            ],
            splitViewId: "1706789123457-99",
          },
          {
            entries: [
              {
                url: "about:config",
                triggeringPrincipal_base64,
              },
            ],
            splitViewId: "1706789123457-99",
          },
        ],
        selected: 1,
        splitViews: [
          {
            id: "1706789123456-42",
            numberOfTabs: 2,
          },
          {
            id: "1706789123457-99",
            numberOfTabs: 2,
          },
        ],
      },
    ],
  };

  await SessionStoreTestUtils.promiseBrowserState(state);

  info("State restored, checking tabs");
  Assert.strictEqual(gBrowser.tabs.length, 4, "Should have 4 tabs");

  let tab0 = gBrowser.tabs[0];
  let tab1 = gBrowser.tabs[1];
  let tab2 = gBrowser.tabs[2];
  let tab3 = gBrowser.tabs[3];

  info(`tab0.splitview: ${tab0.splitview}`);

  if (!tab0.splitview) {
    Assert.ok(false, "tab0 should have a splitview");
    return;
  }

  Assert.strictEqual(
    typeof tab0.splitview.splitViewId,
    "number",
    "Migrated splitViewId should be a number"
  );
  Assert.strictEqual(
    typeof tab2.splitview.splitViewId,
    "number",
    "Migrated splitViewId should be a number"
  );

  Assert.strictEqual(
    tab0.splitview.splitViewId,
    tab1.splitview.splitViewId,
    "Tabs with same string ID should have same integer ID"
  );
  Assert.strictEqual(
    tab2.splitview.splitViewId,
    tab3.splitview.splitViewId,
    "Tabs with same string ID should have same integer ID"
  );

  Assert.notEqual(
    tab0.splitview.splitViewId,
    tab2.splitview.splitViewId,
    "Different split views should have different integer IDs"
  );

  let tab4 = BrowserTestUtils.addTab(gBrowser, "about:preferences");
  let tab5 = BrowserTestUtils.addTab(gBrowser, "about:addons");
  await Promise.all([
    BrowserTestUtils.browserLoaded(tab4.linkedBrowser),
    BrowserTestUtils.browserLoaded(tab5.linkedBrowser),
  ]);

  let newSplitview = gBrowser.addTabSplitView([tab4, tab5]);

  Assert.greater(
    newSplitview.splitViewId,
    tab0.splitview.splitViewId,
    "New split view ID should be greater than migrated IDs"
  );
  Assert.greater(
    newSplitview.splitViewId,
    tab2.splitview.splitViewId,
    "New split view ID should be greater than migrated IDs"
  );

  gBrowser.removeTab(tab5);
  gBrowser.removeTab(tab4);
});

add_task(async function test_string_id_migration_in_closed_windows() {
  let state = {
    windows: [
      {
        tabs: [
          {
            entries: [
              {
                url: "about:blank",
                triggeringPrincipal_base64,
              },
            ],
          },
        ],
        selected: 1,
      },
    ],
    _closedWindows: [
      {
        tabs: [
          {
            entries: [
              {
                url: "about:mozilla",
                triggeringPrincipal_base64,
              },
            ],
            splitViewId: "1706789123456-42",
          },
          {
            entries: [
              {
                url: "about:robots",
                triggeringPrincipal_base64,
              },
            ],
            splitViewId: "1706789123456-42",
          },
        ],
        splitViews: [
          {
            id: "1706789123456-42",
            numberOfTabs: 2,
          },
        ],
        selected: 1,
        closedId: 1,
        closedAt: Date.now(),
        title: "Test Window",
        _closedTabs: [],
      },
    ],
  };

  await SessionStoreTestUtils.promiseBrowserState(state);

  let closedWindowData = SessionStore.getClosedWindowData();
  Assert.strictEqual(closedWindowData.length, 1, "Should have 1 closed window");

  let closedWinTabs = closedWindowData[0].tabs;
  Assert.strictEqual(
    closedWinTabs.length,
    2,
    "Closed window should have 2 tabs"
  );

  Assert.strictEqual(
    typeof closedWinTabs[0].splitViewId,
    "number",
    "Closed window tab splitViewId should be migrated to number"
  );
  Assert.strictEqual(
    typeof closedWinTabs[1].splitViewId,
    "number",
    "Closed window tab splitViewId should be migrated to number"
  );

  Assert.strictEqual(
    closedWinTabs[0].splitViewId,
    closedWinTabs[1].splitViewId,
    "Closed window tabs with same string ID should have same integer ID"
  );

  let restoredWin = SessionStore.undoCloseWindow(0);
  await promiseDelayedStartupFinished(restoredWin);

  Assert.strictEqual(
    restoredWin.gBrowser.tabs.length,
    2,
    "Restored window should have 2 tabs"
  );

  let restoredTab0 = restoredWin.gBrowser.tabs[0];
  let restoredTab1 = restoredWin.gBrowser.tabs[1];

  Assert.strictEqual(
    typeof restoredTab0.splitview.splitViewId,
    "number",
    "Restored window tab should have integer splitViewId"
  );
  Assert.strictEqual(
    restoredTab0.splitview.splitViewId,
    restoredTab1.splitview.splitViewId,
    "Restored split view should maintain grouping"
  );

  await BrowserTestUtils.closeWindow(restoredWin);
  forgetClosedWindows();
});

add_task(async function test_old_session_without_maxSplitViewId() {
  let state = {
    windows: [
      {
        tabs: [
          {
            entries: [
              {
                url: "about:mozilla",
                triggeringPrincipal_base64,
              },
            ],
            splitViewId: "1706789123456-42",
          },
          {
            entries: [
              {
                url: "about:robots",
                triggeringPrincipal_base64,
              },
            ],
            splitViewId: "1706789123456-42",
          },
        ],
        selected: 1,
        splitViews: [
          {
            id: "1706789123456-42",
            numberOfTabs: 2,
          },
        ],
      },
    ],
  };

  await SessionStoreTestUtils.promiseBrowserState(state);

  Assert.strictEqual(
    typeof gBrowser.tabs[0].splitview.splitViewId,
    "number",
    "String ID should be migrated even without maxSplitViewId"
  );
  Assert.strictEqual(
    gBrowser.tabs[0].splitview.splitViewId,
    gBrowser.tabs[1].splitview.splitViewId,
    "Grouping should be preserved"
  );

  let tab2 = BrowserTestUtils.addTab(gBrowser, "about:config");
  let tab3 = BrowserTestUtils.addTab(gBrowser, "about:support");
  await Promise.all([
    BrowserTestUtils.browserLoaded(tab2.linkedBrowser),
    BrowserTestUtils.browserLoaded(tab3.linkedBrowser),
  ]);

  let splitview = gBrowser.addTabSplitView([tab2, tab3]);

  Assert.strictEqual(
    typeof splitview.splitViewId,
    "number",
    "New split view should get integer ID"
  );
  Assert.greater(splitview.splitViewId, 0, "Counter should generate valid IDs");

  await TabStateFlusher.flushWindow(window);
  let newState = JSON.parse(SessionStore.getBrowserState());

  Assert.ok(
    newState.maxSplitViewId,
    "maxSplitViewId should be persisted after first save"
  );
  Assert.strictEqual(
    typeof newState.maxSplitViewId,
    "number",
    "Persisted maxSplitViewId should be a number"
  );

  gBrowser.removeTab(tab3);
  gBrowser.removeTab(tab2);
});
