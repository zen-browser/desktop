/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const CRASH_URL = "about:mozilla";
const CRASH_FAVICON = "chrome://branding/content/icon32.png";
const CRASH_SHENTRY = { url: CRASH_URL, triggeringPrincipal_base64 };
const CRASH_TAB = { entries: [CRASH_SHENTRY], image: CRASH_FAVICON };
const CRASH_STATE = { windows: [{ tabs: [CRASH_TAB] }] };

const TAB_URL = "about:sessionrestore";
const TAB_FORMDATA = { url: TAB_URL, id: { sessionData: CRASH_STATE } };
const TAB_SHENTRY = { url: TAB_URL, triggeringPrincipal_base64 };
const TAB_STATE = { entries: [TAB_SHENTRY], formdata: TAB_FORMDATA };

add_task(async function () {
  // Prepare a blank tab.
  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  let browser = tab.linkedBrowser;
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: "about:blank" });

  // Fake a post-crash tab.
  ss.setTabState(tab, JSON.stringify(TAB_STATE));
  await promiseTabRestored(tab);

  Assert.greater(gBrowser.tabs.length, 1, "we have more than one tab");

  let tabsToggle = browser.contentDocument.getElementById("tabsToggle");
  tabsToggle.click();
  await TestUtils.waitForCondition(
    () => browser.contentWindow.gTreeInitialized
  );
  let tree = browser.contentDocument.getElementById("tabList");
  let view = tree.view;
  ok(view.isContainer(0), "first entry is the window");
  let titleColumn = tree.columns.title;
  is(
    view.getCellProperties(1, titleColumn),
    "icon",
    "second entry is the tab and has a favicon"
  );

  let newWindowOpened = BrowserTestUtils.waitForNewWindow();

  SpecialPowers.spawn(browser.browsingContext, [], () => {
    content.document.getElementById("errorTryAgain").click();
  });

  // Wait until the new window was restored.
  let win = await newWindowOpened;

  BrowserTestUtils.removeTab(tab);
  await BrowserTestUtils.closeWindow(win);

  let [
    {
      tabs: [
        {
          entries: [{ url }],
        },
      ],
    },
  ] = ss.getClosedWindowData();
  is(url, CRASH_URL, "session was restored correctly");
  ss.forgetClosedWindow(0);
});
