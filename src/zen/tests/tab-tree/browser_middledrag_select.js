/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_middle_drag_selects_range() {
  const t1 = await addNormalTab();
  const t2 = await addNormalTab();
  const t3 = await addNormalTab();
  gBrowser.clearMultiSelectedTabs();

  EventUtils.synthesizeMouseAtCenter(t1, { type: "mousedown", button: 1 }, window);
  // Move onto t3 to drag-select the t1..t3 range.
  EventUtils.synthesizeMouseAtCenter(
    t3,
    { type: "mousemove", button: 1 },
    window
  );

  Assert.ok(t1.multiselected, "t1 selected");
  Assert.ok(t2.multiselected, "t2 selected (in range)");
  Assert.ok(t3.multiselected, "t3 selected");

  // Cancel the gesture without closing.
  EventUtils.synthesizeKey("KEY_Escape", {}, window);
  gBrowser.clearMultiSelectedTabs();
  await cleanupTabs(t1, t2, t3);
});
