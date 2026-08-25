/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_PAGE_URL =
  "data:text/html;charset=utf-8,<body>test_zoom_levels</body>";

/**
 * Waits for the zoom commands in the window to have the expected enabled
 * state.
 *
 * @param {object} expectedState
 *   An object where each key represents one of the zoom commands,
 *   and the value is a boolean that is true if the command should
 *   be enabled, and false if it should be disabled.
 *
 *   The keys are "enlarge", "reduce" and "reset" for readability,
 *   and internally this function maps those keys to the appropriate
 *   commands.
 * @returns {Promise<void>}
 */
async function waitForCommandEnabledState(expectedState) {
  const COMMAND_MAP = {
    enlarge: "cmd_fullZoomEnlarge",
    reduce: "cmd_fullZoomReduce",
    reset: "cmd_fullZoomReset",
  };

  await TestUtils.waitForCondition(() => {
    for (let commandKey in expectedState) {
      let commandID = COMMAND_MAP[commandKey];
      let command = document.getElementById(commandID);
      let expectedEnabled = expectedState[commandKey];

      if (command.hasAttribute("disabled") == expectedEnabled) {
        return false;
      }
    }
    Assert.ok("Commands finally reached the expected state.");
    return true;
  }, "Waiting for commands to reach the right state.");
}

/**
 * Tests that the "Zoom Text Only" command is in the right checked
 * state.
 *
 * @param {boolean} isChecked
 *   True if the command should have its "checked" attribute set to
 *   "true". Otherwise, ensures that the attribute is set to "false".
 */
function assertTextZoomCommandCheckedState(isChecked) {
  let command = document.getElementById("cmd_fullZoomToggle");
  Assert.equal(
    command.hasAttribute("checked"),
    isChecked,
    "Text zoom command has expected checked attribute"
  );
}

/**
 * Tests that zoom commands are properly updated when changing
 * zoom levels and/or preferences on an individual browser.
 */
add_task(async function test_update_browser_zoom() {
  await BrowserTestUtils.withNewTab(TEST_PAGE_URL, async () => {
    let currentZoom = await FullZoomHelper.getGlobalValue();
    Assert.equal(
      currentZoom,
      1,
      "We expect to start at the default zoom level."
    );

    await waitForCommandEnabledState({
      enlarge: true,
      reduce: true,
      reset: false,
    });
    assertTextZoomCommandCheckedState(false);

    // We'll run two variations of this test - one with text zoom enabled,
    // and the other without.
    for (let textZoom of [true, false]) {
      info(`Running variation with textZoom set to ${textZoom}`);

      await SpecialPowers.pushPrefEnv({
        set: [["browser.zoom.full", !textZoom]],
      });

      // 120% global zoom
      info("Changing default zoom by a single level");
      ZoomManager.zoom = 1.2;

      await waitForCommandEnabledState({
        enlarge: true,
        reduce: true,
        reset: true,
      });
      await assertTextZoomCommandCheckedState(textZoom);

      // Now max out the zoom level.
      ZoomManager.zoom = ZoomManager.MAX;

      await waitForCommandEnabledState({
        enlarge: false,
        reduce: true,
        reset: true,
      });
      await assertTextZoomCommandCheckedState(textZoom);

      // Now min out the zoom level.
      ZoomManager.zoom = ZoomManager.MIN;
      await waitForCommandEnabledState({
        enlarge: true,
        reduce: false,
        reset: true,
      });
      await assertTextZoomCommandCheckedState(textZoom);

      // Now reset back to the default zoom level
      ZoomManager.zoom = 1;
      await waitForCommandEnabledState({
        enlarge: true,
        reduce: true,
        reset: false,
      });
      await assertTextZoomCommandCheckedState(textZoom);
    }
  });
});

/**
 * Tests that zoom commands are properly updated when changing
 * zoom levels when the default zoom is not at 1.0.
 */
add_task(async function test_update_browser_zoom() {
  await BrowserTestUtils.withNewTab(TEST_PAGE_URL, async () => {
    let currentZoom = await FullZoomHelper.getGlobalValue();
    Assert.equal(
      currentZoom,
      1,
      "We expect to start at the default zoom level."
    );

    // Now change the default zoom to 200%, which is what we'll switch
    // back to when choosing to reset the zoom level.
    //
    // It's a bit maddening that changeDefaultZoom takes values in integer
    // units from 30 to 500, whereas ZoomManager.zoom takes things in float
    // units from 0.3 to 5.0, but c'est la vie for now.
    await FullZoomHelper.changeDefaultZoom(200);
    registerCleanupFunction(async () => {
      await FullZoomHelper.changeDefaultZoom(100);
    });

    await waitForCommandEnabledState({
      enlarge: true,
      reduce: true,
      reset: false,
    });

    // 120% global zoom
    info("Changing default zoom by a single level");
    ZoomManager.zoom = 2.2;

    await waitForCommandEnabledState({
      enlarge: true,
      reduce: true,
      reset: true,
    });
    await assertTextZoomCommandCheckedState(false);

    // Now max out the zoom level.
    ZoomManager.zoom = ZoomManager.MAX;

    await waitForCommandEnabledState({
      enlarge: false,
      reduce: true,
      reset: true,
    });
    await assertTextZoomCommandCheckedState(false);

    // Now min out the zoom level.
    ZoomManager.zoom = ZoomManager.MIN;
    await waitForCommandEnabledState({
      enlarge: true,
      reduce: false,
      reset: true,
    });
    await assertTextZoomCommandCheckedState(false);

    // Now reset back to the default zoom level
    ZoomManager.zoom = 2;
    await waitForCommandEnabledState({
      enlarge: true,
      reduce: true,
      reset: false,
    });
    await assertTextZoomCommandCheckedState(false);
  });
});
