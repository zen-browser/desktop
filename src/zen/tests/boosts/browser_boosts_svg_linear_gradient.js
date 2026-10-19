/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// SVG paint-server gradients (<linearGradient>) go through SVGGradientFrame
// which threads the host frame into ToDeviceColor for each stop. Coverage
// here pins that threading: a paint-server gradient must tint stops the same
// way a CSS gradient does.
add_task(async function svg_linear_gradient_stops_are_boosted() {
  const html = `
    <style>
      html, body { margin: 0; padding: 0; background: white; }
    </style>
    <svg id="g" width="400" height="200" viewBox="0 0 400 200">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgb(180, 60, 60)"/>
          <stop offset="100%" stop-color="rgb(60, 60, 180)"/>
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill="url(#grad)"/>
    </svg>`;

  await BrowserTestUtils.withNewTab(dataUrl(html), async browser => {
    await waitForRepaint(browser);

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
      "SVG <linearGradient> first stop must tint"
    );
    Assert.ok(
      pixelsDiffer(rightBaseline, rightBoosted, 3),
      "SVG <linearGradient> last stop must tint"
    );
    Assert.ok(
      pixelsDiffer(leftBoosted, rightBoosted, 8),
      "SVG <linearGradient> stops must stay distinguishable after boost"
    );
  });
});
