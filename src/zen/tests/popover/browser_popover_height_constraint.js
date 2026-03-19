/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Test that the app menu panel respects available screen height when
// constrained. Without the fix, the panel ignores the available screen
// height and lets NSPopover silently clip the content.
// See gh-12782

add_task(async function test_appmenu_respects_screen_constraint() {
  const panel = document.getElementById("appMenu-popup");
  ok(panel, "appMenu-popup panel should exist");

  // Mock a very small screen
  const realAvailHeight = window.screen.availHeight;
  const realAvailTop = window.screen.availTop;
  Object.defineProperty(window.screen, "availHeight", {
    value: 400,
    configurable: true,
  });
  Object.defineProperty(window.screen, "availTop", {
    value: 0,
    configurable: true,
  });

  try {
    const popupShown = BrowserTestUtils.waitForEvent(panel, "popupshown");
    PanelUI.toggle({ type: "command" });
    await popupShown;
    await new Promise(requestAnimationFrame);

    const scrollBody = panel.querySelector(".panel-subview-body");
    ok(scrollBody, "Panel should have a scrollable body");

    // With the fix, the panel content should be constrained to fit
    // within the mocked screen height. Without the fix, the body
    // will be sized to the real screen height (~639px), ignoring
    // the available screen constraint.
    ok(
      scrollBody.clientHeight < 450,
      `Scroll body height (${scrollBody.clientHeight}) should be constrained ` +
        `to fit within available screen height (400), not the real screen`
    );

    const popupHidden = BrowserTestUtils.waitForEvent(panel, "popuphidden");
    PanelUI.toggle({ type: "command" });
    await popupHidden;
  } finally {
    Object.defineProperty(window.screen, "availHeight", {
      value: realAvailHeight,
      configurable: true,
    });
    Object.defineProperty(window.screen, "availTop", {
      value: realAvailTop,
      configurable: true,
    });
  }
});
