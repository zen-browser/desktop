/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
});

function floatingAnimation(id) {
  return gURLBar
    .getAnimations({ subtree: true })
    .find(animation => animation.id === id);
}

async function openFloatingUrlbar(open) {
  await UrlbarTestUtils.promisePopupOpen(window, open);
  const animation = floatingAnimation("zen-floating-urlbar-open");
  ok(animation, "Every floating opening starts an entrance animation");
  ok(gURLBar.focused, "Every opening keeps keyboard focus in the search input");
  await TestUtils.waitForCondition(
    () => animation.playState === "running",
    "Entrance starts after the floating layout is ready",
    10
  );
  animation.pause();
  return animation;
}

async function dismissFloatingUrlbar(
  dismiss = () => EventUtils.synthesizeKey("KEY_Escape")
) {
  dismiss();
  await TestUtils.waitForCondition(
    () => floatingAnimation("zen-floating-urlbar-close"),
    "Waiting for the close animation",
    10
  );
  const animation = floatingAnimation("zen-floating-urlbar-close");
  animation.pause();
  return animation;
}

add_setup(async function () {
  const testingEnabled = gZenUIManager.testingEnabled;
  gZenUIManager.testingEnabled = false;
  await SpecialPowers.pushPrefEnv({ set: [["ui.prefersReducedMotion", 0]] });
  await SimpleTest.promiseFocus(window);
  gURLBar.blur();
  await TestUtils.waitForCondition(() => !gURLBar.matches(":popover-open"));
  registerCleanupFunction(() => {
    gZenUIManager.testingEnabled = testingEnabled;
    gZenUIManager.finishFloatingURLBarClose();
    gURLBar.view.close();
    gURLBar.blur();
    gZenUIManager.finishFloatingURLBarClose();
  });
});

add_task(async function test_Repeated_Shortcut_And_Button_Openings() {
  const openers = [
    () => EventUtils.synthesizeKey("l", { accelKey: true }),
    () => EventUtils.synthesizeKey("t", { accelKey: true }),
    () =>
      EventUtils.synthesizeMouseAtCenter(
        gZenWorkspaces.activeWorkspaceElement.newTabButton,
        {}
      ),
  ];
  for (const open of openers) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const entrance = await openFloatingUrlbar(open);
      entrance.currentTime = 60;
      Assert.equal(
        getComputedStyle(gURLBar).opacity,
        "1",
        "The blur's parent stays opaque during entrance"
      );
      const background = gURLBar.querySelector(".urlbar-background");
      Assert.equal(
        background.getAnimations().length,
        0,
        "The glass surface never gets an opacity animation"
      );
      Assert.equal(
        getComputedStyle(background).opacity,
        "1",
        "The glass remains opaque to the compositor throughout entrance"
      );
      const content = gURLBar.querySelector(".urlbar-input-container");
      const fade = content
        .getAnimations()
        .find(animation => animation.id === "zen-floating-urlbar-fade");
      ok(fade, "The input fades independently of the glass");
      fade.pause();
      fade.currentTime = 60;
      Assert.less(
        Number(getComputedStyle(content).opacity),
        1,
        "The input fades in"
      );
      ok(gURLBar.focused, "Typing is available throughout the entrance");
      entrance.finish();

      const exit = await dismissFloatingUrlbar();
      ok(!gURLBar.focused, "Dismissal returns focus immediately");
      Assert.equal(
        getComputedStyle(gURLBar).pointerEvents,
        "none",
        "The closing box does not intercept clicks"
      );
      ok(
        gURLBar.matches(":popover-open"),
        "The box stays visible for its exit animation"
      );

      const reopened = await openFloatingUrlbar(open);
      Assert.notEqual(reopened, entrance, "Reopening creates a fresh entrance");
      Assert.equal(
        exit.playState,
        "idle",
        "Reopening cancels the previous exit"
      );
      ok(
        !gURLBar.hasAttribute("zen-urlbar-closing"),
        "A previous close cannot hide the reopened box"
      );
      reopened.finish();
      const finalExit = await dismissFloatingUrlbar();
      finalExit.play();
      await finalExit.finished;
      await TestUtils.waitForCondition(() => !gURLBar.matches(":popover-open"));
      ok(
        !gURLBar.hasAttribute("zen-floating-urlbar"),
        "The floating layout is restored after dismissal"
      );
    }
  }
});

add_task(
  async function test_Reopening_Popover_With_Existing_Suggestions_View() {
    const first = await openFloatingUrlbar(() =>
      EventUtils.synthesizeKey("l", { accelKey: true })
    );
    first.finish();
    // The suggestions view can survive a popover transition. It will not emit a
    // second VIEW_OPEN notification when updatePopover restores the floating box.
    gURLBar.hidePopover();
    ok(gURLBar.view.isOpen, "The existing suggestions view remains open");
    gURLBar.updatePopover();
    const reopened = floatingAnimation("zen-floating-urlbar-open");
    ok(
      reopened,
      "Reopening the box animates even without another view notification"
    );
    Assert.notEqual(reopened, first, "The restored box gets a fresh entrance");
    await TestUtils.waitForCondition(() => reopened.playState === "running");
    await reopened.finished;
    const exit = await dismissFloatingUrlbar();
    exit.play();
    await exit.finished;
    await TestUtils.waitForCondition(() => !gURLBar.matches(":popover-open"));
  }
);

add_task(async function test_New_Tab_Shortcut_Toggle_And_Blur() {
  const open = () => EventUtils.synthesizeKey("t", { accelKey: true });
  const first = await openFloatingUrlbar(open);
  first.finish();
  const exit = await dismissFloatingUrlbar(open);
  const reopened = await openFloatingUrlbar(open);
  Assert.equal(
    exit.playState,
    "idle",
    "Ctrl+T can interrupt a closing new-tab box"
  );
  reopened.finish();
  const blurExit = await dismissFloatingUrlbar(() =>
    gBrowser.selectedBrowser.focus()
  );
  blurExit.play();
  await blurExit.finished;
  await TestUtils.waitForCondition(() => !gURLBar.matches(":popover-open"));
});

add_task(async function test_Reduced_Motion_Disables_Both_Animations() {
  await SpecialPowers.pushPrefEnv({ set: [["ui.prefersReducedMotion", 1]] });
  await UrlbarTestUtils.promisePopupOpen(window, () =>
    EventUtils.synthesizeKey("t", { accelKey: true })
  );
  ok(
    !floatingAnimation("zen-floating-urlbar-open"),
    "Reduced motion disables entrance"
  );
  await UrlbarTestUtils.promisePopupClose(window, () =>
    EventUtils.synthesizeKey("KEY_Escape")
  );
  ok(
    !floatingAnimation("zen-floating-urlbar-close"),
    "Reduced motion disables exit"
  );
  ok(
    !gURLBar.matches(":popover-open"),
    "Reduced motion dismisses the box without delay"
  );
  await SpecialPowers.popPrefEnv();
});
