/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_little_window_container() {
  const win = await openLittleWindowWithPage({ userContextId: 2 });

  is(win.gZenLittleWindow.userContextId, 2, "The window has the container");
  is(win.gBrowser.selectedTab.userContextId, 2, "And so does its page");
  is(
    win.document.getElementById("zen-little-window-container-label").value,
    ContextualIdentityService.getUserContextLabel(2),
    "The container is named in the URL bar"
  );

  const popup = win.document.getElementById(
    "zen-little-window-container-popup"
  );
  popup.dispatchEvent(new win.Event("popupshowing"));
  popup.querySelector('[data-usercontextid="1"]').doCommand();
  await TestUtils.waitForCondition(
    () => win.gBrowser.selectedTab.userContextId == 1,
    "Picking another container reopens the page in it"
  );
  is(
    win.gBrowser.tabs.filter(tab => !tab.hasAttribute("zen-empty-tab")).length,
    1,
    "In place of the tab it was in"
  );
  is(
    win.document.getElementById("zen-little-window-container-label").value,
    ContextualIdentityService.getUserContextLabel(1),
    "And the URL bar names the new container"
  );

  await BrowserTestUtils.closeWindow(win);
});
