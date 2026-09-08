/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

let gDragStartCount = 0;

add_setup(async function () {
  const observer = () => gDragStartCount++;
  Services.obs.addObserver(observer, WINDOW_DRAG_TOPIC);
  registerCleanupFunction(() => {
    Services.obs.removeObserver(observer, WINDOW_DRAG_TOPIC);
  });
});

add_task(async function test_drag_from_empty_top_area() {
  await BrowserTestUtils.withNewTab(WINDOW_DRAG_TEST_PAGE, async browser => {
    await synthesizeContentDrag(browser, 50, 50);
    await TestUtils.waitForCondition(
      () => gDragStartCount === 1,
      "Dragging an empty area in the top region should start a window drag"
    );
    is(gDragStartCount, 1, "Exactly one window drag started");
  });
});

add_task(async function test_no_drag_on_interactive_target() {
  await BrowserTestUtils.withNewTab(WINDOW_DRAG_TEST_PAGE, async browser => {
    // Start the gesture on top of the link. Messages from the same actor
    // pair are ordered, so the control drag afterwards would arrive later.
    await BrowserTestUtils.synthesizeMouse(
      "#link",
      5,
      5,
      { type: "mousedown" },
      browser
    );
    await BrowserTestUtils.synthesizeMouse(
      "#link",
      35,
      15,
      { type: "mousemove", buttons: 1 },
      browser
    );
    await BrowserTestUtils.synthesizeMouse(
      "#link",
      45,
      20,
      { type: "mouseup" },
      browser
    );

    // Control drag from an eligible area.
    await synthesizeContentDrag(browser, 50, 50);
    await TestUtils.waitForCondition(
      () => gDragStartCount >= 2,
      "The control drag should start a window drag"
    );
    is(
      gDragStartCount,
      2,
      "Dragging a link must not start a window drag (only the control did)"
    );
  });
});

add_task(async function test_no_drag_below_top_region() {
  await BrowserTestUtils.withNewTab(WINDOW_DRAG_TEST_PAGE, async browser => {
    const innerHeight = await getContentInnerHeight(browser);
    await synthesizeContentDrag(browser, 50, Math.floor(innerHeight * 0.6));

    // Control drag from inside the top region.
    await synthesizeContentDrag(browser, 50, 50);
    await TestUtils.waitForCondition(
      () => gDragStartCount >= 3,
      "The control drag should start a window drag"
    );
    is(
      gDragStartCount,
      3,
      "Dragging below the top region must not start a window drag"
    );
  });
});

add_task(async function test_pref_disables_window_drag() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.view.drag-window-from-content", false]],
  });
  await BrowserTestUtils.withNewTab(WINDOW_DRAG_TEST_PAGE, async browser => {
    await synthesizeContentDrag(browser, 50, 50);
  });
  await SpecialPowers.popPrefEnv();

  // Control drag with the pref back on, in a fresh tab so the actor is
  // created again.
  await BrowserTestUtils.withNewTab(WINDOW_DRAG_TEST_PAGE, async browser => {
    await synthesizeContentDrag(browser, 50, 50);
    await TestUtils.waitForCondition(
      () => gDragStartCount >= 4,
      "The control drag should start a window drag"
    );
    is(
      gDragStartCount,
      4,
      "Dragging with the pref disabled must not start a window drag"
    );
  });
});
