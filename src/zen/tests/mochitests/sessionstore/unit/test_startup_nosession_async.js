/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Test SessionStartup.sessionType in the following scenario:
// - no sessionstore.js;
// - the session store has been loaded, so no need to go
//    through the synchronous fallback

function run_test() {
  // Initialize the profile (the session startup uses it)
  do_get_profile();
  Services.fog.initializeFOG();

  do_test_pending();

  afterSessionStartupInitialization(function cb() {
    Assert.equal(SessionStartup.sessionType, SessionStartup.NO_SESSION);
    Assert.deepEqual(
      shutdownSuccessEvents(),
      [],
      "No shutdown outcome is recorded when there is no session."
    );
    Assert.deepEqual(
      shutdownOkCounts(),
      { clean: null, unclean: null },
      "shutdown_ok is not recorded when there is no session."
    );
    do_test_finished();
  });
}
