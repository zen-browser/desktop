/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// The compositor animation path in AnimationInfo.cpp resolves a colour with
// the host frame, then either takes it as-is (currentColor keyframe) or
// passes it through ResolveStyleColor (absolute keyframe). Both paths must
// end up at the same boosted colour as the static equivalent. We pin a
// background-color animation at 50% via animation-delay and compare against
// a static element that holds the interpolated colour.
add_task(async function animated_background_is_boosted() {
  // Paused-at-50% animation between #000 and #fff → mid grey at the sampled
  // time. We compare against a static rgb(128,128,128) swatch and require
  // both to land at the same colour after boost.
  const html = `
    <style>
      html, body { margin: 0; padding: 0; background: white; }
      .swatch { width: 200px; height: 200px; display: inline-block;
                vertical-align: top; }
      #static { background-color: rgb(128, 128, 128); }
      @keyframes fade { from { background-color: black; } to { background-color: white; } }
      #animated {
        background-color: black;
        animation: fade 4s linear infinite;
        animation-delay: -2s;
        animation-play-state: paused;
      }
    </style>
    <div id="static" class="swatch"></div>
    <div id="animated" class="swatch"></div>`;

  await BrowserTestUtils.withNewTab(dataUrl(html), async browser => {
    await waitForRepaint(browser);

    await setBoost(browser, {
      accent: PAGE_ACCENT,
      complementaryRotation: PAGE_COMPLEMENTARY_ROTATION,
    });
    const staticBoosted = await pixelInElement(browser, "#static");
    const animBoosted = await pixelInElement(browser, "#animated");

    Assert.ok(
      pixelsClose(staticBoosted, animBoosted, 6),
      `animated and static mid-grey must land at the same boosted colour; ` +
        `static=${JSON.stringify(staticBoosted)} animated=${JSON.stringify(
          animBoosted
        )}`
    );
  });
});
