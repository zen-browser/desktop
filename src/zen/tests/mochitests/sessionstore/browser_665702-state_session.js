/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

function compareArray(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function test() {
  let currentState = JSON.parse(ss.getBrowserState());
  ok(currentState.session, "session data returned by getBrowserState");

  let keys = Object.keys(currentState.session);
  let expectedKeys = ["lastUpdate", "startTime", "recentCrashes"];
  ok(
    compareArray(keys.sort(), expectedKeys.sort()),
    "session object from getBrowserState has correct keys"
  );
}
