/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Touch must never start a native tab drag (it detaches the tab into a new
// window); mouse and pen keep native drag. Events are synthetic so the test
// is deterministic and needs no real touchscreen.

function pointer(target, type, pointerType, pointerId) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId,
    pointerType,
    isPrimary: true,
    button: 0,
  });
  target.dispatchEvent(event);
  return event;
}

function dragStart(tab) {
  const event = new DragEvent("dragstart", {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer(),
  });
  // Registered after Zen's capturing guard, so it only runs when the guard did
  // not cancel the event. It stops the synthetic drag from reaching the real
  // tab drag handlers, which expect a genuine drag session.
  const stop = e => e.stopPropagation();
  document.addEventListener("dragstart", stop, true);
  tab.dispatchEvent(event);
  document.removeEventListener("dragstart", stop, true);
  return event;
}

async function withTabs(count, callback) {
  const tabs = [];
  for (let i = 0; i < count; i++) {
    tabs.push(
      await BrowserTestUtils.openNewForegroundTab(gBrowser, "about:blank")
    );
  }
  try {
    await callback(tabs, tabs.map(tab => tab.getAttribute("draggable")));
  } finally {
    // A mouse press releases any touch guard still pending.
    pointer(tabs[0], "pointerdown", "mouse", 9000);
    tabs.forEach(tab => BrowserTestUtils.removeTab(tab));
  }
}

add_task(async function test_touch_blocks_drag_and_release_restores() {
  await withTabs(1, ([tab], [original]) => {
    const down = pointer(tab, "pointerdown", "touch", 1);
    Assert.ok(!down.defaultPrevented, "touch down is not cancelled (tap)");
    Assert.equal(tab.getAttribute("draggable"), "false", "drag disabled");
    Assert.ok(dragStart(tab).defaultPrevented, "dragstart is cancelled");

    pointer(tab, "pointerup", "touch", 1);
    Assert.equal(tab.getAttribute("draggable"), original, "state restored");
    Assert.ok(
      dragStart(tab).defaultPrevented,
      "a dragstart delivered just after release is still cancelled"
    );

    pointer(tab, "pointerdown", "mouse", 2);
    Assert.ok(!dragStart(tab).defaultPrevented, "mouse press ends the guard");
  });
});

add_task(async function test_mouse_and_pen_keep_native_drag() {
  await withTabs(1, ([tab], [original]) => {
    for (const type of ["mouse", "pen"]) {
      pointer(tab, "pointerdown", type, 10);
      Assert.equal(tab.getAttribute("draggable"), original, `${type} state`);
      Assert.ok(!dragStart(tab).defaultPrevented, `${type} drag not blocked`);
      pointer(tab, "pointerup", type, 10);
    }
  });
});

add_task(async function test_cancel_and_blur_restore() {
  await withTabs(2, ([a, b], [origA, origB]) => {
    pointer(a, "pointerdown", "touch", 20);
    pointer(a, "pointercancel", "touch", 20);
    Assert.equal(a.getAttribute("draggable"), origA, "cancel restores");

    pointer(b, "pointerdown", "touch", 21);
    window.dispatchEvent(new Event("blur"));
    Assert.equal(b.getAttribute("draggable"), origB, "blur restores");
    Assert.ok(!dragStart(b).defaultPrevented, "blur drops the guard");
  });
});

add_task(async function test_multi_touch() {
  await withTabs(2, ([a, b], [origA, origB]) => {
    // Two fingers on one tab: the guard lasts until the last finger lifts.
    pointer(a, "pointerdown", "touch", 30);
    pointer(a, "pointerdown", "touch", 31);
    pointer(a, "pointerup", "touch", 30);
    Assert.equal(a.getAttribute("draggable"), "false", "still guarded");
    pointer(a, "pointerup", "touch", 31);
    Assert.equal(a.getAttribute("draggable"), origA, "restored");

    // Fingers on two tabs are guarded independently.
    pointer(a, "pointerdown", "touch", 32);
    pointer(b, "pointerdown", "touch", 33);
    pointer(a, "pointerup", "touch", 32);
    Assert.equal(a.getAttribute("draggable"), origA, "first restored");
    Assert.equal(b.getAttribute("draggable"), "false", "second guarded");
    Assert.ok(dragStart(b).defaultPrevented, "second drag cancelled");
    pointer(b, "pointercancel", "touch", 33);
    Assert.equal(b.getAttribute("draggable"), origB, "second restored");
  });
});

add_task(async function test_pinned_tab() {
  await withTabs(1, async ([tab]) => {
    gBrowser.pinTab(tab);
    const original = tab.getAttribute("draggable");
    pointer(tab, "pointerdown", "touch", 40);
    Assert.equal(tab.getAttribute("draggable"), "false", "pinned guarded");
    pointer(tab, "pointerup", "touch", 40);
    Assert.equal(tab.getAttribute("draggable"), original, "pinned restored");
    Assert.ok(tab.pinned, "touch does not unpin");
  });
});

add_task(async function test_closing_tab_mid_touch() {
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:blank"
  );
  pointer(tab, "pointerdown", "touch", 41);
  BrowserTestUtils.removeTab(tab);
  Assert.ok(!tab.linkedBrowser, "tab is closed");
  // The closed tab's guard is gone; touch handling still works for others.
  const other = gBrowser.selectedTab;
  const original = other.getAttribute("draggable");
  pointer(other, "pointerdown", "touch", 42);
  Assert.equal(other.getAttribute("draggable"), "false", "still guards");
  pointer(other, "pointerup", "touch", 42);
  Assert.equal(other.getAttribute("draggable"), original, "still restores");
});

add_task(async function test_mouse_does_not_clear_concurrent_touch() {
  await withTabs(2, ([a, b], [origA, origB]) => {
    pointer(a, "pointerdown", "touch", 50);
    pointer(b, "pointerdown", "mouse", 51);
    Assert.equal(a.getAttribute("draggable"), "false", "held touch guarded");
    Assert.ok(dragStart(a).defaultPrevented, "touch drag still cancelled");
    Assert.equal(b.getAttribute("draggable"), origB, "mouse tab untouched");
    Assert.ok(!dragStart(b).defaultPrevented, "mouse drag stays native");
    pointer(a, "pointerup", "touch", 50);
    Assert.equal(a.getAttribute("draggable"), origA, "touch restored");
  });
});

add_task(async function test_reused_pointer_id_drops_lost_touch() {
  await withTabs(2, ([a, b], [origA]) => {
    // Touch 60 on `a` never ended; a new touch with the same id elsewhere
    // proves it is gone, so `a` must not stay non-draggable.
    pointer(a, "pointerdown", "touch", 60);
    pointer(b, "pointerdown", "touch", 60);
    Assert.equal(a.getAttribute("draggable"), origA, "lost touch released");
    Assert.equal(b.getAttribute("draggable"), "false", "new touch guarded");
  });
});
