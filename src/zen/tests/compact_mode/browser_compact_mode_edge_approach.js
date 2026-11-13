/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const EDGE_REACHED_TOPIC = "zen-mouse-tracker:edge-reached";

async function setCompactMode(value) {
  gZenCompactModeManager.preference = value;
  await TestUtils.waitForCondition(
    () => !document.documentElement.hasAttribute("zen-compact-animating"),
    "Compact mode finished animating"
  );
}

// Moves until the sidebar strip is watched; a closing sidebar is still too
// wide to count as hidden until its transition ends
async function armNearLeftEdge() {
  await TestUtils.waitForCondition(() => {
    EventUtils.synthesizeMouseAtPoint(
      10,
      window.innerHeight / 2,
      { type: "mousemove" },
      window
    );
    return gZenCompactModeManager._edgeApproach?.element === gNavToolbox;
  }, "A move near the left edge watches the sidebar strip");
}

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.view.compact.hide-tabbar", true],
      ["zen.tabs.vertical.right-side", false],
      ["zen.view.compact.animate-sidebar", false],
    ],
  });
  await setCompactMode(true);
  registerCleanupFunction(async () => {
    gZenCompactModeManager._setElementExpandAttribute(gNavToolbox, false);
    await setCompactMode(false);
  });
});

add_task(async function test_edge_reached_opens_armed_sidebar() {
  await armNearLeftEdge();
  Services.obs.notifyObservers(window, EDGE_REACHED_TOPIC);
  await TestUtils.waitForCondition(
    () => gNavToolbox.hasAttribute("zen-has-hover"),
    "The sidebar opens once the covered strip is reached"
  );

  gZenCompactModeManager._setElementExpandAttribute(gNavToolbox, false);
});

add_task(async function test_edge_reached_for_other_window_is_ignored() {
  await armNearLeftEdge();
  Services.obs.notifyObservers(null, EDGE_REACHED_TOPIC);
  await TestUtils.waitForTick();
  ok(
    !gNavToolbox.hasAttribute("zen-has-hover"),
    "A notification for another window leaves the sidebar closed"
  );
  is(
    gZenCompactModeManager._edgeApproach?.element,
    gNavToolbox,
    "The sidebar strip is still watched"
  );
});

add_task(async function test_edge_reached_after_compact_mode_off_is_ignored() {
  await armNearLeftEdge();
  await setCompactMode(false);
  Services.obs.notifyObservers(window, EDGE_REACHED_TOPIC);
  await TestUtils.waitForTick();
  ok(
    !gNavToolbox.hasAttribute("zen-has-hover"),
    "The sidebar doesn't get the hover attribute outside compact mode"
  );
  await setCompactMode(true);
});
