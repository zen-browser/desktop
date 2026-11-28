/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function pages(win) {
  return win.gBrowser.tabs.filter(
    tab => !tab.closing && !tab.hasAttribute("zen-empty-tab")
  );
}

function hasPage(win, url) {
  return pages(win).some(tab => tab.linkedBrowser.currentURI.spec == url);
}

add_task(async function test_little_window_new_tabs_stay_in_it() {
  const win = await openLittleWindow({ url: TEST_URL });
  const tabs = gBrowser.tabs.length;

  win.openTrustedLinkIn(OTHER_URL, "tab");
  await TestUtils.waitForCondition(
    () => hasPage(win, OTHER_URL),
    "A new tab asked for in a little window opens in it"
  );
  is(pages(win).length, 2, "Next to the page it came from");
  ok(hasPage(win, TEST_URL), "Which is still there");
  is(gBrowser.tabs.length, tabs, "And nothing opens in the regular window");
  ok(!isShown(win, "navigator-toolbox"), "The tabs are still not shown");

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_little_window_links_to_new_tabs_stay() {
  const win = await openLittleWindow({ url: TEST_URL });
  const tabs = gBrowser.tabs.length;

  await SpecialPowers.spawn(win.gBrowser.selectedBrowser, [OTHER_URL], url => {
    const link = content.document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.textContent = "link";
    content.document.body.append(link);
    link.click();
  });
  await TestUtils.waitForCondition(
    () => win.gBrowser.selectedBrowser.currentURI.spec == OTHER_URL,
    "A link that opens a new tab opens it in the little window, in view"
  );
  is(pages(win).length, 2, "As a tab of its own");
  is(gBrowser.tabs.length, tabs, "And nothing opens in the regular window");

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_little_window_glance_opens_elsewhere() {
  const win = await openLittleWindow({ url: TEST_URL });
  const littleTabs = win.gBrowser.tabs.length;

  const opened = BrowserTestUtils.waitForNewTab(gBrowser, OTHER_URL);
  await win.gZenGlanceManager.openGlance({
    url: OTHER_URL,
    clientX: 0,
    clientY: 0,
    width: 0,
    height: 0,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });
  const tab = await opened;
  ok(
    !tab.hasAttribute("zen-glance-tab"),
    "A glance asked for in a little window is a plain tab in a regular one"
  );
  is(gBrowser.selectedTab, tab, "Selected there");
  is(win.gBrowser.tabs.length, littleTabs, "And nothing in the little window");

  BrowserTestUtils.removeTab(tab);
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_little_window_does_not_split() {
  const win = await openLittleWindow({ url: TEST_URL });
  const first = win.gBrowser.selectedTab;
  const second = BrowserTestUtils.addTab(win.gBrowser, OTHER_URL);
  const splitter = win.gZenViewSplitter;

  ok(!splitter.canSplit, "A little window cannot split its tabs");
  splitter.splitTabs([first, second]);
  ok(!first.splitView && !second.splitView, "Asking for a split does nothing");
  splitter.createEmptySplit();
  ok(!splitter.splitViewActive, "Nor does asking for an empty one");
  ok(!splitter.contextCanSplitTabs(), "And the menus do not offer it");
  ok(!splitter.canOpenLinkInSplitView(), "Nor for links");
  ok(
    !win.document.getElementById("context-zenSplitLink"),
    "Whose menu has no item to split them"
  );

  await BrowserTestUtils.closeWindow(win);
});
