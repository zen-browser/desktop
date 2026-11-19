"use strict";

add_task(async function sessionRestoreInitialized() {
  Assert.greater(
    Glean.sessionRestore.startupTimeline.sessionRestoreInitialized.testGetValue(),
    0,
    "SessionStore.init() recorded a startup timeline value."
  );
});
