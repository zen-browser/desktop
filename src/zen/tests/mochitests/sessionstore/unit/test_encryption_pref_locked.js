/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// SessionStartup locks browser.sessionstore.encryption.available so a build
// cannot be talked into encrypting session data it does not support, while
// browser.sessionstore.encryption.enabled stays settable by users and policy.

function run_test() {
  do_get_profile();

  do_test_pending();

  afterSessionStartupInitialization(function cb() {
    Assert.ok(
      Services.prefs.prefIsLocked("browser.sessionstore.encryption.available"),
      "available pref is locked after session startup"
    );
    Assert.ok(
      !Services.prefs.prefIsLocked("browser.sessionstore.encryption.enabled"),
      "enabled pref is not locked after session startup"
    );
    do_test_finished();
  });
}
