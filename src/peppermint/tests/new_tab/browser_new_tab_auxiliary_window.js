/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// browser-commands.js is loaded in every top-level window (the macOS hidden
// window, Library, About), but Zen's UI manager only exists in browser
// windows. "New Tab" from such a window must open the tab in a browser window
// instead of throwing "gZenUIManager is not defined".

// The Library window does not link Zen's workspaces strings, which is a
// separate, known issue that this test must not depend on.
const { PromiseTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PromiseTestUtils.sys.mjs"
);
PromiseTestUtils.allowMatchingRejectionsGlobally(
  /zen-bookmark-edit-panel-workspace-selector/
);

add_task(async function test_open_tab_from_window_without_zen_ui() {
  const opened = BrowserTestUtils.domWindowOpenedAndLoaded();
  PlacesCommandHook.showPlacesOrganizer("History");
  const library = await opened;
  await TestUtils.waitForCondition(
    () => library.BrowserCommands,
    "The Library window loaded its scripts"
  );

  ok(library.BrowserCommands, "The Library window has BrowserCommands");
  ok(!library.gZenUIManager, "The Library window has no Zen UI manager");

  const tabCount = gBrowser.tabs.length;
  const tabOpened = BrowserTestUtils.waitForEvent(
    gBrowser.tabContainer,
    "TabOpen"
  );
  library.BrowserCommands.openTab();
  await tabOpened;
  Assert.greater(
    gBrowser.tabs.length,
    tabCount,
    "A new tab opened in the browser window"
  );

  await BrowserTestUtils.removeTab(gBrowser.selectedTab);
  await BrowserTestUtils.closeWindow(library);
});
