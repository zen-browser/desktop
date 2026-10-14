/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function () {
  await TestUtils.waitForCondition(
    () => !ChromeUtils.vsyncEnabled(),
    "wait for vsync to be disabled at the start of the test"
  );
  Assert.ok(!ChromeUtils.vsyncEnabled(), "vsync should be disabled");
  Cc["@mozilla.org/accessibilityService;1"].getService(
    Ci.nsIAccessibilityService
  );
  await TestUtils.waitForCondition(
    () => !ChromeUtils.vsyncEnabled(),
    "wait for vsync to be disabled after initializing the accessibility service"
  );
  Assert.ok(!ChromeUtils.vsyncEnabled(), "vsync should still be disabled");
});
