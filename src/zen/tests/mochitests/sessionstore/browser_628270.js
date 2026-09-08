/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

async function test() {
  let assertNumberOfTabs = function (num, msg) {
    is(gBrowser.tabs.length, num, msg);
  };

  let assertNumberOfVisibleTabs = function (num, msg) {
    is(gBrowser.visibleTabs.length, num, msg);
  };

  waitForExplicitFinish();

  // check prerequisites
  assertNumberOfTabs(1, "we start off with one tab");

  // setup
  let tab = BrowserTestUtils.addTab(gBrowser, "about:mozilla");

  await promiseBrowserLoaded(tab.linkedBrowser);

  // hide the newly created tab
  assertNumberOfVisibleTabs(2, "there are two visible tabs");
  BrowserTestUtils.showOnlyTheseTabs(gBrowser, [gBrowser.tabs[0]]);
  assertNumberOfVisibleTabs(1, "there is one visible tab");
  ok(tab.hidden, "newly created tab is now hidden");

  // close and restore hidden tab
  await promiseRemoveTabAndSessionState(tab);
  tab = ss.undoCloseTab(window, 0);

  // check that everything was restored correctly, clean up and finish
  await promiseBrowserLoaded(tab.linkedBrowser);
  is(
    tab.linkedBrowser.currentURI.spec,
    "about:mozilla",
    "restored tab has correct url"
  );

  gBrowser.removeTab(tab);
  finish();
}
