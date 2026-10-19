/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

async function test() {
  waitForExplicitFinish();

  window.addEventListener(
    "SSWindowStateBusy",
    () => {
      let state = ss.getWindowState(window);
      ok(state.windows[0].busy, "window is busy");

      window.addEventListener(
        "SSWindowStateReady",
        () => {
          let state2 = ss.getWindowState(window);
          ok(!state2.windows[0].busy, "window is not busy");

          executeSoon(() => {
            gBrowser.removeTab(gBrowser.tabs[1]);
            finish();
          });
        },
        { once: true }
      );
    },
    { once: true }
  );

  // create a new tab
  let tab = BrowserTestUtils.addTab(gBrowser, "about:mozilla");
  let browser = tab.linkedBrowser;
  await BrowserTestUtils.browserLoaded(browser);
  await TabStateFlusher.flush(browser);
  const sessionStoreClosedObjectsChanged = TestUtils.topicObserved(
    "sessionstore-closed-objects-changed"
  );
  gBrowser.removeTab(tab);
  await sessionStoreClosedObjectsChanged;
  ss.undoCloseTab(window, 0);
}
