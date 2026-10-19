/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { SelectorComponent } = ChromeUtils.importESModule(
  "resource:///modules/zen/boosts/ZenSelectorComponent.sys.mjs"
);

// --- Boost pixel-level test helpers --------------------------------------
//
// Used by browser_boosts_*.js. Each helper documents what regression in the
// boost paint paths it's meant to catch.

// Construct an nscolor in Firefox's ABGR encoding from RGB + the alpha byte.
// The boost backend reuses the alpha byte as the accent's contrast/strength
// (see NS_GET_CONTRAST in nsZenBoostsBackend.cpp), so for boost activation
// use `contrast` as the fourth arg with a typical value of 200.
function nsRGBA(r, g, b, a = 255) {
  return (((a >>> 0) << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

// Two animation frames is enough for a BC-field-triggered restyle + repaint
// to settle in our tests; the DidSet handlers in nsZenBCOverrides.cpp
// dispatch a RecascadeSubtree + visual hint that's processed by the next
// refresh tick.
async function waitForRepaint(browser) {
  await SpecialPowers.spawn(browser, [], async () => {
    await new Promise(r => content.requestAnimationFrame(r));
    await new Promise(r => content.requestAnimationFrame(r));
  });
}

// Apply (or clear) a boost on the tab's top-level content BrowsingContext.
// Passing accent = 0 clears the boost so a test can sample a no-boost
// baseline and a boosted state on the same loaded page.
async function setBoost(
  browser,
  { accent = 0, complementaryRotation = 0, inverted = false } = {}
) {
  const bc = browser.browsingContext;
  bc.zenBoostsData = accent;
  bc.zenBoostsComplementaryRotation = complementaryRotation;
  bc.isZenBoostsInverted = inverted;
  await waitForRepaint(browser);
}

// Read the RGBA pixel at content coordinates (x, y). Runs in the content
// process so drawWindow targets the real painted output of the tab.
async function pixelAt(browser, x, y) {
  return SpecialPowers.spawn(browser, [x, y], async (px, py) => {
    const w = content.innerWidth;
    const h = content.innerHeight;
    const canvas = content.document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "canvas"
    );
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawWindow(content, 0, 0, w, h, "rgba(0,0,0,0)");
    const data = ctx.getImageData(px, py, 1, 1).data;
    return { r: data[0], g: data[1], b: data[2], a: data[3] };
  });
}

// Sample the centre of the element matching |selector|.
async function pixelInElement(browser, selector) {
  const point = await SpecialPowers.spawn(browser, [selector], sel => {
    const el = content.document.querySelector(sel);
    if (!el) {
      throw new Error(`No element matches selector: ${sel}`);
    }
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2),
    };
  });
  return pixelAt(browser, point.x, point.y);
}

// Coarse RGB-distance threshold for "the colour clearly changed". The boost's
// duotone moves channels by tens of units even for a modest accent; tolerance
// 3 is comfortably below that while ignoring sub-pixel/anti-aliasing noise.
function pixelsDiffer(a, b, tol = 3) {
  return (
    Math.abs(a.r - b.r) > tol ||
    Math.abs(a.g - b.g) > tol ||
    Math.abs(a.b - b.b) > tol
  );
}

function pixelsClose(a, b, tol = 3) {
  return !pixelsDiffer(a, b, tol);
}

// BT.601-ish perceived luminance, integer-valued. Matches the coefficients
// used by InvertColorChannel in the backend, so a test expressing "X stays
// darker than Y after boost" maps to what the user actually perceives.
function pxLuma({ r, g, b }) {
  return (r * 54 + g * 183 + b * 19) >> 8;
}

function dataUrl(html) {
  return "data:text/html;charset=utf-8," + encodeURIComponent(html);
}

// A "page accent" colour used across the property tests. Strong enough to
// move a mid-grey by tens of units per channel; rotation kept small so the
// duotone stays cohesive.
const PAGE_ACCENT = nsRGBA(80, 120, 200, /*contrast*/ 200);
const PAGE_COMPLEMENTARY_ROTATION = 30;
