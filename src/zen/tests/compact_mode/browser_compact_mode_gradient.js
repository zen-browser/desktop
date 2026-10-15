/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// A translated ancestor changes how a fixed background is painted. Compare the
// same point within the sidebar during and after its reveal, so the gradient
// cannot jump to the opposite end of the window's palette.
add_task(async function test_compact_sidebar_gradient_during_reveal() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.view.use-single-toolbar", true],
      ["zen.view.sidebar-expanded", true],
      ["zen.view.compact.hide-tabbar", true],
      ["zen.view.compact.animate-sidebar", false],
      ["zen.view.compact.enable-at-startup", false],
      ["zen.theme.acrylic-sidebar", false],
      ["zen.window-sync.enabled", false],
    ],
  });

  for (const rightSide of [false, true]) {
    await SpecialPowers.pushPrefEnv({
      set: [["zen.tabs.vertical.right-side", rightSide]],
    });
    const win = await BrowserTestUtils.openNewBrowserWindow();
    try {
      await win.gZenWorkspaces.promiseInitialized;
      await BrowserTestUtils.openNewForegroundTab(win.gBrowser, "about:robots");
      const manager = win.gZenCompactModeManager;
      const sidebar = win.gNavToolbox;
      manager.preference = true;
      await TestUtils.waitForCondition(
        () =>
          !win.document.documentElement.hasAttribute("zen-compact-animating") &&
          !sidebar.style.transition,
        "Compact-mode setup has finished"
      );

      const background = sidebar.querySelector(".zen-toolbar-background");
      const gradient = "linear-gradient(to right, red, blue)";
      background.style.setProperty(
        "--zen-main-browser-background-toolbar",
        gradient
      );
      background.style.setProperty(
        "--zen-main-browser-background-toolbar-old",
        gradient
      );

      const canvas = win.document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "canvas"
      );
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d");
      const sample = () => {
        const rect = background.getBoundingClientRect();
        const x = Math.round(rightSide ? rect.left + 30 : rect.right - 30);
        const y = Math.round(rect.top + rect.height * 0.6);
        Assert.ok(
          x > 0 && x < win.innerWidth,
          "The sample is inside the window"
        );
        context.drawWindow(win, x, y, 1, 1, "white");
        return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };

      // Exercise both the incoming and outgoing workspace-theme layers.
      for (const opacity of [1, 0]) {
        background.style.setProperty("--zen-background-opacity", opacity);
        sidebar.style.setProperty("transition", "none", "important");
        manager._setElementExpandAttribute(sidebar, true);
        const expected = sample();

        sidebar.style.setProperty(
          "transition",
          "translate 250ms linear",
          "important"
        );
        manager._setElementExpandAttribute(sidebar, false);
        win.getComputedStyle(sidebar).translate;
        for (const animation of sidebar.getAnimations()) {
          animation.finish();
        }
        sidebar.getBoundingClientRect();

        manager._setElementExpandAttribute(sidebar, true);
        win.getComputedStyle(sidebar).translate;
        const animation = sidebar
          .getAnimations()
          .find(item => item.transitionProperty === "translate");
        Assert.ok(animation, "Revealing the sidebar starts a translation");
        animation.pause();
        animation.currentTime = 125;
        await new Promise(resolve =>
          win.requestAnimationFrame(() => win.requestAnimationFrame(resolve))
        );

        const actual = sample();
        const difference = Math.max(
          ...actual.map((value, index) => Math.abs(value - expected[index]))
        );
        Assert.lessOrEqual(
          difference,
          8,
          `${rightSide ? "Right" : "Left"} sidebar layer ${opacity} keeps its gradient during reveal: ${actual} versus ${expected}`
        );
        animation.finish();
      }
    } finally {
      await BrowserTestUtils.closeWindow(win);
      await SpecialPowers.popPrefEnv();
    }
  }
  await SpecialPowers.popPrefEnv();
});
