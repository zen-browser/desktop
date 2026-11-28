/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/*
 * This test verifies that firing clear-origin-attributes-data for a
 * userContextId prunes matching tabs from closed windows, and removes
 * the closed window entirely when no tabs remain.
 */

const USER_CONTEXT_ID = 1;

add_setup(async function () {
  forgetClosedWindows();
  forgetClosedTabs(window);
});

add_task(
  async function test_clear_container_removes_matching_tabs_from_closed_window() {
    let newWin = await promiseNewWindowLoaded();

    let containerTab = BrowserTestUtils.addTab(
      newWin.gBrowser,
      "https://example.com/",
      { userContextId: USER_CONTEXT_ID }
    );
    await promiseBrowserLoaded(containerTab.linkedBrowser);

    let plainTab = BrowserTestUtils.addTab(
      newWin.gBrowser,
      "https://example.org/"
    );
    await promiseBrowserLoaded(plainTab.linkedBrowser);

    await TabStateFlusher.flushWindow(newWin);
    await BrowserTestUtils.closeWindow(newWin);

    let closedWindows = ss.getClosedWindowData();
    is(closedWindows.length, 1, "One closed window recorded");

    let containerTabs = closedWindows[0].tabs.filter(
      t => t.userContextId == USER_CONTEXT_ID
    );
    Assert.greater(
      containerTabs.length,
      0,
      "Closed window contains container tab before clearing"
    );

    let totalTabsBefore = closedWindows[0].tabs.length;

    Services.obs.notifyObservers(
      null,
      "clear-origin-attributes-data",
      JSON.stringify({ userContextId: USER_CONTEXT_ID })
    );

    closedWindows = ss.getClosedWindowData();
    is(closedWindows.length, 1, "Closed window still exists");

    containerTabs = closedWindows[0].tabs.filter(
      t => t.userContextId == USER_CONTEXT_ID
    );
    is(containerTabs.length, 0, "Container tabs were removed");
    is(
      closedWindows[0].tabs.length,
      totalTabsBefore - 1,
      "Non-container tabs remain"
    );

    forgetClosedWindows();
  }
);

add_task(
  async function test_clear_container_removes_closed_window_when_empty() {
    let newWin = await promiseNewWindowLoaded();

    let containerTab = BrowserTestUtils.addTab(
      newWin.gBrowser,
      "https://example.com/",
      { userContextId: USER_CONTEXT_ID }
    );
    await promiseBrowserLoaded(containerTab.linkedBrowser);

    // Remove the initial about:blank tab so only the container tab remains.
    BrowserTestUtils.removeTab(newWin.gBrowser.tabs[0]);

    await TabStateFlusher.flushWindow(newWin);
    await BrowserTestUtils.closeWindow(newWin);

    let closedWindows = ss.getClosedWindowData();
    is(closedWindows.length, 1, "One closed window recorded");

    Services.obs.notifyObservers(
      null,
      "clear-origin-attributes-data",
      JSON.stringify({ userContextId: USER_CONTEXT_ID })
    );

    closedWindows = ss.getClosedWindowData();
    is(
      closedWindows.length,
      0,
      "Closed window was removed when all tabs matched"
    );

    forgetClosedWindows();
  }
);

add_task(
  async function test_clear_container_removes_closed_tabs_in_closed_window() {
    let newWin = await promiseNewWindowLoaded();

    let containerTab = BrowserTestUtils.addTab(
      newWin.gBrowser,
      "https://example.com/",
      { userContextId: USER_CONTEXT_ID }
    );
    await promiseBrowserLoaded(containerTab.linkedBrowser);

    let plainTab = BrowserTestUtils.addTab(
      newWin.gBrowser,
      "https://example.org/"
    );
    await promiseBrowserLoaded(plainTab.linkedBrowser);

    // Close the container tab within the window (becomes a _closedTab).
    await promiseRemoveTabAndSessionState(containerTab);

    await TabStateFlusher.flushWindow(newWin);
    await BrowserTestUtils.closeWindow(newWin);

    let closedWindows = ss.getClosedWindowData();
    is(closedWindows.length, 1, "One closed window recorded");

    let closedContainerTabs = closedWindows[0]._closedTabs.filter(
      t => t.state.userContextId == USER_CONTEXT_ID
    );
    Assert.greater(
      closedContainerTabs.length,
      0,
      "Closed window has a _closedTab for the container"
    );

    Services.obs.notifyObservers(
      null,
      "clear-origin-attributes-data",
      JSON.stringify({ userContextId: USER_CONTEXT_ID })
    );

    closedWindows = ss.getClosedWindowData();
    is(closedWindows.length, 1, "Closed window still exists");

    closedContainerTabs = closedWindows[0]._closedTabs.filter(
      t => t.state.userContextId == USER_CONTEXT_ID
    );
    is(
      closedContainerTabs.length,
      0,
      "Container _closedTabs were removed from closed window"
    );

    forgetClosedWindows();
  }
);

add_task(async function test_clear_container_cleans_up_lastClosedActions() {
  let newWin = await promiseNewWindowLoaded();

  let containerTab = BrowserTestUtils.addTab(
    newWin.gBrowser,
    "https://example.com/",
    { userContextId: USER_CONTEXT_ID }
  );
  await promiseBrowserLoaded(containerTab.linkedBrowser);

  let plainTab = BrowserTestUtils.addTab(
    newWin.gBrowser,
    "https://example.org/"
  );
  await promiseBrowserLoaded(plainTab.linkedBrowser);

  // Close the container tab so it becomes a _closedTab with a closedId
  // tracked in lastClosedActions.
  await promiseRemoveTabAndSessionState(containerTab);

  await TabStateFlusher.flushWindow(newWin);
  await BrowserTestUtils.closeWindow(newWin);

  let closedWindows = ss.getClosedWindowData();
  is(closedWindows.length, 1, "One closed window recorded");

  let closedTab = closedWindows[0]._closedTabs.find(
    t => t.state.userContextId == USER_CONTEXT_ID
  );
  ok(closedTab, "Closed window has a _closedTab for the container");

  let actionsBefore = ss.lastClosedActions;
  ok(
    actionsBefore.some(a => a.closedId == closedTab.closedId),
    "lastClosedActions contains the container tab's closedId"
  );

  Services.obs.notifyObservers(
    null,
    "clear-origin-attributes-data",
    JSON.stringify({ userContextId: USER_CONTEXT_ID })
  );

  let actionsAfter = ss.lastClosedActions;
  ok(
    !actionsAfter.some(a => a.closedId == closedTab.closedId),
    "lastClosedActions no longer contains the cleared container tab"
  );

  forgetClosedWindows();
});
