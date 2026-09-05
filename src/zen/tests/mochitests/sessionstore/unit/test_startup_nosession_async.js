/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Test SessionStartup.sessionType in the following scenario:
// - no sessionstore.js;
// - the session store has been loaded, so no need to go
//    through the synchronous fallback

function run_test() {
  // Initialize the profile (the session startup uses it)
  do_get_profile();

  do_test_pending();

  afterSessionStartupInitialization(function cb() {
    Assert.equal(SessionStartup.sessionType, SessionStartup.NO_SESSION);
    do_test_finished();
  });
}
