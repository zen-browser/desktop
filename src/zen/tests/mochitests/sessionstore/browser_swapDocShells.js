"use strict";

add_task(async function () {
  let tab = (gBrowser.selectedTab = BrowserTestUtils.addTab(
    gBrowser,
    "about:mozilla"
  ));
  await promiseBrowserLoaded(gBrowser.selectedBrowser);

  let win = gBrowser.replaceTabWithWindow(tab);
  await promiseDelayedStartupFinished(win);
  await promiseBrowserHasURL(win.gBrowser.browsers[0], "about:mozilla");

  win.duplicateTabIn(win.gBrowser.selectedTab, "tab");
  await promiseTabRestored(win.gBrowser.tabs[1]);

  let browser = win.gBrowser.browsers[1];
  is(browser.currentURI.spec, "about:mozilla", "tab was duplicated");

  await BrowserTestUtils.closeWindow(win);
});

function promiseDelayedStartupFinished(win) {
  return new Promise(resolve => {
    whenDelayedStartupFinished(win, resolve);
  });
}

function promiseBrowserHasURL(browser, url) {
  let promise = Promise.resolve();

  if (
    browser.contentDocument.readyState === "complete" &&
    browser.currentURI.spec === url
  ) {
    return promise;
  }

  return promise.then(() => promiseBrowserHasURL(browser, url));
}
