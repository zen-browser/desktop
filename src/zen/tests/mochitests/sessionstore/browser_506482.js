/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/* eslint-disable mozilla/no-arbitrary-setTimeout */

function test() {
  /** Test for Bug 506482 */

  // test setup
  waitForExplicitFinish();

  // read the sessionstore.js mtime (picked from browser_248970_a.js)
  let profilePath = Services.dirsvc.get("ProfD", Ci.nsIFile);
  function getSessionstoreFile() {
    let sessionStoreJS = profilePath.clone();
    sessionStoreJS.append("sessionstore.jsonlz4");
    return sessionStoreJS;
  }
  function getSessionstorejsModificationTime() {
    let file = getSessionstoreFile();
    if (file.exists()) {
      return file.lastModifiedTime;
    }
    return -1;
  }

  // delete existing sessionstore.js, to make sure we're not reading
  // the mtime of an old one initially.
  let sessionStoreJS = getSessionstoreFile();
  if (sessionStoreJS.exists()) {
    sessionStoreJS.remove(false);
  }

  // test content URL
  const TEST_URL =
    "data:text/html;charset=utf-8," +
    "<body style='width: 100000px; height: 100000px;'><p>top</p></body>";

  // preferences that we use
  const PREF_INTERVAL = "browser.sessionstore.interval";

  // make sure sessionstore.js is saved ASAP on all events
  Services.prefs.setIntPref(PREF_INTERVAL, 0);

  // get the initial sessionstore.js mtime (-1 if it doesn't exist yet)
  let mtime0 = getSessionstorejsModificationTime();

  // create and select a first tab
  let tab = BrowserTestUtils.addTab(gBrowser, TEST_URL);
  promiseBrowserLoaded(tab.linkedBrowser).then(() => {
    // step1: the above has triggered some saveStateDelayed(), sleep until
    // it's done, and get the initial sessionstore.js mtime
    setTimeout(function step1() {
      let mtime1 = getSessionstorejsModificationTime();
      isnot(mtime1, mtime0, "initial sessionstore.js update");

      // step2: test sessionstore.js is not updated on tab selection
      // or content scrolling
      gBrowser.selectedTab = tab;
      tab.linkedBrowser.contentWindow.scrollTo(1100, 1200);
      setTimeout(function step2() {
        let mtime2 = getSessionstorejsModificationTime();
        is(
          mtime2,
          mtime1,
          "tab selection and scrolling: sessionstore.js not updated"
        );

        // ok, done, cleanup and finish
        if (Services.prefs.prefHasUserValue(PREF_INTERVAL)) {
          Services.prefs.clearUserPref(PREF_INTERVAL);
        }
        gBrowser.removeTab(tab);
        finish();
      }, 3500); // end of sleep after tab selection and scrolling
    }, 3500); // end of sleep after initial saveStateDelayed()
  });
}
