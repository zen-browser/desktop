/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// Verifies that text colour is tinted under a boost. Uses a large solid-colour
// glyph and samples at its geometric centre, where the rendered pixel is fully
// the foreground colour (no anti-aliased blend with the background).
add_task(async function text_color_is_tinted() {
  const html = `
    <style>
      html, body { margin: 0; padding: 0; background: white; }
      #t { color: rgb(40, 44, 52); font: 200px/1 system-ui, sans-serif;
           display: inline-block; padding: 0 20px; }
    </style>
    <span id="t">█</span>`;
  // Full-block U+2588 fills its glyph cell with the foreground colour, so the
  // centre pixel is a clean sample of the painted text colour.

  await BrowserTestUtils.withNewTab(dataUrl(html), async browser => {
    await waitForRepaint(browser);

    await setBoost(browser, { accent: 0 });
    const baseline = await pixelInElement(browser, "#t");

    await setBoost(browser, {
      accent: PAGE_ACCENT,
      complementaryRotation: PAGE_COMPLEMENTARY_ROTATION,
    });
    const boosted = await pixelInElement(browser, "#t");

    Assert.ok(
      pixelsDiffer(baseline, boosted, 3),
      `text colour should be tinted; baseline=${JSON.stringify(baseline)} ` +
        `boosted=${JSON.stringify(boosted)}`
    );

    // The text was clearly darker than white before the boost, and the boost
    // preserves perceived luminance roughly, so it must stay darker than its
    // (white) background afterwards. A broken filter that inverts the
    // luminance direction would flip this.
    const bg = await pixelAt(browser, 5, 5);
    Assert.greater(
      pxLuma(bg),
      pxLuma(boosted),
      "boosted text must remain darker than its boosted white background"
    );
  });
});
