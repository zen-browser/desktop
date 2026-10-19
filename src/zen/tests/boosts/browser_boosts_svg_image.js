/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// SVG used as an image (<img src=*.svg>) renders inside its own image document
// with no BrowsingContext, so the boost must be propagated through the
// SVGImageContext + AutoRestoreSVGState plumbing onto the image document's
// PresContext. Compare the painted colour of an <img>-rendered SVG to an
// inline <svg> with the same fill — both should land at the same boosted
// colour after one pass.
add_task(async function svg_as_img_matches_inline_under_boost() {
  const svgSrc = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">` +
      `<rect width="200" height="200" fill="rgb(120, 120, 120)"/>` +
      `</svg>`
  );
  const html = `
    <style>
      html, body { margin: 0; padding: 0; background: white; }
      #img, #inline { width: 200px; height: 200px; display: inline-block;
                     vertical-align: top; }
    </style>
    <img id="img" src="data:image/svg+xml;charset=utf-8,${svgSrc}">
    <svg id="inline" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="rgb(120, 120, 120)"/>
    </svg>`;

  await BrowserTestUtils.withNewTab(dataUrl(html), async browser => {
    await waitForRepaint(browser);
    // SVG images are loaded async; give the <img> a few frames to paint.
    for (let i = 0; i < 4; i++) {
      await waitForRepaint(browser);
    }

    await setBoost(browser, { accent: 0 });
    const imgBaseline = await pixelInElement(browser, "#img");
    const inlineBaseline = await pixelInElement(browser, "#inline");
    Assert.ok(
      pixelsClose(imgBaseline, inlineBaseline, 3),
      `baseline mismatch between <img>-svg and inline svg: img=` +
        `${JSON.stringify(imgBaseline)} inline=${JSON.stringify(inlineBaseline)}`
    );

    await setBoost(browser, {
      accent: PAGE_ACCENT,
      complementaryRotation: PAGE_COMPLEMENTARY_ROTATION,
    });
    const imgBoosted = await pixelInElement(browser, "#img");
    const inlineBoosted = await pixelInElement(browser, "#inline");

    Assert.ok(
      pixelsDiffer(imgBaseline, imgBoosted, 3),
      "<img>-rendered SVG must tint under boost"
    );
    Assert.ok(
      pixelsClose(imgBoosted, inlineBoosted, 4),
      `<img>-rendered SVG must match inline SVG after boost. img=` +
        `${JSON.stringify(imgBoosted)} inline=${JSON.stringify(inlineBoosted)}`
    );
  });
});
