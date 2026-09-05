/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function fireGesture(type, delta = 0) {
  const strip = document.getElementById("tabbrowser-tabs");
  const rect = strip.getBoundingClientRect();
  const x = Math.round(rect.left + rect.width / 2);
  const y = Math.round(rect.top + rect.height / 2);
  const event = document.createEvent("SimpleGestureEvent");
  event.initSimpleGestureEvent(
    type,
    true,
    true,
    window,
    0,
    x,
    y,
    x,
    y,
    false,
    false,
    false,
    false,
    0,
    null,
    0,
    SimpleGestureEvent.DIRECTION_RIGHT,
    delta,
    0
  );
  strip.dispatchEvent(event);
}

function activeWorkspaceElement() {
  return gZenWorkspaces.workspaceElement(gZenWorkspaces.activeWorkspace);
}

function stripOffset(element) {
  const match = /translateX\((-?[\d.]+)%\)/.exec(element.style.transform || "");
  return match ? parseFloat(match[1]) : 0;
}

// Tasks must not inherit a started gesture or an offset strip from each other,
// otherwise a failure in one shows up as a confusing failure in the next.
async function settleStrip() {
  gZenWorkspaces._swipeManager.onSwipeGestureAnimationEnd();
  gZenWorkspaces._cancelSwipeAnimation();
  await TestUtils.waitForCondition(
    () => stripOffset(activeWorkspaceElement()) === 0,
    "The tab strip starts out settled on the current space"
  );
}

async function startSwipeAndAssertItMoved() {
  await settleStrip();

  const element = activeWorkspaceElement();
  const restingOffset = stripOffset(element);

  fireGesture("MozSwipeGestureMayStart");
  fireGesture("MozSwipeGestureStart");
  fireGesture("MozSwipeGestureUpdate", 0.3);

  Assert.ok(
    gZenWorkspaces._swipeManager.isGestureActive,
    "A swipe gesture is in progress"
  );
  Assert.equal(
    document.documentElement.getAttribute("swipe-gesture"),
    "true",
    "The swipe disables pointer events on the tab strip while it runs"
  );
  Assert.notEqual(
    stripOffset(element),
    restingOffset,
    "The swipe moved the tab strip off its resting position"
  );

  return element;
}

async function assertStripRecovered(element) {
  Assert.ok(
    !gZenWorkspaces._swipeManager.isGestureActive,
    "The abandoned gesture was ended"
  );
  Assert.equal(
    document.documentElement.getAttribute("swipe-gesture"),
    null,
    "The swipe-gesture attribute is gone, so the tab strip takes events again"
  );
  Assert.equal(
    window.getComputedStyle(
      document.getElementById("tabbrowser-arrowscrollbox")
    ).pointerEvents,
    "auto",
    "The tab strip can be scrolled again"
  );

  await TestUtils.waitForCondition(
    () => stripOffset(element) === 0,
    "The tab strip animates back onto the current space"
  );
}

add_setup(async function () {
  await gZenWorkspaces.promiseInitialized;
  Assert.ok(
    gZenWorkspaces._swipeManager,
    "Precondition: swipe gestures are enabled"
  );

  // Do not leak a started gesture into the rest of the run.
  registerCleanupFunction(() => settleStrip());
});

// A gesture that is interrupted never gets a MozSwipeGestureEnd, so nothing used
// to put the strip back and the tab strip kept its pointer events disabled.
add_task(async function test_Issue_14984_window_deactivated_mid_swipe() {
  const element = await startSwipeAndAssertItMoved();

  window.dispatchEvent(new Event("deactivate"));

  await assertStripRecovered(element);
});

add_task(async function test_Issue_14984_popup_opened_mid_swipe() {
  const element = await startSwipeAndAssertItMoved();

  document.dispatchEvent(new Event("popupshown"));

  await assertStripRecovered(element);
});
