/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

add_task(async function () {
  let sessionData = {
    windows: [
      {
        tabs: [
          {
            entries: [{ url: "about:mozilla", triggeringPrincipal_base64 }],
            hidden: true,
          },
          {
            entries: [{ url: "about:blank", triggeringPrincipal_base64 }],
            hidden: false,
          },
        ],
      },
    ],
  };
  let url = "about:sessionrestore";
  let formdata = { id: { sessionData }, url };
  let state = {
    windows: [
      { tabs: [{ entries: [{ url, triggeringPrincipal_base64 }], formdata }] },
    ],
  };

  let win = await newWindowWithState(state);

  registerCleanupFunction(() => BrowserTestUtils.closeWindow(win));

  is(gBrowser.tabs.length, 1, "The total number of tabs should be 1");
  is(
    gBrowser.visibleTabs.length,
    1,
    "The total number of visible tabs should be 1"
  );

  await new Promise(resolve => executeSoon(resolve));
  await new Promise(resolve => waitForFocus(resolve, win));
  await middleClickTest(win);
});

async function middleClickTest(win) {
  let browser = win.gBrowser.selectedBrowser;
  let tabsToggle = browser.contentDocument.getElementById("tabsToggle");
  EventUtils.synthesizeMouseAtCenter(
    tabsToggle,
    { button: 0 },
    browser.contentWindow
  );
  let tree = browser.contentDocument.getElementById("tabList");
  await TestUtils.waitForCondition(() => !tree.hasAttribute("hidden"));
  // Force a layout flush before accessing coordinates.
  tree.getBoundingClientRect();

  is(tree.view.rowCount, 3, "There should be three items");

  // click on the first tab item
  var rect = tree.getCoordsForCellItem(1, tree.columns[1], "text");
  EventUtils.synthesizeMouse(
    tree.body,
    rect.x,
    rect.y,
    { button: 1 },
    browser.contentWindow
  );
  // click on the second tab item
  rect = tree.getCoordsForCellItem(2, tree.columns[1], "text");
  EventUtils.synthesizeMouse(
    tree.body,
    rect.x,
    rect.y,
    { button: 1 },
    browser.contentWindow
  );

  is(
    win.gBrowser.tabs.length,
    3,
    "The total number of tabs should be 3 after restoring 2 tabs by middle click."
  );
  is(
    win.gBrowser.visibleTabs.length,
    3,
    "The total number of visible tabs should be 3 after restoring 2 tabs by middle click"
  );
}

async function newWindowWithState(state) {
  let opts = "chrome,all,dialog=no,height=800,width=800";
  let win = window.openDialog(AppConstants.BROWSER_CHROME_URL, "_blank", opts);

  await BrowserTestUtils.waitForEvent(win, "load");

  // The form data will be restored before SSTabRestored, so we want to listen
  // for that on the currently selected tab
  await new Promise(resolve => {
    win.gBrowser.tabContainer.addEventListener(
      "SSTabRestored",
      function onSSTabRestored(event) {
        let tab = event.target;
        if (tab.selected) {
          win.gBrowser.tabContainer.removeEventListener(
            "SSTabRestored",
            onSSTabRestored,
            true
          );
          resolve();
        }
      },
      true
    );

    executeSoon(() => ss.setWindowState(win, JSON.stringify(state), true));
  });

  return win;
}
