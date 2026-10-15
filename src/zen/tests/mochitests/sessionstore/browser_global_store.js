/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Tests the API for saving global session data.
add_task(async function () {
  const key1 = "Unique name 1: " + Date.now();
  const key2 = "Unique name 2: " + Date.now();
  const value1 = "Unique value 1: " + Math.random();
  const value2 = "Unique value 2: " + Math.random();

  let global = {};
  global[key1] = value1;

  const testState = {
    windows: [
      {
        tabs: [
          { entries: [{ url: "about:blank", triggeringPrincipal_base64 }] },
        ],
      },
    ],
    global,
  };

  function testRestoredState() {
    is(
      ss.getCustomGlobalValue(key1),
      value1,
      "restored state has global value"
    );
  }

  function testGlobalStore() {
    is(ss.getCustomGlobalValue(key2), "", "global value initially not set");

    ss.setCustomGlobalValue(key2, value1);
    is(ss.getCustomGlobalValue(key2), value1, "retreived value matches stored");

    ss.setCustomGlobalValue(key2, value2);
    is(
      ss.getCustomGlobalValue(key2),
      value2,
      "previously stored value was overwritten"
    );

    ss.deleteCustomGlobalValue(key2);
    is(ss.getCustomGlobalValue(key2), "", "global value was deleted");
  }

  await promiseBrowserState(testState);
  testRestoredState();
  testGlobalStore();
});
