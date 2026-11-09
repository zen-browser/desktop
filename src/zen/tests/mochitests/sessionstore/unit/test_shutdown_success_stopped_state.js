/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Ensures that with no checkpoints file, a session file whose session.state
// flag shows the session had stopped is reported as a clean shutdown.

"use strict";

add_task(async function test_no_checkpoints_and_stopped_state_flag() {
  do_get_profile();

  await promiseStartupWith({
    session: {
      version: ["sessionrestore", 1],
      windows: [],
      savedGroups: [],
      session: { state: "stopped" },
    },
  });

  Assert.deepEqual(
    shutdownSuccessEvents(),
    [{ shutdown_ok: "false", shutdown_reason: "N/A" }],
    "A clean shutdown is recorded once, with shutdown_ok inverted."
  );
  Assert.deepEqual(
    shutdownOkCounts(),
    { clean: 1, unclean: null },
    "shutdown_ok counts the shutdown as clean."
  );
});
