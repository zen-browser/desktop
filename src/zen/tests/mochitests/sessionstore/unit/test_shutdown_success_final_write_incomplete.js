/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Ensures that when the previous session's checkpoints show the final state
// was never written, the shutdown is reported as unclean.

"use strict";

add_task(async function test_final_state_write_incomplete() {
  do_get_profile();
  let checkpoints = await IOUtils.readJSON(
    do_get_file("data/sessionCheckpoints_all.json").path
  );
  delete checkpoints["sessionstore-final-state-write-complete"];

  await promiseStartupWith({
    session: { version: ["sessionrestore", 1], windows: [], savedGroups: [] },
    checkpoints,
  });

  Assert.deepEqual(
    shutdownSuccessEvents(),
    [{ shutdown_ok: "true", shutdown_reason: "final-state-write-incomplete" }],
    "An unclean shutdown is recorded once, with shutdown_ok inverted."
  );
  Assert.deepEqual(
    shutdownOkCounts(),
    { clean: null, unclean: 1 },
    "shutdown_ok counts the shutdown as unclean."
  );
});
