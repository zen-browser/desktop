/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

add_task(async function () {
  // make sure that the next closed tab will increase getClosedTabCountForWindow
  let max_tabs_undo = Services.prefs.getIntPref(
    "browser.sessionstore.max_tabs_undo"
  );
  Services.prefs.setIntPref(
    "browser.sessionstore.max_tabs_undo",
    max_tabs_undo + 1
  );
  registerCleanupFunction(() =>
    Services.prefs.clearUserPref("browser.sessionstore.max_tabs_undo")
  );

  forgetClosedTabs(window);

  // restore a blank tab
  let tab = BrowserTestUtils.addTab(gBrowser, "about:mozilla");
  await promiseBrowserLoaded(tab.linkedBrowser);

  let count = await promiseSHistoryCount(tab.linkedBrowser);
  Assert.greaterOrEqual(
    count,
    1,
    "the new tab does have at least one history entry"
  );

  await promiseTabState(tab, { entries: [] });

  // We may have a different sessionHistory object if the tab
  // switched from non-remote to remote.
  count = await promiseSHistoryCount(tab.linkedBrowser);
  is(count, 0, "the tab was restored without any history whatsoever");

  await promiseRemoveTabAndSessionState(tab);
  is(
    ss.getClosedTabCountForWindow(window),
    0,
    "The closed blank tab wasn't added to Recently Closed Tabs"
  );
});

function promiseSHistoryCount(browser) {
  return SpecialPowers.spawn(browser, [], async function () {
    return docShell.QueryInterface(Ci.nsIWebNavigation).sessionHistory.count;
  });
}
