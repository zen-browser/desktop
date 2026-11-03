/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// Generated content (::before/::after) lives in a native-anonymous subtree,
// so IsBoostExemptFrame has historically over-exempted it. This test pins the
// fix: an inline-block ::before with a solid background-color must take the
// page's tint just like a regular element.
add_task(async function pseudo_before_is_boosted() {
  const html = `
    <style>
      html, body { margin: 0; padding: 0; background: white; }
      #host::before {
        content: "";
        display: inline-block;
        width: 200px;
        height: 200px;
        background-color: rgb(120, 120, 120);
      }
    </style>
    <div id="host"></div>`;

  await BrowserTestUtils.withNewTab(dataUrl(html), async browser => {
    await waitForRepaint(browser);

    // ::before sits inside the host: sample inside its area (start of host).
    const point = await SpecialPowers.spawn(browser, [], () => {
      const r = content.document.querySelector("#host").getBoundingClientRect();
      return {
        x: Math.round(r.left + 100),
        y: Math.round(r.top + 100),
      };
    });

    await setBoost(browser, { accent: 0 });
    const baseline = await pixelAt(browser, point.x, point.y);
    Assert.ok(
      pixelsClose(baseline, { r: 120, g: 120, b: 120 }, 4),
      `baseline ::before colour ≈ rgb(120,120,120); got ${JSON.stringify(
        baseline
      )}`
    );

    await setBoost(browser, {
      accent: PAGE_ACCENT,
      complementaryRotation: PAGE_COMPLEMENTARY_ROTATION,
    });
    const boosted = await pixelAt(browser, point.x, point.y);

    Assert.ok(
      pixelsDiffer(baseline, boosted, 3),
      `::before background must tint with the boost; baseline=${JSON.stringify(
        baseline
      )} boosted=${JSON.stringify(boosted)}`
    );
  });
});
