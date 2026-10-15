/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

async function checkState(browser) {
  await SpecialPowers.spawn(browser, [], () => {
    // Go back and then forward, and make sure that the state objects received
    // from the popState event are as we expect them to be.
    //
    // We also add a node to the document's body when after going back and make
    // sure it's still there after we go forward -- this is to test that the two
    // history entries correspond to the same document.

    // Set some state in the page's window.  When we go back(), the page should
    // be retrieved from bfcache, and this state should still be there.
    content.testState = "foo";
  });

  // Now go back.  This should trigger the popstate event handler.
  let popstatePromise = SpecialPowers.spawn(browser, [], async () => {
    let event = await ContentTaskUtils.waitForEvent(content, "popstate", true);
    ok(event.state, "Event should have a state property.");

    is(content.testState, "foo", "testState after going back");
    is(
      JSON.stringify(content.history.state),
      JSON.stringify({ obj1: 1 }),
      "first popstate object."
    );

    // Add a node with id "new-elem" to the document.
    let doc = content.document;
    ok(
      !doc.getElementById("new-elem"),
      "doc shouldn't contain new-elem before we add it."
    );
    let elem = doc.createElement("div");
    elem.id = "new-elem";
    doc.body.appendChild(elem);
  });

  // Ensure that the message manager has processed the previous task before
  // going back to prevent racing with it in non-e10s mode.
  await SpecialPowers.spawn(browser, [], () => {});
  browser.goBack();

  await popstatePromise;

  popstatePromise = SpecialPowers.spawn(browser, [], async () => {
    let event = await ContentTaskUtils.waitForEvent(content, "popstate", true);

    // When content fires a PopStateEvent and we observe it from a chrome event
    // listener (as we do here, and, thankfully, nowhere else in the tree), the
    // state object will be a cross-compartment wrapper to an object that was
    // deserialized in the content scope. And in this case, since RegExps are
    // not currently Xrayable (see bug 1014991), trying to pull |obj3| (a RegExp)
    // off of an Xrayed Object won't work. So we need to waive.
    Assert.equal(
      Cu.waiveXrays(event.state).obj3.toString(),
      "/^a$/",
      "second popstate object."
    );

    // Make sure that the new-elem node is present in the document.  If it's
    // not, then this history entry has a different doc identifier than the
    // previous entry, which is bad.
    let doc = content.document;
    let newElem = doc.getElementById("new-elem");
    ok(newElem, "doc should contain new-elem.");
    newElem.remove();
    ok(!doc.getElementById("new-elem"), "new-elem should be removed.");
  });

  // Ensure that the message manager has processed the previous task before
  // going forward to prevent racing with it in non-e10s mode.
  await SpecialPowers.spawn(browser, [], () => {});
  browser.goForward();
  await popstatePromise;
}

add_task(async function test() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.navigation.requireUserInteraction", false]],
  });

  // Tests session restore functionality of history.pushState and
  // history.replaceState().  (Bug 500328)

  // We open a new blank window, let it load, and then load in
  // http://example.com.  We need to load the blank window first, otherwise the
  // docshell gets confused and doesn't have a current history entry.
  let state;
  await BrowserTestUtils.withNewTab(
    { gBrowser, url: "about:blank" },
    async function (browser) {
      BrowserTestUtils.startLoadingURIString(browser, "http://example.com");
      await BrowserTestUtils.browserLoaded(browser);

      // After these push/replaceState calls, the window should have three
      // history entries:
      //   testURL        (state object: null)          <-- oldest
      //   testURL        (state object: {obj1:1})
      //   testURL?page2  (state object: {obj3:/^a$/})  <-- newest
      function contentTest() {
        let history = content.window.history;
        history.pushState({ obj1: 1 }, "title-obj1");
        history.pushState({ obj2: 2 }, "title-obj2", "?page2");
        history.replaceState({ obj3: /^a$/ }, "title-obj3");
      }
      await SpecialPowers.spawn(browser, [], contentTest);
      await TabStateFlusher.flush(browser);

      state = ss.getTabState(gBrowser.getTabForBrowser(browser));
    }
  );

  // Restore the state into a new tab.  Things don't work well when we
  // restore into the old tab, but that's not a real use case anyway.
  await BrowserTestUtils.withNewTab(
    { gBrowser, url: "about:blank" },
    async function (browser) {
      let tab2 = gBrowser.getTabForBrowser(browser);

      let tabRestoredPromise = promiseTabRestored(tab2);
      ss.setTabState(tab2, state, true);

      // Run checkState() once the tab finishes loading its restored state.
      await tabRestoredPromise;
      await checkState(browser);
    }
  );
});
