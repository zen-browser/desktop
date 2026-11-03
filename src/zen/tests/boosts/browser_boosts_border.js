/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// Borders go through nsCSSRendering::ComputeBorderColors → CalcColor with the
// frame, so the boost should reach them. Use a thick solid border and sample
// inside the border band (which is fully the border colour) rather than the
// element interior.
add_task(async function border_color_is_tinted() {
  const html = `
    <style>
      html, body { margin: 0; padding: 0; background: white; }
      #b { width: 200px; height: 200px; margin: 50px;
           background: white;
           border: 30px solid rgb(120, 120, 120); }
    </style>
    <div id="b"></div>`;

  await BrowserTestUtils.withNewTab(dataUrl(html), async browser => {
    await waitForRepaint(browser);

    // Sample a point inside the top border band: x = centre of element, y just
    // below the top edge (well inside the 30px-wide border).
    const point = await SpecialPowers.spawn(browser, [], () => {
      const r = content.document.querySelector("#b").getBoundingClientRect();
      return {
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + 15),
      };
    });

    await setBoost(browser, { accent: 0 });
    const baseline = await pixelAt(browser, point.x, point.y);
    Assert.ok(
      pixelsClose(baseline, { r: 120, g: 120, b: 120 }, 5),
      `baseline border colour ≈ rgb(120,120,120); got ${JSON.stringify(baseline)}`
    );

    await setBoost(browser, {
      accent: PAGE_ACCENT,
      complementaryRotation: PAGE_COMPLEMENTARY_ROTATION,
    });
    const boosted = await pixelAt(browser, point.x, point.y);

    Assert.ok(
      pixelsDiffer(baseline, boosted, 3),
      `border colour should be tinted; baseline=${JSON.stringify(baseline)} ` +
        `boosted=${JSON.stringify(boosted)}`
    );
  });
});
