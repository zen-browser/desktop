/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// Invert mode: white must come out dark, black must come out light. A double-
// invert regression (invert applied twice somewhere in the paint pipeline)
// looks like "white stays white" / "black stays black" — which is exactly
// what this test guards.
add_task(async function invert_flips_lightness() {
  const html = `
    <style>
      html, body { margin: 0; padding: 0; }
      .swatch { width: 200px; height: 200px; display: inline-block; }
      #white { background: white; }
      #black { background: black; }
    </style>
    <div id="white" class="swatch"></div>
    <div id="black" class="swatch"></div>`;

  await BrowserTestUtils.withNewTab(dataUrl(html), async browser => {
    await waitForRepaint(browser);

    await setBoost(browser, { accent: 0, inverted: false });
    const whiteOff = await pixelInElement(browser, "#white");
    const blackOff = await pixelInElement(browser, "#black");
    Assert.greater(pxLuma(whiteOff), 240, "baseline white is bright");
    Assert.less(pxLuma(blackOff), 16, "baseline black is dark");

    await setBoost(browser, { accent: 0, inverted: true });
    const whiteOn = await pixelInElement(browser, "#white");
    const blackOn = await pixelInElement(browser, "#black");

    Assert.less(
      pxLuma(whiteOn),
      pxLuma(whiteOff),
      "white must darken under invert; double-invert would leave it bright"
    );
    Assert.greater(
      pxLuma(blackOn),
      pxLuma(blackOff),
      "black must lighten under invert (and stay off pure black via the floor)"
    );
  });
});
