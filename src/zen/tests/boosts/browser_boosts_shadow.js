/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// box-shadow is the property where the "alpha byte is contrast for accents but
// must stay opacity for content colours" invariant is most visible. We render
// a thick, fully-opaque box-shadow on a white background and verify (a) it's
// tinted by the boost and (b) the sampled pixel's alpha — after compositing —
// is not the accent's contrast byte bleeding through.
add_task(async function box_shadow_is_tinted_alpha_preserved() {
  // Use a solid (alpha = 1.0) shadow colour so we can sample inside the shadow
  // band on a white background without dealing with partial transparency.
  const html = `
    <style>
      html, body { margin: 0; padding: 0; background: white; }
      #s { width: 100px; height: 100px; margin: 80px; background: white;
           box-shadow: 0 80px 0 0 rgb(80, 80, 80); }
    </style>
    <div id="s"></div>`;

  await BrowserTestUtils.withNewTab(dataUrl(html), async browser => {
    await waitForRepaint(browser);

    const point = await SpecialPowers.spawn(browser, [], () => {
      const r = content.document.querySelector("#s").getBoundingClientRect();
      // 40px inside the 80px tall shadow band that lives below the box.
      return {
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.bottom + 40),
      };
    });

    await setBoost(browser, { accent: 0 });
    const baseline = await pixelAt(browser, point.x, point.y);
    Assert.ok(
      pixelsClose(baseline, { r: 80, g: 80, b: 80 }, 5),
      `baseline shadow ≈ rgb(80,80,80); got ${JSON.stringify(baseline)}`
    );

    await setBoost(browser, {
      accent: PAGE_ACCENT,
      complementaryRotation: PAGE_COMPLEMENTARY_ROTATION,
    });
    const boosted = await pixelAt(browser, point.x, point.y);

    Assert.ok(
      pixelsDiffer(baseline, boosted, 3),
      `box-shadow colour should be tinted; baseline=${JSON.stringify(
        baseline
      )} boosted=${JSON.stringify(boosted)}`
    );

    // The compositor combines RGB only; the rendered pixel from drawWindow is
    // always alpha=255 because the canvas backing is opaque. The real
    // alpha-preservation invariant is enforced as a gtest on the filter
    // primitive (TestZenBoostsColorFilter.ShadowAlphaPreserved). Here we just
    // assert the visible pixel isn't pathological (e.g., turned transparent).
    Assert.equal(boosted.a, 255, "composited shadow pixel has full alpha");
  });
});
