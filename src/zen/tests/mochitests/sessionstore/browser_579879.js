"use strict";

add_task(async function () {
  let tab1 = BrowserTestUtils.addTab(
    gBrowser,
    "data:text/plain;charset=utf-8,foo"
  );
  gBrowser.pinTab(tab1);

  await promiseBrowserLoaded(tab1.linkedBrowser);
  let tab2 = BrowserTestUtils.addTab(gBrowser);
  gBrowser.pinTab(tab2);

  is(
    Array.prototype.indexOf.call(gBrowser.tabs, tab1),
    0,
    "pinned tab 1 is at the first position"
  );
  await promiseRemoveTabAndSessionState(tab1);

  tab1 = SessionWindowUI.undoCloseTab(window);
  ok(tab1.pinned, "pinned tab 1 has been restored as a pinned tab");
  is(
    Array.prototype.indexOf.call(gBrowser.tabs, tab1),
    0,
    "pinned tab 1 has been restored to the first position"
  );

  BrowserTestUtils.removeTab(tab1);
  BrowserTestUtils.removeTab(tab2);
});
