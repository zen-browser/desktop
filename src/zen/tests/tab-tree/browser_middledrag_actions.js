/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_release_closes_selected_range() {
  const t1 = await addNormalTab();
  const t2 = await addNormalTab();
  const t3 = await addNormalTab();
  gBrowser.clearMultiSelectedTabs();

  EventUtils.synthesizeMouseAtCenter(t1, { type: "mousedown", button: 1 }, window);
  EventUtils.synthesizeMouseAtCenter(t3, { type: "mousemove", button: 1 }, window);
  const c1 = BrowserTestUtils.waitForTabClosing(t1);
  const c3 = BrowserTestUtils.waitForTabClosing(t3);
  EventUtils.synthesizeMouseAtCenter(t3, { type: "mouseup", button: 1 }, window);
  await Promise.all([c1, c3]);
  ok(t1.closing || !t1.isConnected, "t1 closed on release");
  ok(t3.closing || !t3.isConnected, "t3 closed on release");

  await cleanupTabs(t1, t2, t3);
});

add_task(async function test_rightclick_aborts_and_opens_menu() {
  const t1 = await addNormalTab();
  const t2 = await addNormalTab();
  gBrowser.clearMultiSelectedTabs();

  EventUtils.synthesizeMouseAtCenter(t1, { type: "mousedown", button: 1 }, window);
  EventUtils.synthesizeMouseAtCenter(t2, { type: "mousemove", button: 1 }, window);

  const menu = document.getElementById("tabContextMenu");
  const shown = BrowserTestUtils.waitForEvent(menu, "popupshown");
  EventUtils.synthesizeMouseAtCenter(
    t2,
    { type: "contextmenu", button: 2 },
    window
  );
  await shown;
  ok(true, "context menu opened on right-click during middle-drag");

  // After abort, releasing middle does nothing (tabs stay open).
  EventUtils.synthesizeMouseAtCenter(t2, { type: "mouseup", button: 1 }, window);
  ok(t1.isConnected && t2.isConnected, "tabs not closed after abort");

  menu.hidePopup();
  gBrowser.clearMultiSelectedTabs();
  await cleanupTabs(t1, t2);
});

add_task(async function test_clean_middleclick_closes_one() {
  const t1 = await addNormalTab();
  gBrowser.clearMultiSelectedTabs();
  const closing = BrowserTestUtils.waitForTabClosing(t1);
  EventUtils.synthesizeMouseAtCenter(t1, { type: "mousedown", button: 1 }, window);
  EventUtils.synthesizeMouseAtCenter(t1, { type: "mouseup", button: 1 }, window);
  await closing;
  ok(t1.closing || !t1.isConnected, "clean middle-click closes the single tab");
});

// A drag-close must close exactly the selected range — not the active tab when
// it sits outside that range (gBrowser.selectedTabs would wrongly append it).
add_task(async function test_drag_close_spares_active_tab_outside_range() {
  const active = await addNormalTab();
  const t1 = await addNormalTab();
  const t2 = await addNormalTab();
  gBrowser.selectedTab = active; // active tab is left of the t1..t2 range
  gBrowser.clearMultiSelectedTabs();

  EventUtils.synthesizeMouseAtCenter(t1, { type: "mousedown", button: 1 }, window);
  EventUtils.synthesizeMouseAtCenter(t2, { type: "mousemove", button: 1 }, window);
  const c1 = BrowserTestUtils.waitForTabClosing(t1);
  const c2 = BrowserTestUtils.waitForTabClosing(t2);
  EventUtils.synthesizeMouseAtCenter(t2, { type: "mouseup", button: 1 }, window);
  await Promise.all([c1, c2]);

  ok(t1.closing || !t1.isConnected, "t1 (in range) closed");
  ok(t2.closing || !t2.isConnected, "t2 (in range) closed");
  ok(
    active.isConnected && !active.closing,
    "the active tab outside the range is NOT closed"
  );

  await cleanupTabs(active);
});

// Regression: a jittery middle-click that briefly flicks onto a neighbouring tab
// (e.g. a tree parent in the row above) but is RELEASED back on the pressed tab
// must close only the pressed tab — the close set follows the release point, not
// the preview range the flick built.
add_task(async function test_jittery_middleclick_spares_neighbour() {
  const neighbour = await addNormalTab();
  const target = await addNormalTab();
  gBrowser.clearMultiSelectedTabs();

  EventUtils.synthesizeMouseAtCenter(
    target,
    { type: "mousedown", button: 1 },
    window
  );
  // flick onto the neighbour (builds a preview range incl. the neighbour) ...
  EventUtils.synthesizeMouseAtCenter(
    neighbour,
    { type: "mousemove", button: 1 },
    window
  );
  // ... then release back on the pressed tab.
  const closing = BrowserTestUtils.waitForTabClosing(target);
  EventUtils.synthesizeMouseAtCenter(
    target,
    { type: "mouseup", button: 1 },
    window
  );
  await closing;

  ok(target.closing || !target.isConnected, "the pressed tab closed");
  ok(
    neighbour.isConnected && !neighbour.closing,
    "the flicked-over but released-off neighbour is NOT closed"
  );

  await cleanupTabs(neighbour);
});
