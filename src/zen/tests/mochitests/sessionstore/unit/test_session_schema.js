/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_schema_smoke_test() {
  let sessionData = await IOUtils.readJSON(
    PathUtils.join(do_get_cwd().path, "data", "sessionstore_complete.json")
  );
  let result;

  Assert.ok(
    sessionData.version[0],
    "Looks like we loaded up the session data ok"
  );

  try {
    result = await SessionStore.validateState(sessionData);
  } catch (ex) {
    info("Exception validating session data:" + ex.message);
  }

  if (!result.valid) {
    info(`Failed validation: ${JSON.stringify(result.errors)}`);
  }
  Assert.ok(result, "Got a validation result object");

  Assert.ok(result.valid, "the session file was validated against the schema");
});
