/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// Verifies that activating a boost on a tab moves the painted colour of a
// plain CSS `background-color` block. Catches regressions where the per-color
// boost in StyleAbsoluteColor::ToColor or CalcColor is bypassed for
// backgrounds, and the gap that would surface if nsCSSRendering ever stopped
// passing the frame through GetVisitedDependentColor.
add_task(async function bg_color_is_tinted() {
  const html = `
    <style>
      html, body { margin: 0; padding: 0; }
      #bg { width: 200px; height: 200px; background-color: rgb(120, 120, 120); }
    </style>
    <div id="bg"></div>`;

  await BrowserTestUtils.withNewTab(dataUrl(html), async browser => {
    await waitForRepaint(browser);

    await setBoost(browser, { accent: 0 });
    const baseline = await pixelInElement(browser, "#bg");
    Assert.equal(baseline.r, 120, "baseline R is the literal background");
    Assert.equal(baseline.g, 120, "baseline G is the literal background");
    Assert.equal(baseline.b, 120, "baseline B is the literal background");

    await setBoost(browser, {
      accent: PAGE_ACCENT,
      complementaryRotation: PAGE_COMPLEMENTARY_ROTATION,
    });
    const boosted = await pixelInElement(browser, "#bg");

    Assert.ok(
      pixelsDiffer(baseline, boosted, 3),
      `boost should tint the background; got baseline=${JSON.stringify(
        baseline
      )} boosted=${JSON.stringify(boosted)}`
    );

    // Sanity: clear the boost and the painted colour returns home.
    await setBoost(browser, { accent: 0 });
    const cleared = await pixelInElement(browser, "#bg");
    Assert.ok(
      pixelsClose(cleared, baseline, 2),
      `clearing boost should restore original; got ${JSON.stringify(cleared)}`
    );
  });
});
