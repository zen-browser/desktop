/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function sendTabPointer(target, type, pointerType, pointerId) {
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

function sendTabDragStart(tab) {
  const event = new DragEvent("dragstart", {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer(),
  });
  tab.dispatchEvent(event);
  return event;
}

add_task(async function test_touch_drag_cannot_detach_tab() {
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:blank"
  );
  const original = tab.getAttribute("draggable");

  try {
    const down = sendTabPointer(tab, "pointerdown", "touch", 101);
    Assert.ok(!down.defaultPrevented, "native tab selection is not cancelled");
    Assert.equal(
      tab.getAttribute("draggable"),
      "false",
      "touch disables native drag"
    );

    const drag = sendTabDragStart(tab);
    Assert.ok(drag.defaultPrevented, "a touch-origin tab drag is cancelled");

    sendTabPointer(tab, "pointerup", "touch", 101);
    Assert.equal(
      tab.getAttribute("draggable"),
      original,
      "touch release restores draggability"
    );

    const lateDrag = sendTabDragStart(tab);
    Assert.ok(
      lateDrag.defaultPrevented,
      "a delayed touch drag is also cancelled"
    );

    sendTabPointer(tab, "pointerdown", "mouse", 102);
    Assert.equal(
      tab.getAttribute("draggable"),
      original,
      "mouse input clears the touch guard"
    );
  } finally {
    sendTabPointer(tab, "pointerdown", "mouse", 103);
    BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_touch_cancel_restores_tab_drag() {
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:blank"
  );
  const original = tab.getAttribute("draggable");

  try {
    sendTabPointer(tab, "pointerdown", "touch", 201);
    Assert.equal(tab.getAttribute("draggable"), "false", "touch drag blocked");
    sendTabPointer(tab, "pointercancel", "touch", 201);
    Assert.equal(
      tab.getAttribute("draggable"),
      original,
      "cancel restores native drag"
    );
    sendTabPointer(tab, "pointerdown", "pen", 202);
    Assert.equal(
      tab.getAttribute("draggable"),
      original,
      "pen input keeps native drag enabled"
    );
  } finally {
    sendTabPointer(tab, "pointerdown", "mouse", 203);
    BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_pinned_tab_keeps_its_state_on_touch() {
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:blank"
  );
  gBrowser.pinTab(tab);
  const original = tab.getAttribute("draggable");

  try {
    sendTabPointer(tab, "pointerdown", "touch", 301);
    Assert.equal(
      tab.getAttribute("draggable"),
      "false",
      "pinned touch drag blocked"
    );
    sendTabPointer(tab, "pointerup", "touch", 301);
    Assert.equal(
      tab.getAttribute("draggable"),
      original,
      "pinned tab draggable state restored"
    );
    Assert.ok(tab.pinned, "touch does not unpin the tab");
  } finally {
    sendTabPointer(tab, "pointerdown", "mouse", 302);
    BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_simultaneous_touch_on_two_tabs() {
  const first = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:blank"
  );
  const second = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:blank"
  );
  const firstOriginal = first.getAttribute("draggable");
  const secondOriginal = second.getAttribute("draggable");

  try {
    sendTabPointer(first, "pointerdown", "touch", 401);
    sendTabPointer(second, "pointerdown", "touch", 402);
    Assert.equal(
      first.getAttribute("draggable"),
      "false",
      "first tab stays protected"
    );
    Assert.equal(
      second.getAttribute("draggable"),
      "false",
      "second tab stays protected"
    );
    Assert.ok(
      sendTabDragStart(first).defaultPrevented,
      "first touch drag is blocked"
    );
    Assert.ok(
      sendTabDragStart(second).defaultPrevented,
      "second touch drag is blocked"
    );

    sendTabPointer(first, "pointerup", "touch", 401);
    Assert.equal(
      first.getAttribute("draggable"),
      firstOriginal,
      "first release restores first tab"
    );
    Assert.equal(
      second.getAttribute("draggable"),
      "false",
      "second tab remains protected"
    );
    sendTabPointer(second, "pointercancel", "touch", 402);
    Assert.equal(
      second.getAttribute("draggable"),
      secondOriginal,
      "second cancel restores second tab"
    );
  } finally {
    sendTabPointer(first, "pointerdown", "mouse", 403);
    BrowserTestUtils.removeTab(second);
    BrowserTestUtils.removeTab(first);
  }
});

add_task(async function test_two_fingers_on_one_tab() {
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:blank"
  );
  const original = tab.getAttribute("draggable");

  try {
    sendTabPointer(tab, "pointerdown", "touch", 501);
    sendTabPointer(tab, "pointerdown", "touch", 502);
    sendTabPointer(tab, "pointerup", "touch", 501);
    Assert.equal(
      tab.getAttribute("draggable"),
      "false",
      "remaining finger holds touch guard"
    );
    Assert.ok(
      sendTabDragStart(tab).defaultPrevented,
      "remaining finger cannot detach tab"
    );
    sendTabPointer(tab, "pointerup", "touch", 502);
    Assert.equal(
      tab.getAttribute("draggable"),
      original,
      "last release restores original state"
    );
  } finally {
    sendTabPointer(tab, "pointerdown", "mouse", 503);
    BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_window_blur_restores_touch_tab() {
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:blank"
  );
  const original = tab.getAttribute("draggable");
  try {
    sendTabPointer(tab, "pointerdown", "touch", 601);
    Assert.equal(tab.getAttribute("draggable"), "false", "touch guard engaged");
    window.dispatchEvent(new Event("blur"));
    Assert.equal(
      tab.getAttribute("draggable"),
      original,
      "blur restores original state"
    );
  } finally {
    sendTabPointer(tab, "pointerdown", "mouse", 602);
    BrowserTestUtils.removeTab(tab);
  }
});
