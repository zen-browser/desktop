/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// The editor content of <input> / <textarea> sits in a UA-widget shadow tree;
// the boost-exemption logic must treat it as author content. To get a clean
// sample we use textarea (more text area, no themed background overdraw on
// the sample point) with an explicit colour so we know the baseline.
add_task(async function input_text_is_boosted() {
  const html = `
    <style>
      html, body { margin: 0; padding: 0; background: white; }
      textarea {
        appearance: none;          /* avoid theme repainting over our sample */
        background: white;
        color: rgb(40, 44, 52);
        font: 200px/1 system-ui, sans-serif;
        border: none;
        padding: 0 20px;
        width: 600px;
        height: 240px;
      }
    </style>
    <textarea id="t">█</textarea>`;
  // Full-block U+2588 again — the centre pixel is the solid foreground colour.

  await BrowserTestUtils.withNewTab(dataUrl(html), async browser => {
    await waitForRepaint(browser);

    // The block character sits near the start of the textarea content box.
    const point = await SpecialPowers.spawn(browser, [], () => {
      const r = content.document.querySelector("#t").getBoundingClientRect();
      // Estimate the block's centre: x ≈ left padding + half a glyph width;
      // y ≈ vertical centre of the line box.
      return {
        x: Math.round(r.left + 120),
        y: Math.round(r.top + 120),
      };
    });

    await setBoost(browser, { accent: 0 });
    const baseline = await pixelAt(browser, point.x, point.y);

    await setBoost(browser, {
      accent: PAGE_ACCENT,
      complementaryRotation: PAGE_COMPLEMENTARY_ROTATION,
    });
    const boosted = await pixelAt(browser, point.x, point.y);

    Assert.ok(
      pixelsDiffer(baseline, boosted, 3),
      `editor text must tint with boost; baseline=${JSON.stringify(
        baseline
      )} boosted=${JSON.stringify(boosted)}`
    );
  });
});
