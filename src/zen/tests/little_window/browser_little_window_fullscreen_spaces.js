/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const PREF = "zen.little-window.float-over-fullscreen";

add_task(async function test_little_window_floats_over_fullscreen() {
  const win = await openLittleWindow({ url: TEST_URL });
  is(
    win.document.documentElement.getAttribute("macnativefullscreen"),
    "false",
    "A little window can be shown over another app's fullscreen Space"
  );
  isnot(
    document.documentElement.getAttribute("macnativefullscreen"),
    "false",
    "A regular window can still go fullscreen"
  );
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_little_window_float_over_fullscreen_disabled() {
  await SpecialPowers.pushPrefEnv({ set: [[PREF, false]] });
  const win = await openLittleWindow({ url: TEST_URL });
  is(
    win.document.documentElement.getAttribute("macnativefullscreen"),
    document.documentElement.getAttribute("macnativefullscreen"),
    "Without the pref, a little window is like any other window"
  );
  await BrowserTestUtils.closeWindow(win);
  await SpecialPowers.popPrefEnv();
});
