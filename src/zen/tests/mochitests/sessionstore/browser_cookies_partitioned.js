/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Bug 1922193 - Test that session restore can restore partitioned cookies
 * without the isPartitioned flag in the session cookie state. And verify the
 * isPartitioned flag is correctly set on the restored cookie.
 */

const TEST_HOST = "example.com";
const TEST_URL = `https://${TEST_HOST}`;
const MAX_EXPIRY = Math.pow(2, 62);

add_setup(async function () {
  // Make sure that sessionstore.js can be forced to be created by setting
  // the interval pref to 0.
  await SpecialPowers.pushPrefEnv({
    set: [["browser.sessionstore.interval", 0]],
  });
});

add_task(async function runTest() {
  Services.cookies.removeAll();

  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, TEST_URL);

  // Add a partitioned cookie.
  const cv = Services.cookies.add(
    TEST_HOST,
    "/",
    "foo",
    "bar",
    true,
    false,
    true,
    MAX_EXPIRY,
    { partitionKey: "(https,example.com)" },
    Ci.nsICookie.SAMESITE_NONE,
    Ci.nsICookie.SCHEME_HTTPS,
    true
  );
  is(cv.result, Ci.nsICookieValidation.eOK, "Valid cookie");

  await TabStateFlusher.flush(tab.linkedBrowser);

  // Get the sessionstore state for the window.
  let state = ss.getBrowserState();

  // Remove the isPartitioned flag from the stored cookie.
  state = JSON.parse(state);
  delete state.cookies[0].isPartitioned;
  state = JSON.stringify(state);

  // Remove the cookie.
  Services.cookies.removeAll();

  // Restore the window state.
  await setBrowserState(state);

  // One cookie should be restored.
  is(Services.cookies.cookies.length, 1, "One cookie should be restored.");

  let cookie = Services.cookies.cookies[0];
  is(cookie.name, "foo", "The cookie name should be foo.");
  is(cookie.value, "bar", "The cookie value should be bar.");
  ok(cookie.isPartitioned, "The isPartitioned flag should be set.");

  // Clean up.
  Services.cookies.removeAll();
  BrowserTestUtils.removeTab(tab);
});
