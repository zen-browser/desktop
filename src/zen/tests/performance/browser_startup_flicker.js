/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/*
 * This test ensures that there is no unexpected flicker
 * on the first window opened during startup.
 */

add_task(async function () {
  let startupRecorder =
    Cc["@mozilla.org/test/startuprecorder;1"].getService().wrappedJSObject;
  await startupRecorder.done;

  // Ensure all the frame data is in the test compartment to avoid traversing
  // a cross compartment wrapper for each pixel.
  let frames = Cu.cloneInto(startupRecorder.data.frames, {});
  ok(!!frames.length, "Should have captured some frames.");

  let unexpectedRects = 0;
  let alreadyFocused = false;
  let inRange = (val, min, max) => min <= val && val <= max;
  let tabBoundingRect = undefined;
  let urlbarBoundingRect = undefined;
  for (let i = 1; i < frames.length; ++i) {
    let frame = frames[i],
      previousFrame = frames[i - 1];
    let rects = compareFrames(frame, previousFrame);

    let expectedRects = [];
    let focusRects = [];

    rects = rects.filter(rect => {
      let width = frame.width;

      let exceptions = [
        /**
         * Please don't add anything new unless justified!
         */
        {
          name: "Shadow around active tab should not flicker on macOS (bug 1960967)",
          condition(r) {
            if (Services.prefs.getBoolPref("browser.nova.enabled", false)) {
              // The Nova redesign does not have a shadow around the active tab.
              return false;
            }
            const tabRect = tabBoundingRect
              ? tabBoundingRect
              : (tabBoundingRect = gBrowser.tabContainer
                  .querySelector("tab[selected] .tab-background")
                  .getBoundingClientRect());
            return (
              inRange(r.x1, tabRect.x - 2, tabRect.x + 2) &&
              inRange(r.y1, tabRect.y - 2, tabRect.y + 2) &&
              inRange(r.w, tabRect.width - 4, tabRect.width + 4) &&
              inRange(r.h, tabRect.height - 4, tabRect.height + 4)
            );
          },
        },
        {
          name: "Pixel snapping on urlbar bottom border on MacOS & Windows",
          condition(r) {
            if (!urlbarBoundingRect) {
              urlbarBoundingRect = document
                .getElementById("urlbar")
                .getBoundingClientRect();
            }
            return rectMatchesBottomBorder(r, urlbarBoundingRect);
          },
        },
        {
          // Pre-existing flicker exposed by porting the per-window idle tasks
          // to browser-window-idle-tasks (bug 2052772): the urlbar focus ring
          // settles once those idle tasks run, which now lands inside the
          // recorded window. TODO bug 2066735: remove once the flicker is fixed.
          name: "urlbar focus ring settles during startup idle tasks (bug 2066735)",
          condition(r) {
            if (!urlbarBoundingRect) {
              urlbarBoundingRect = document
                .getElementById("urlbar")
                .getBoundingClientRect();
            }
            // Match a change whose edges line up with the urlbar box. The focus
            // ring outline extends ~2px beyond the box, so allow a small
            // tolerance around each edge.
            let tolerance = 2;
            return (
              inRange(
                r.x1,
                urlbarBoundingRect.left - tolerance,
                urlbarBoundingRect.left + tolerance
              ) &&
              inRange(
                r.y1,
                urlbarBoundingRect.top - tolerance,
                urlbarBoundingRect.top + tolerance
              ) &&
              inRange(
                r.x2,
                urlbarBoundingRect.right - tolerance,
                urlbarBoundingRect.right + tolerance
              ) &&
              inRange(
                r.y2,
                urlbarBoundingRect.bottom - tolerance,
                urlbarBoundingRect.bottom + tolerance
              )
            );
          },
        },
      ];

      let rectText = `${rect.toSource()}, window width: ${width}`;
      for (let e of exceptions) {
        if (e.condition(rect)) {
          todo(false, e.name + ", " + rectText);
          expectedRects.push(rect);
          return false;
        }
      }

      if (!alreadyFocused) {
        focusRects.push(rect);
      }
      return true;
    });

    if (!alreadyFocused && isLikelyFocusChange(focusRects, frame)) {
      todo(
        false,
        "bug 1445161 - the window should be focused at first paint, " +
          focusRects.toSource()
      );
      continue;
    }
    alreadyFocused = true;

    if (!rects.length) {
      info("ignoring identical frame");
      continue;
    }

    for (let rect of rects) {
      let rectText = `${rect.toSource()}, window width: ${frame.width}`;
      ok(false, "unexpected changed rect: " + rectText);
    }

    await reportFlickerWithAPNG(previousFrame, frame, i, expectedRects);
    unexpectedRects += rects.length;
  }
  is(unexpectedRects, 0, "should have 0 unknown flickering areas");
});
