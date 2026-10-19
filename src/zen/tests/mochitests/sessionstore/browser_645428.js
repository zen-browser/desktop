/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const NOTIFICATION = "sessionstore-browser-state-restored";

function test() {
  waitForExplicitFinish();

  function observe(subject, topic) {
    if (NOTIFICATION == topic) {
      finish();
      ok(true, "TOPIC received");
    }
  }

  Services.obs.addObserver(observe, NOTIFICATION);
  registerCleanupFunction(function () {
    Services.obs.removeObserver(observe, NOTIFICATION);
  });

  ss.setBrowserState(JSON.stringify({ windows: [] }));
}
