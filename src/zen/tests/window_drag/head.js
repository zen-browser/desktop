/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const WINDOW_DRAG_TOPIC = "zen-window-drag-started";

const WINDOW_DRAG_TEST_PAGE = `https://example.com/document-builder.sjs?html=${encodeURIComponent(`
  <!doctype html>
  <style>
    body { margin: 0; }
    #link {
      position: fixed;
      top: 20px;
      left: 300px;
      width: 100px;
      height: 30px;
      display: block;
    }
  </style>
  <a id="link" href="https://example.com/">a link</a>
`)}`;

/**
 * Synthesizes a primary-button drag gesture inside the content area,
 * starting at (x, y) and moving well past the drag threshold.
 */
async function synthesizeContentDrag(browser, x, y) {
  await BrowserTestUtils.synthesizeMouse(
    null,
    x,
    y,
    { type: "mousedown" },
    browser
  );
  for (let i = 1; i <= 3; i++) {
    await BrowserTestUtils.synthesizeMouse(
      null,
      x + i * 10,
      y + i * 5,
      { type: "mousemove", buttons: 1 },
      browser
    );
  }
  await BrowserTestUtils.synthesizeMouse(
    null,
    x + 40,
    y + 20,
    { type: "mouseup" },
    browser
  );
}

function getContentInnerHeight(browser) {
  return SpecialPowers.spawn(browser, [], () => content.innerHeight);
}
