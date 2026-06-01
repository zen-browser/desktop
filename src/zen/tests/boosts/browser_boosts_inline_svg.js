/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// The "twice" diagnostic: paint an inline SVG fill and a CSS background-color
// with the *same* source colour, side by side. Under boost they must end up
// painted with the same boosted colour. If the SVG sample comes out
// noticeably more saturated / further from the baseline than the CSS one, the
// SVG paint path is applying the boost twice (the symptom you reported).
add_task(async function inline_svg_fill_matches_css_bg_under_boost() {
  const html = `
    <style>
      html, body { margin: 0; padding: 0; background: white; }
      #div, #svg { width: 200px; height: 200px; display: inline-block;
                   vertical-align: top; }
      #div { background-color: rgb(51, 54, 57); }
    </style>
    <div id="div"></div>
    <svg id="svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="rgb(51, 54, 57)"/>
    </svg>`;

  await BrowserTestUtils.withNewTab(dataUrl(html), async browser => {
    await waitForRepaint(browser);

    await setBoost(browser, { accent: 0 });
    const divBaseline = await pixelInElement(browser, "#div");
    const svgBaseline = await pixelInElement(browser, "#svg");
    // Sanity: both paint the same source colour before any boost.
    Assert.ok(
      pixelsClose(divBaseline, svgBaseline, 2),
      `pre-boost div/svg should already match; div=${JSON.stringify(
        divBaseline
      )} svg=${JSON.stringify(svgBaseline)}`
    );

    await setBoost(browser, {
      accent: PAGE_ACCENT,
      complementaryRotation: PAGE_COMPLEMENTARY_ROTATION,
    });
    const divBoosted = await pixelInElement(browser, "#div");
    const svgBoosted = await pixelInElement(browser, "#svg");

    Assert.ok(
      pixelsDiffer(divBaseline, divBoosted, 3),
      "div background must be tinted under boost (sanity)"
    );
    Assert.ok(
      pixelsDiffer(svgBaseline, svgBoosted, 3),
      "SVG fill must be tinted under boost (sanity)"
    );

    // Headline assertion: the SVG fill and the CSS background, both starting
    // from rgb(51, 54, 57) on the same page, must land at the same colour
    // after the boost. A larger gap is the "filtered twice" symptom.
    Assert.ok(
      pixelsClose(divBoosted, svgBoosted, 4),
      `SVG fill drifted from CSS background under boost — likely double-` +
        `applied boost on the SVG path. div=${JSON.stringify(
          divBoosted
        )} svg=${JSON.stringify(svgBoosted)}`
    );
  });
});

// Same comparison but with `fill="currentColor"` — your reported case. The SVG
// inherits `color` and resolves it via the path frame; the CSS swatch resolves
// via its own frame. Both must land in the same place after one boost pass.
add_task(async function inline_svg_currentcolor_matches_css_under_boost() {
  const html = `
    <style>
      html, body { margin: 0; padding: 0; background: white; }
      .row { color: rgb(51, 54, 57); }
      #div, #svg { width: 200px; height: 200px; display: inline-block;
                   vertical-align: top; }
      #div { background-color: currentColor; }
    </style>
    <div class="row">
      <div id="div"></div>
      <svg id="svg" width="200" height="200" viewBox="0 0 200 200"
           fill="currentColor">
        <rect width="200" height="200"/>
      </svg>
    </div>`;

  await BrowserTestUtils.withNewTab(dataUrl(html), async browser => {
    await waitForRepaint(browser);

    await setBoost(browser, {
      accent: PAGE_ACCENT,
      complementaryRotation: PAGE_COMPLEMENTARY_ROTATION,
    });
    const divBoosted = await pixelInElement(browser, "#div");
    const svgBoosted = await pixelInElement(browser, "#svg");

    Assert.ok(
      pixelsClose(divBoosted, svgBoosted, 4),
      `SVG currentColor fill must match the same-colour CSS swatch after ` +
        `boost. div=${JSON.stringify(divBoosted)} svg=${JSON.stringify(
          svgBoosted
        )}`
    );
  });
});
