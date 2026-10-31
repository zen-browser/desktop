/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_compact_mode_toggle_position() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.view.use-single-toolbar", false],
      ["zen.view.sidebar-expanded", true],
      ["zen.view.compact.hide-tabbar", true],
      ["zen.view.compact.hide-toolbar", false],
      ["zen.tabs.vertical.right-side", true],
    ],
  });

  const initialCompactMode = gZenCompactModeManager.preference;
  const initialStyle = gNavToolbox.getAttribute("style");
  registerCleanupFunction(async () => {
    await setCompactMode(initialCompactMode);
    gNavToolbox.setAttribute("style", initialStyle);
  });

  async function setCompactMode(enabled) {
    await TestUtils.waitForCondition(
      () => !document.documentElement.hasAttribute("zen-compact-animating"),
      "The previous compact-mode animation has finished"
    );
    if (gZenCompactModeManager.preference !== enabled) {
      document.getElementById("cmd_toggleCompactModeIgnoreHover").doCommand();
    }
    await TestUtils.waitForCondition(
      () =>
        gZenCompactModeManager.preference === enabled &&
        !document.documentElement.hasAttribute("zen-compact-animating"),
      "Compact mode has reached the requested state"
    );
    await new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
  }

  const button = document.getElementById("zen-toggle-compact-mode");
  for (const [hideControls, width] of [
    [true, 240],
    [true, 320],
    [false, 240],
    [false, 320],
  ]) {
    await setCompactMode(false);
    await SpecialPowers.pushPrefEnv({
      set: [["zen.view.hide-window-controls", hideControls]],
    });
    gNavToolbox.style.width = `${width}px`;
    gNavToolbox.style.setProperty("--zen-sidebar-width", `${width}px`);
    info(`Sidebar width ${width}, window controls hidden: ${hideControls}`);
    const expanded = button.getBoundingClientRect();
    Assert.greater(expanded.width, 0, "The compact-mode toggle is visible");

    await setCompactMode(true);
    const compact = button.getBoundingClientRect();
    Assert.greater(
      compact.width,
      0,
      "The toggle remains visible in compact mode"
    );
    Assert.lessOrEqual(
      Math.abs(compact.x - expanded.x),
      1,
      "The right sidebar toggle does not shift horizontally"
    );

    await setCompactMode(false);
    Assert.lessOrEqual(
      Math.abs(button.getBoundingClientRect().x - expanded.x),
      1,
      "Reopening the sidebar restores the toggle position"
    );
    await SpecialPowers.popPrefEnv();
  }
});
