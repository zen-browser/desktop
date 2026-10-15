/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ORIG_STATE = SessionStore.getBrowserState();

registerCleanupFunction(async () => {
  await SessionStoreTestUtils.promiseBrowserState(ORIG_STATE);
});

add_task(async function test_fresh_session_sequential_integer_ids() {
  SessionStore.resetNextClosedId();

  let tab1 = gBrowser.tabs[0];
  let tab2 = BrowserTestUtils.addTab(gBrowser, "about:robots");
  await BrowserTestUtils.browserLoaded(tab2.linkedBrowser);

  let splitview1 = gBrowser.addTabSplitView([tab1, tab2]);

  Assert.strictEqual(
    typeof splitview1.splitViewId,
    "number",
    "splitViewId should be a number"
  );
  Assert.strictEqual(
    splitview1.splitViewId,
    1,
    "First split view ID should be 1"
  );

  let tab3 = BrowserTestUtils.addTab(gBrowser, "about:mozilla");
  let tab4 = BrowserTestUtils.addTab(gBrowser, "about:about");
  await Promise.all([
    BrowserTestUtils.browserLoaded(tab3.linkedBrowser),
    BrowserTestUtils.browserLoaded(tab4.linkedBrowser),
  ]);

  let splitview2 = gBrowser.addTabSplitView([tab3, tab4]);

  Assert.strictEqual(
    typeof splitview2.splitViewId,
    "number",
    "splitViewId should be a number"
  );
  Assert.strictEqual(
    splitview2.splitViewId,
    2,
    "Second split view ID should be 2"
  );

  Assert.notEqual(
    splitview1.splitViewId,
    splitview2.splitViewId,
    "Split view IDs should be unique"
  );

  gBrowser.removeTab(tab4);
  gBrowser.removeTab(tab3);
  gBrowser.removeTab(tab2);
});

add_task(async function test_counter_persists_across_sessions() {
  let tab1 = gBrowser.tabs[0];
  let tab2 = BrowserTestUtils.addTab(gBrowser, "about:robots");
  await BrowserTestUtils.browserLoaded(tab2.linkedBrowser);

  gBrowser.addTabSplitView([tab1, tab2]);

  let tab3 = BrowserTestUtils.addTab(gBrowser, "about:mozilla");
  let tab4 = BrowserTestUtils.addTab(gBrowser, "about:about");
  await Promise.all([
    BrowserTestUtils.browserLoaded(tab3.linkedBrowser),
    BrowserTestUtils.browserLoaded(tab4.linkedBrowser),
  ]);

  let splitview2 = gBrowser.addTabSplitView([tab3, tab4]);
  let secondId = splitview2.splitViewId;

  await TabStateFlusher.flushWindow(window);

  let state = JSON.parse(SessionStore.getBrowserState());

  Assert.ok(state.maxSplitViewId, "maxSplitViewId should be in saved state");
  Assert.strictEqual(
    state.maxSplitViewId,
    secondId,
    "maxSplitViewId should match the highest ID used"
  );

  await SessionStoreTestUtils.promiseBrowserState(state);

  let tab5 = BrowserTestUtils.addTab(gBrowser, "about:config");
  let tab6 = BrowserTestUtils.addTab(gBrowser, "about:support");
  await Promise.all([
    BrowserTestUtils.browserLoaded(tab5.linkedBrowser),
    BrowserTestUtils.browserLoaded(tab6.linkedBrowser),
  ]);

  let splitview3 = gBrowser.addTabSplitView([tab5, tab6]);

  Assert.strictEqual(
    typeof splitview3.splitViewId,
    "number",
    "New splitViewId should be a number"
  );
  Assert.strictEqual(
    splitview3.splitViewId,
    secondId + 1,
    "New split view ID should be one more than persisted counter"
  );

  gBrowser.removeTab(tab6);
  gBrowser.removeTab(tab5);
});

add_task(async function test_counter_initialized_from_persisted_value() {
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
            splitViewId: 42,
          },
          {
            entries: [
              {
                url: "about:robots",
                triggeringPrincipal_base64,
              },
            ],
            splitViewId: 42,
          },
        ],
        selected: 1,
        splitViews: [
          {
            id: 42,
            numberOfTabs: 2,
          },
        ],
      },
    ],
    maxSplitViewId: 42,
  };

  await SessionStoreTestUtils.promiseBrowserState(state);

  Assert.strictEqual(
    gBrowser.tabs[0].splitview.splitViewId,
    42,
    "Restored split view should have ID 42"
  );

  let tab3 = BrowserTestUtils.addTab(gBrowser, "about:config");
  let tab4 = BrowserTestUtils.addTab(gBrowser, "about:support");
  await Promise.all([
    BrowserTestUtils.browserLoaded(tab3.linkedBrowser),
    BrowserTestUtils.browserLoaded(tab4.linkedBrowser),
  ]);

  let newSplitview = gBrowser.addTabSplitView([tab3, tab4]);

  Assert.strictEqual(
    newSplitview.splitViewId,
    43,
    "New split view ID should be maxSplitViewId + 1"
  );

  gBrowser.removeTab(tab4);
  gBrowser.removeTab(tab3);
});
