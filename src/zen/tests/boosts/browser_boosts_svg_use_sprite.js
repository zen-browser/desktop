/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// Inline <use href="#symbol"> clones the symbol's content into a shadow tree.
// The clone is native-anonymous, so IsBoostExemptFrame must NOT exempt it
// (that's what the GetContainingShadow carve-out is for). Compare against a
// direct inline rect with the same fill — both must land at the same boosted
// colour, demonstrating the use-clone isn't being skipped.
add_task(async function svg_use_clone_is_boosted_like_direct_inline() {
  const html = `
    <style>
      html, body { margin: 0; padding: 0; background: white; }
      .swatch { width: 200px; height: 200px; display: inline-block;
                vertical-align: top; }
    </style>
    <svg width="0" height="0" style="position:absolute">
      <symbol id="sym" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="rgb(120, 120, 120)"/>
      </symbol>
    </svg>
    <svg id="direct" class="swatch" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="rgb(120, 120, 120)"/>
    </svg>
    <svg id="used" class="swatch" viewBox="0 0 200 200">
      <use href="#sym"/>
    </svg>`;

  await BrowserTestUtils.withNewTab(dataUrl(html), async browser => {
    await waitForRepaint(browser);

    await setBoost(browser, { accent: 0 });
    const directBaseline = await pixelInElement(browser, "#direct");
    const usedBaseline = await pixelInElement(browser, "#used");
    Assert.ok(
      pixelsClose(directBaseline, usedBaseline, 3),
      `baseline mismatch between direct and used; direct=${JSON.stringify(
        directBaseline
      )} used=${JSON.stringify(usedBaseline)}`
    );

    await setBoost(browser, {
      accent: PAGE_ACCENT,
      complementaryRotation: PAGE_COMPLEMENTARY_ROTATION,
    });
    const directBoosted = await pixelInElement(browser, "#direct");
    const usedBoosted = await pixelInElement(browser, "#used");

    Assert.ok(
      pixelsDiffer(usedBaseline, usedBoosted, 3),
      "<use>-cloned content must tint under boost (use-shadow not exempt)"
    );
    Assert.ok(
      pixelsClose(directBoosted, usedBoosted, 4),
      `<use> clone must match direct inline rect after boost. direct=` +
        `${JSON.stringify(directBoosted)} used=${JSON.stringify(usedBoosted)}`
    );
  });
});
