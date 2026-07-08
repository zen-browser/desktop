/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// `::placeholder` is an element-backed pseudo inside a text-control's UA
// widget shadow tree. The boost-exemption logic must un-exempt it the same
// way it does the editor's typed text. Use a solid-block character as the
// placeholder so we get a clean foreground sample.
add_task(async function placeholder_is_boosted() {
  const html = `
    <style>
      html, body { margin: 0; padding: 0; background: white; }
      input {
        appearance: none;
        background: white;
        color: rgb(40, 44, 52);
        font: 200px/1 system-ui, sans-serif;
        border: none;
        padding: 0 20px;
        width: 600px;
        height: 260px;
      }
      input::placeholder { color: rgb(40, 44, 52); opacity: 1; }
    </style>
    <input id="i" placeholder="█">`;

  await BrowserTestUtils.withNewTab(dataUrl(html), async browser => {
    await waitForRepaint(browser);

    const point = await SpecialPowers.spawn(browser, [], () => {
      const r = content.document.querySelector("#i").getBoundingClientRect();
      // The placeholder block sits near the left of the input.
      return {
        x: Math.round(r.left + 120),
        y: Math.round(r.top + 130),
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
      `::placeholder must tint with boost; baseline=${JSON.stringify(
        baseline
      )} boosted=${JSON.stringify(boosted)}`
    );
  });
});
