"use strict";

var uniqueName = "bug 465215";
var uniqueValue1 = "as good as unique: " + Date.now();
var uniqueValue2 = "as good as unique: " + Math.random();

add_task(async function () {
  // set a unique value on a new, blank tab
  let tab1 = BrowserTestUtils.addTab(gBrowser, "about:blank");
  await BrowserTestUtils.browserLoaded(tab1.linkedBrowser, {
    wantLoad: "about:blank",
  });
  ss.setCustomTabValue(tab1, uniqueName, uniqueValue1);

  // duplicate the tab with that value
  let tab2 = ss.duplicateTab(window, tab1);
  await promiseTabRestored(tab2);
  is(
    ss.getCustomTabValue(tab2, uniqueName),
    uniqueValue1,
    "tab value was duplicated"
  );

  ss.setCustomTabValue(tab2, uniqueName, uniqueValue2);
  isnot(
    ss.getCustomTabValue(tab1, uniqueName),
    uniqueValue2,
    "tab values aren't sync'd"
  );

  // overwrite the tab with the value which should remove it
  await promiseTabState(tab1, { entries: [] });
  is(ss.getCustomTabValue(tab1, uniqueName), "", "tab value was cleared");

  // clean up
  gBrowser.removeTab(tab2);
  gBrowser.removeTab(tab1);
});
