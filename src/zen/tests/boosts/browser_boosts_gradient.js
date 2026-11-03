/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// CSS linear-gradient stops are resolved via the nsCSSGradientRenderer +
// ColorStopInterpolator path, which threads the frame down into
// gfxUtils::ToDeviceColor(StyleAbsoluteColor, frame). If that threading
// regresses, gradient stops paint without the boost while everything else
// around them gets tinted — a particularly visible regression.
add_task(async function linear_gradient_stops_are_boosted() {
  // Use a two-stop horizontal gradient so a sample near the left edge is
  // dominated by the first stop and a sample near the right edge by the
  // second. The element is sized 400×200 so we have generous sample regions.
  const html = `
    <style>
      html, body { margin: 0; padding: 0; background: white; }
      #g { width: 400px; height: 200px;
           background: linear-gradient(to right,
                                       rgb(180, 60, 60),
                                       rgb(60, 60, 180)); }
    </style>
    <div id="g"></div>`;

  await BrowserTestUtils.withNewTab(dataUrl(html), async browser => {
    await waitForRepaint(browser);

    // Sample 5% in (mostly first stop) and 95% in (mostly last stop).
    const points = await SpecialPowers.spawn(browser, [], () => {
      const r = content.document.querySelector("#g").getBoundingClientRect();
      return {
        left: {
          x: Math.round(r.left + r.width * 0.05),
          y: Math.round(r.top + r.height / 2),
        },
        right: {
          x: Math.round(r.left + r.width * 0.95),
          y: Math.round(r.top + r.height / 2),
        },
      };
    });

    await setBoost(browser, { accent: 0 });
    const leftBaseline = await pixelAt(browser, points.left.x, points.left.y);
    const rightBaseline = await pixelAt(
      browser,
      points.right.x,
      points.right.y
    );

    await setBoost(browser, {
      accent: PAGE_ACCENT,
      complementaryRotation: PAGE_COMPLEMENTARY_ROTATION,
    });
    const leftBoosted = await pixelAt(browser, points.left.x, points.left.y);
    const rightBoosted = await pixelAt(browser, points.right.x, points.right.y);

    Assert.ok(
      pixelsDiffer(leftBaseline, leftBoosted, 3),
      `left gradient stop must tint; baseline=${JSON.stringify(
        leftBaseline
      )} boosted=${JSON.stringify(leftBoosted)}`
    );
    Assert.ok(
      pixelsDiffer(rightBaseline, rightBoosted, 3),
      `right gradient stop must tint; baseline=${JSON.stringify(
        rightBaseline
      )} boosted=${JSON.stringify(rightBoosted)}`
    );

    // The two stops must remain distinguishable after boost — otherwise the
    // gradient has flattened, which would be a separate regression (e.g.,
    // ToDeviceColor losing per-stop frame context and collapsing to a single
    // tinted value).
    Assert.ok(
      pixelsDiffer(leftBoosted, rightBoosted, 8),
      `boosted gradient endpoints collapsed; left=${JSON.stringify(
        leftBoosted
      )} right=${JSON.stringify(rightBoosted)}`
    );
  });
});
