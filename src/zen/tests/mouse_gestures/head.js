/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const MOUSE_GESTURES_TEST_PAGE = `https://example.com/document-builder.sjs?html=${encodeURIComponent(
  "<!doctype html><body style='margin:0;height:100vh'>gesture area",
)}`;

/**
 * Holds the right mouse button at (x, y), moves along each [dx, dy] stroke
 * in a few steps and releases it.
 */
async function synthesizeRightDrag(browser, x, y, strokes) {
  await BrowserTestUtils.synthesizeMouse(
    null,
    x,
    y,
    { type: "mousedown", button: 2 },
    browser,
  );
  const steps = 5;
  for (const [dx, dy] of strokes) {
    for (let i = 1; i <= steps; i++) {
      await BrowserTestUtils.synthesizeMouse(
        null,
        x + (dx * i) / steps,
        y + (dy * i) / steps,
        { type: "mousemove", buttons: 2 },
        browser,
      );
    }
    x += dx;
    y += dy;
  }
  await BrowserTestUtils.synthesizeMouse(
    null,
    x,
    y,
    { type: "mouseup", button: 2 },
    browser,
  );
}
