/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

"use strict";

/**
 * Bug 2019067: MousePosTracker translates mousemove screen coordinates into
 * chrome CSS pixels. When the source document - such as the docked devtools toolbox -
 * is at a different zoom (and thus a different devicePixelRatio) than chrome,
 * event.screenX/Y are in toolbox CSS pixels and must be rescaled to chrome
 * CSS pixels before mozInnerScreenX/Y is subtracted. Without rescaling,
 * any chrome-side hover listener (sidebar launcher, fullscreen autohide, etc.)
 * sees coordinates that don't match its own rects.
 */

Services.scriptloader.loadSubScript(
  "chrome://mochitests/content/browser/browser/components/extensions/test/browser/head_devtools.js",
  this
);

const TOOLBOX_ZOOM = 2.0;
const OFFSET_X = 30;
const OFFSET_Y = 30;

function makeListener(rect) {
  return {
    enterCount: 0,
    leaveCount: 0,
    getMouseTargetRect: () => rect,
    onMouseEnter() {
      this.enterCount++;
    },
    onMouseLeave() {
      this.leaveCount++;
    },
  };
}

add_task(async function test_mousepostracker_devtools_zoom_rescaling() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["devtools.toolbox.zoomValue", String(TOOLBOX_ZOOM)],
      ["devtools.toolbox.host", "bottom"],
    ],
  });

  await BrowserTestUtils.withNewTab("about:blank", async browser => {
    const tab = gBrowser.getTabForBrowser(browser);
    const toolbox = await openToolboxForTab(tab);
    const toolboxWin = toolbox.win;

    Assert.equal(
      toolboxWin.browsingContext.fullZoom,
      TOOLBOX_ZOOM,
      "Toolbox is at the configured zoom"
    );
    Assert.notEqual(
      toolboxWin.devicePixelRatio,
      window.devicePixelRatio,
      "Toolbox devicePixelRatio differs from chrome window"
    );

    // The chrome-CSS-pixel point of (OFFSET_X, OFFSET_Y) inside the toolbox
    // document is the toolbox browser's chrome-relative top-left plus the
    // offset scaled by toolbox-DPR / chrome-DPR.
    const devtoolsRect =
      toolboxWin.browsingContext.embedderElement.getBoundingClientRect();
    const scale = toolboxWin.devicePixelRatio / window.devicePixelRatio;
    const expectedX = devtoolsRect.left + OFFSET_X * scale;
    const expectedY = devtoolsRect.top + OFFSET_Y * scale;

    const insideListener = makeListener({
      left: expectedX - 5,
      right: expectedX + 5,
      top: expectedY - 5,
      bottom: expectedY + 5,
    });
    const outsideListener = makeListener({
      left: expectedX + 100,
      right: expectedX + 200,
      top: expectedY + 100,
      bottom: expectedY + 200,
    });

    const mouseMoved = BrowserTestUtils.waitForEvent(window, "mousemove");
    EventUtils.synthesizeMouse(
      toolboxWin.document.documentElement,
      OFFSET_X,
      OFFSET_Y,
      { type: "mousemove" },
      toolboxWin
    );
    await mouseMoved;

    // addListener immediately runs the rect-vs-position check. If
    // MousePosTracker rescaled the toolbox screenX/Y into chrome CSS pixels
    // correctly, _x/_y falls inside insideListener's rect (onMouseEnter
    // fires) and outside outsideListener's rect (onMouseEnter does not).
    MousePosTracker.addListener(insideListener);
    MousePosTracker.addListener(outsideListener);

    try {
      Assert.equal(
        insideListener.enterCount,
        1,
        "Listener with rect around the synthesized point received onMouseEnter"
      );
      Assert.equal(
        outsideListener.enterCount,
        0,
        "Listener with rect away from the synthesized point did not receive onMouseEnter"
      );
    } finally {
      MousePosTracker.removeListener(insideListener);
      MousePosTracker.removeListener(outsideListener);
    }

    await closeToolboxForTab(tab);
  });
});
