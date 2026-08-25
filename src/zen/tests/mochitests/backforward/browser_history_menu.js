/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// This test verifies that the back forward button long-press menu and context menu
// shows the correct history items.

add_task(async function mousedown_back() {
  await testBackForwardMenu(false);
});

add_task(async function contextmenu_back() {
  await testBackForwardMenu(true);
});

async function openHistoryMenu(useContextMenu) {
  let backButton = document.getElementById("back-button");
  let rect = backButton.getBoundingClientRect();

  info("waiting for the history menu to open");

  let popupShownPromise = BrowserTestUtils.waitForEvent(
    useContextMenu ? document.getElementById("backForwardMenu") : backButton,
    "popupshown"
  );
  if (useContextMenu) {
    EventUtils.synthesizeMouseAtCenter(backButton, {
      type: "contextmenu",
      button: 2,
    });
  } else {
    EventUtils.synthesizeMouseAtCenter(backButton, { type: "mousedown" });
  }

  EventUtils.synthesizeMouse(backButton, rect.width / 2, rect.height, {
    type: "mouseup",
  });
  let popupEvent = await popupShownPromise;

  ok(true, "history menu opened");

  return popupEvent;
}

async function testBackForwardMenu(useContextMenu) {
  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    // eslint-disable-next-line @microsoft/sdl/no-insecure-url
    "http://example.com"
  );

  for (let iter = 2; iter <= 4; iter++) {
    // Iterate three times. For the first two times through the loop, add a new history item.
    // But for the last iteration, go back in the history instead.
    await SpecialPowers.spawn(
      gBrowser.selectedBrowser,
      [iter],
      async function (iterChild) {
        if (iterChild == 4) {
          let popStatePromise = new Promise(function (resolve) {
            content.onpopstate = resolve;
          });
          content.history.back();
          await popStatePromise;
        } else {
          // With the back-button intervention enabled, we need to make sure to
          // trigger a user activation on each history entry, or they won't
          // show in the menu.
          content.document.notifyUserGestureActivation();
          content.history.pushState({}, "" + iterChild, iterChild + ".html");
        }
      }
    );

    // Wait for the session data to be flushed before continuing the test
    await new Promise(resolve =>
      SessionStore.getSessionHistory(gBrowser.selectedTab, resolve)
    );

    let popupEvent = await openHistoryMenu(useContextMenu);

    // Wait for the session data to be flushed before continuing the test
    await new Promise(resolve =>
      SessionStore.getSessionHistory(gBrowser.selectedTab, resolve)
    );

    is(
      popupEvent.target.children.length,
      iter > 3 ? 3 : iter,
      "Correct number of history items"
    );

    let node = popupEvent.target.lastElementChild;
    // eslint-disable-next-line @microsoft/sdl/no-insecure-url
    is(node.getAttribute("uri"), "http://example.com/", "'1' item uri");
    is(node.getAttribute("index"), "0", "'1' item index");
    is(
      node.getAttribute("historyindex"),
      iter == 3 ? "-2" : "-1",
      "'1' item historyindex"
    );

    node = node.previousElementSibling;
    // eslint-disable-next-line @microsoft/sdl/no-insecure-url
    is(node.getAttribute("uri"), "http://example.com/2.html", "'2' item uri");
    is(node.getAttribute("index"), "1", "'2' item index");
    is(
      node.getAttribute("historyindex"),
      iter == 3 ? "-1" : "0",
      "'2' item historyindex"
    );

    if (iter >= 3) {
      node = node.previousElementSibling;
      // eslint-disable-next-line @microsoft/sdl/no-insecure-url
      is(node.getAttribute("uri"), "http://example.com/3.html", "'3' item uri");
      is(node.getAttribute("index"), "2", "'3' item index");
      is(
        node.getAttribute("historyindex"),
        iter == 4 ? "1" : "0",
        "'3' item historyindex"
      );
    }

    // Close the popup, but on the last iteration, click on one of the history items
    // to ensure it opens in a new tab.
    let popupHiddenPromise = BrowserTestUtils.waitForEvent(
      popupEvent.target,
      "popuphidden"
    );

    if (iter < 4) {
      popupEvent.target.hidePopup();
    } else {
      let newTabPromise = BrowserTestUtils.waitForNewTab(
        gBrowser,
        // eslint-disable-next-line @microsoft/sdl/no-insecure-url
        url => url == "http://example.com/"
      );

      popupEvent.target.activateItem(popupEvent.target.children[2], {
        button: 1,
      });

      let newtab = await newTabPromise;
      gBrowser.removeTab(newtab);
    }

    await popupHiddenPromise;
  }

  gBrowser.removeTab(tab);
}

// Make sure that the history popup appears after navigating around in a preferences page.
add_task(async function test_preferences_page() {
  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:preferences"
  );

  openPreferences("search");
  let popupEvent = await openHistoryMenu(true);

  // Wait for the session data to be flushed before continuing the test
  await new Promise(resolve =>
    SessionStore.getSessionHistory(gBrowser.selectedTab, resolve)
  );

  is(popupEvent.target.children.length, 2, "Correct number of history items");

  let popupHiddenPromise = BrowserTestUtils.waitForEvent(
    popupEvent.target,
    "popuphidden"
  );
  popupEvent.target.hidePopup();
  await popupHiddenPromise;

  gBrowser.removeTab(tab);
});
