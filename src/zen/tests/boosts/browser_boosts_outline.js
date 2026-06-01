/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// CSS `outline` is painted by nsCSSRendering with its own color path. Pin
// that it gets the boost: a thick solid outline must tint when the page is
// boosted (just like a border does), and the sample point inside the outline
// band must move noticeably.
add_task(async function outline_color_is_tinted() {
  const html = `
    <style>
      html, body { margin: 0; padding: 0; background: white; }
      #o { width: 200px; height: 200px; margin: 60px;
           background: white;
           outline: 30px solid rgb(120, 120, 120);
           outline-offset: 0; }
    </style>
    <div id="o"></div>`;

  await BrowserTestUtils.withNewTab(dataUrl(html), async browser => {
    await waitForRepaint(browser);

    // Sample inside the outline band on the left side of the element.
    const point = await SpecialPowers.spawn(browser, [], () => {
      const r = content.document.querySelector("#o").getBoundingClientRect();
      return {
        x: Math.round(r.left - 15),
        y: Math.round(r.top + r.height / 2),
      };
    });

    await setBoost(browser, { accent: 0 });
    const baseline = await pixelAt(browser, point.x, point.y);
    Assert.ok(
      pixelsClose(baseline, { r: 120, g: 120, b: 120 }, 5),
      `baseline outline ≈ rgb(120,120,120); got ${JSON.stringify(baseline)}`
    );

    await setBoost(browser, {
      accent: PAGE_ACCENT,
      complementaryRotation: PAGE_COMPLEMENTARY_ROTATION,
    });
    const boosted = await pixelAt(browser, point.x, point.y);

    Assert.ok(
      pixelsDiffer(baseline, boosted, 3),
      `outline must tint; baseline=${JSON.stringify(
        baseline
      )} boosted=${JSON.stringify(boosted)}`
    );
  });
});
