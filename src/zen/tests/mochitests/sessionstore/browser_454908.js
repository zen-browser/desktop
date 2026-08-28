/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

if (gFissionBrowser) {
  addCoopTask(
    "browser_454908_sample.html",
    test_dont_save_passwords,
    HTTPSROOT
  );
}
addNonCoopTask("browser_454908_sample.html", test_dont_save_passwords, ROOT);
addNonCoopTask(
  "browser_454908_sample.html",
  test_dont_save_passwords,
  HTTPROOT
);
addNonCoopTask(
  "browser_454908_sample.html",
  test_dont_save_passwords,
  HTTPSROOT
);

const PASS = "pwd-" + Math.random();

/**
 * Bug 454908 - Don't save/restore values of password fields.
 */
async function test_dont_save_passwords(aURL) {
  // Make sure we do save form data.
  Services.prefs.clearUserPref("browser.sessionstore.privacy_level");

  // Add a tab with a password field.
  let tab = BrowserTestUtils.addTab(gBrowser, aURL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  // Fill in some values.
  let usernameValue = "User " + Math.random();
  await setPropertyOfFormField(browser, "#username", "value", usernameValue);
  await setPropertyOfFormField(browser, "#passwd", "value", PASS);

  // Close and restore the tab.
  await promiseRemoveTabAndSessionState(tab);
  tab = ss.undoCloseTab(window, 0);
  browser = tab.linkedBrowser;
  await promiseTabRestored(tab);

  // Check that password fields aren't saved/restored.
  let username = await getPropertyOfFormField(browser, "#username", "value");
  is(username, usernameValue, "username was saved/restored");
  let passwd = await getPropertyOfFormField(browser, "#passwd", "value");
  is(passwd, "", "password wasn't saved/restored");

  // Write to disk and read our file.
  await forceSaveState();
  await promiseForEachSessionRestoreFile((state, key) =>
    // Ensure that we have not saved our password.
    ok(!state.includes(PASS), "password has not been written to file " + key)
  );

  // Cleanup.
  gBrowser.removeTab(tab);
}
