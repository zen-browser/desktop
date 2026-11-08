/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Ensures that with no checkpoints file, a session file without the
// session.state flag, which current versions never write, is reported as an
// unclean shutdown.

"use strict";

add_task(async function test_no_checkpoints_and_no_state_flag() {
  do_get_profile();

  await promiseStartupWith({
    session: { version: ["sessionrestore", 1], windows: [], savedGroups: [] },
  });

  Assert.deepEqual(
    shutdownSuccessEvents(),
    [
      {
        shutdown_ok: "true",
        shutdown_reason: "session-state-missing-or-running-at-last-write",
      },
    ],
    "An unclean shutdown is recorded once, with shutdown_ok inverted."
  );
  Assert.deepEqual(
    shutdownOkCounts(),
    { clean: null, unclean: 1 },
    "shutdown_ok counts the shutdown as unclean."
  );
});
