/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { TabStateFlusher } = ChromeUtils.importESModule(
  "moz-src:///browser/components/sessionstore/TabStateFlusher.sys.mjs"
);

add_task(async function test_little_window_is_not_in_the_session() {
  const windowCount = () =>
    JSON.parse(SessionStore.getBrowserState()).windows.length;
  const openCount = windowCount();
  const closedCount = SessionStore.getClosedWindowCount();

  const win = await openLittleWindowWithPage();
  await TabStateFlusher.flushWindow(win);
  is(windowCount(), openCount, "An open little window is not saved");

  await BrowserTestUtils.closeWindow(win);
  is(
    SessionStore.getClosedWindowCount(),
    closedCount,
    "Nor is it kept as a closed window to reopen"
  );
});
