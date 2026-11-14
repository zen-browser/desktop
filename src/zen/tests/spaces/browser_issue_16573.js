/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function sendSwipe(type, direction) {
  const event = document.createEvent("SimpleGestureEvent");
  event.initSimpleGestureEvent(
    type,
    true,
    true,
    window,
    0,
    0,
    0,
    0,
    0,
    false,
    false,
    false,
    false,
    0,
    null,
    0,
    direction,
    0
  );
  gNavToolbox.dispatchEvent(event);
  return event;
}

function swipe(direction) {
  const mayStart = sendSwipe("MozSwipeGestureMayStart", direction);
  if (!mayStart.defaultPrevented) {
    return false;
  }
  sendSwipe("MozSwipeGestureStart", direction);
  sendSwipe("MozSwipeGesture", direction);
  sendSwipe("MozSwipeGestureEnd", direction);
  return true;
}

add_task(async function test_swipe_interrupts_space_switch() {
  await gZenWorkspaces.promiseInitialized;
  await SpecialPowers.pushPrefEnv({
    set: [
      // Long enough that the second swipe lands while the first still plays.
      ["zen.workspaces.switch-animation-duration", 2000],
      ["zen.workspaces.wrap-around-navigation", true],
    ],
  });
  const originalWorkspace = gZenWorkspaces.activeWorkspace;
  const addedSpaces = [];
  try {
    while (gZenWorkspaces.getWorkspaces().length < 3) {
      const space = await gZenWorkspaces.createAndSaveWorkspace("Swipe test");
      addedSpaces.push(space.uuid);
    }
    const spaces = gZenWorkspaces.getWorkspaces();
    await gZenWorkspaces.changeWorkspace(spaces[0]);

    const { DIRECTION_RIGHT } = SimpleGestureEvent;
    const step = gZenWorkspaces.naturalScroll ? -1 : 1;
    const expected = spaces.at((2 * step) % spaces.length).uuid;

    Assert.ok(swipe(DIRECTION_RIGHT), "The first swipe starts");
    await TestUtils.waitForCondition(
      () => gZenWorkspaces.isChangingWorkspace,
      "The first switch is playing"
    );
    Assert.ok(
      swipe(DIRECTION_RIGHT),
      "A swipe during the switch is not ignored"
    );
    await TestUtils.waitForCondition(
      () =>
        gZenWorkspaces.activeWorkspace === expected &&
        !gZenWorkspaces.isChangingWorkspace,
      "Two swipes in a row move two spaces"
    );
  } finally {
    await gZenWorkspaces.changeWorkspaceWithID(originalWorkspace);
    for (const uuid of addedSpaces) {
      await gZenWorkspaces.removeWorkspace(uuid);
    }
    await SpecialPowers.popPrefEnv();
  }
});
