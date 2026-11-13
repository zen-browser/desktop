/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  SessionWindowUI:
    "moz-src:///browser/components/sessionstore/SessionWindowUI.sys.mjs",
});

const PREF = "browser.startup.couldRestoreSession.count";

registerCleanupFunction(() => {
  Services.prefs.clearUserPref(PREF);
});

function incrementFrom(value) {
  Services.prefs.setIntPref(PREF, value);
  SessionWindowUI.maybeIncrementRestoreSessionSuggestionCount();
  return Services.prefs.getIntPref(PREF);
}

add_task(async function test_advances_from_zero() {
  Assert.equal(
    incrementFrom(0),
    1,
    "0 advances to 1, making the infobar eligible"
  );
});

add_task(async function test_leaves_disabled_value_alone() {
  Assert.equal(incrementFrom(-1), -1, "A negative count stays disabled");
});

add_task(async function test_leaves_eligible_value_alone() {
  Assert.equal(
    incrementFrom(1),
    1,
    "An eligible count is left for the infobar"
  );
});

add_task(async function test_leaves_shown_value_alone() {
  Assert.equal(incrementFrom(2), 2, "A count that has been shown stays shown");
});
