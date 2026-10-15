// Opens another window and switches focus between them.
add_task(async function test_window_focus() {
  let window2 = await BrowserTestUtils.openNewBrowserWindow();
  ok(!document.hasFocus(), "hasFocus after open second window");
  ok(window2.document.hasFocus(), "hasFocus after open second window");
  is(
    Services.focus.activeWindow,
    window2,
    "activeWindow after open second window"
  );
  is(
    Services.focus.focusedWindow,
    window2,
    "focusedWindow after open second window"
  );

  await SimpleTest.promiseFocus(window);
  ok(document.hasFocus(), "hasFocus after promiseFocus on window");
  ok(!window2.document.hasFocus(), "hasFocus after promiseFocus on window");
  is(
    Services.focus.activeWindow,
    window,
    "activeWindow after promiseFocus on window"
  );
  is(
    Services.focus.focusedWindow,
    window,
    "focusedWindow after promiseFocus on window"
  );

  await SimpleTest.promiseFocus(window2);
  ok(!document.hasFocus(), "hasFocus after promiseFocus on second window");
  ok(
    window2.document.hasFocus(),
    "hasFocus after promiseFocus on second window"
  );
  is(
    Services.focus.activeWindow,
    window2,
    "activeWindow after promiseFocus on second window"
  );
  is(
    Services.focus.focusedWindow,
    window2,
    "focusedWindow after promiseFocus on second window"
  );

  await BrowserTestUtils.closeWindow(window2);

  // If the window is already focused, this should just return.
  await SimpleTest.promiseFocus(window);
  await SimpleTest.promiseFocus(window);
});

// Opens two tabs and ensures that focus can be switched to the browser.
add_task(async function test_tab_focus() {
  let tab1 = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "data:text/html,<input>"
  );

  let tab2 = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "data:text/html,<input>"
  );

  gURLBar.focus();

  await SimpleTest.promiseFocus(tab2.linkedBrowser);
  is(
    document.activeElement,
    tab2.linkedBrowser,
    "Browser is focused after promiseFocus"
  );

  await SpecialPowers.spawn(tab1.linkedBrowser, [], () => {
    Assert.equal(
      Services.focus.activeBrowsingContext,
      null,
      "activeBrowsingContext in child process in hidden tab"
    );
    Assert.equal(
      Services.focus.focusedWindow,
      null,
      "focusedWindow in child process in hidden tab"
    );
    Assert.ok(
      !content.document.hasFocus(),
      "hasFocus in child process in hidden tab"
    );
  });

  await SpecialPowers.spawn(tab2.linkedBrowser, [], () => {
    Assert.equal(
      Services.focus.activeBrowsingContext,
      content.browsingContext,
      "activeBrowsingContext in child process in visible tab"
    );
    Assert.equal(
      Services.focus.focusedWindow,
      content.window,
      "focusedWindow in child process in visible tab"
    );
    Assert.ok(
      content.document.hasFocus(),
      "hasFocus in child process in visible tab"
    );
  });

  BrowserTestUtils.removeTab(tab1);
  BrowserTestUtils.removeTab(tab2);
});

// Opens a document with a nested hierarchy of frames using initChildFrames and
// focuses each child iframe in turn.
add_task(async function test_subframes_focus() {
  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    OOP_BASE_PAGE_URI
  );

  const markup = "<input>";

  let browser = tab.linkedBrowser;
  let browsingContexts = await initChildFrames(browser, markup);

  for (let blurSubframe of [true, false]) {
    for (let index = browsingContexts.length - 1; index >= 0; index--) {
      let bc = browsingContexts[index];

      // Focus each browsing context in turn. Do this twice, once when the window
      // is not already focused, and once when it is already focused.
      for (let step = 0; step < 2; step++) {
        let desc =
          "within child frame " +
          index +
          " step " +
          step +
          " blur subframe " +
          blurSubframe +
          " ";

        info(desc + "start");
        await SimpleTest.promiseFocus(bc, false, blurSubframe);

        let expectedFocusedBC = bc;
        // Becuase we are iterating backwards through the iframes, when we get to a frame
        // that contains the iframe we just tested, focusing it will keep the child
        // iframe focused as well, so we need to account for this when verifying which
        // child iframe is focused. For the root frame (index 0), the iframe nested
        // two items down will actually be focused.
        // If blurSubframe is true however, the iframe focus in the parent will be cleared,
        // so the focused window should be the parent instead.
        if (!blurSubframe) {
          if (index == 0) {
            expectedFocusedBC = browsingContexts[index + 2];
          } else if (index == 3 || index == 1) {
            expectedFocusedBC = browsingContexts[index + 1];
          }
        }
        is(
          Services.focus.focusedContentBrowsingContext,
          expectedFocusedBC,
          desc +
            " focusedContentBrowsingContext" +
            ":: " +
            Services.focus.focusedContentBrowsingContext?.id +
            "," +
            expectedFocusedBC?.id
        );

        // If the processes don't match, then the child iframe is an out-of-process iframe.
        let oop =
          expectedFocusedBC.currentWindowGlobal.osPid !=
          bc.currentWindowGlobal.osPid;
        await SpecialPowers.spawn(
          bc,
          [
            index,
            desc,
            expectedFocusedBC != bc ? expectedFocusedBC : null,
            oop,
          ],
          (num, descChild, childBC, isOop) => {
            Assert.equal(
              Services.focus.activeBrowsingContext,
              content.browsingContext.top,
              descChild + "activeBrowsingContext"
            );
            Assert.ok(
              content.document.hasFocus(),
              descChild + "hasFocus: " + content.browsingContext.id
            );

            // If a child browsing context is expected to be focused, the focusedWindow
            // should be set to that instead and the active element should be an iframe.
            // Otherwise, the focused window should be this window, and the active
            // element should be the document's body element.
            if (childBC) {
              // The frame structure is:
              //    A1
              //      -> B
              //      -> A2
              // where A and B are two processes. The frame A2 starts out focused. When B is
              // focused, A1's focus is updated correctly.

              // In Fission mode, childBC.window returns a non-null proxy even if OOP
              if (isOop) {
                Assert.equal(
                  Services.focus.focusedWindow,
                  null,
                  descChild + "focusedWindow"
                );
                Assert.ok(!childBC.docShell, descChild + "childBC.docShell");
              } else {
                Assert.equal(
                  Services.focus.focusedWindow,
                  childBC.window,
                  descChild + "focusedWindow"
                );
              }
              Assert.equal(
                content.document.activeElement.localName,
                "iframe",
                descChild + "activeElement"
              );
            } else {
              Assert.equal(
                Services.focus.focusedWindow,
                content.window,
                descChild + "focusedWindow"
              );
              Assert.equal(
                content.document.activeElement,
                content.document.body,
                descChild + "activeElement"
              );
            }
          }
        );
      }
    }
  }

  // Focus the top window without blurring the browser.
  await SimpleTest.promiseFocus(window, false, false);
  is(
    document.activeElement.localName,
    "browser",
    "focus after blurring browser blur subframe false"
  );

  // Now, focus the top window, blurring the browser.
  await SimpleTest.promiseFocus(window, false, true);
  is(
    document.activeElement,
    document.body,
    "focus after blurring browser blur subframe true"
  );

  BrowserTestUtils.removeTab(tab);
});
