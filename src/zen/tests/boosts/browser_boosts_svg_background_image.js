/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// `background-image: url(*.svg)` goes through nsImageRenderer's WebRender
// blob path, which is a separate code path from the <img> case. Verify that
// path also has the boost propagated: a div whose background is an SVG image
// must tint just like a div with a CSS background-color of the same value.
add_task(async function svg_background_image_is_boosted() {
  const svgSrc = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">` +
      `<rect width="200" height="200" fill="rgb(120, 120, 120)"/>` +
      `</svg>`
  );
  const html = `
    <style>
      html, body { margin: 0; padding: 0; background: white; }
      #css, #bg { width: 200px; height: 200px; display: inline-block;
                  vertical-align: top; }
      #css { background-color: rgb(120, 120, 120); }
      #bg { background-image: url('data:image/svg+xml;charset=utf-8,${svgSrc}');
            background-size: 200px 200px; background-repeat: no-repeat; }
    </style>
    <div id="css"></div>
    <div id="bg"></div>`;

  await BrowserTestUtils.withNewTab(dataUrl(html), async browser => {
    await waitForRepaint(browser);
    for (let i = 0; i < 4; i++) {
      await waitForRepaint(browser);
    }

    await setBoost(browser, { accent: 0 });
    const cssBaseline = await pixelInElement(browser, "#css");
    const bgBaseline = await pixelInElement(browser, "#bg");
    Assert.ok(
      pixelsClose(cssBaseline, bgBaseline, 3),
      `baseline mismatch: css=${JSON.stringify(
        cssBaseline
      )} bg-image=${JSON.stringify(bgBaseline)}`
    );

    await setBoost(browser, {
      accent: PAGE_ACCENT,
      complementaryRotation: PAGE_COMPLEMENTARY_ROTATION,
    });
    const cssBoosted = await pixelInElement(browser, "#css");
    const bgBoosted = await pixelInElement(browser, "#bg");

    Assert.ok(
      pixelsDiffer(bgBaseline, bgBoosted, 3),
      "background-image SVG must tint under boost"
    );
    Assert.ok(
      pixelsClose(cssBoosted, bgBoosted, 4),
      `SVG background-image must match CSS background-color after boost. ` +
        `css=${JSON.stringify(cssBoosted)} bg=${JSON.stringify(bgBoosted)}`
    );
  });
});
