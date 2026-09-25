/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_dissolve_renders_and_can_be_reused() {
  await BrowserTestUtils.withNewTab(
    dataUrl(`<div id="target" style="position:fixed;left:20px;top:20px;
      width:64px;height:64px;background:red"></div>`),
    async browser => {
      await waitForRepaint(browser);
      await SpecialPowers.spawn(browser, [], async () => {
        const { ZapDissolve } = ChromeUtils.importESModule(
          "resource:///modules/zen/boosts/ZenZapDissolve.sys.mjs"
        );
        const effect = new ZapDissolve(content.document);
        await effect.initialize();
        try {
          const canvas = effect.getElementById("zen-zap-dissolve-canvas");
          const gl = canvas.getContext("webgl");
          Assert.ok(gl, "The dissolve effect has a WebGL context");
          const target = content.document.getElementById("target");

          for (let run = 0; run < 2; run++) {
            if (run === 1) {
              // Related selections can also match elements hidden by the site.
              target.style.display = "none";
              effect.dissolve(target, () => {});
              target.style.removeProperty("display");
            }
            let completed = false;
            effect.dissolve(target, () => {
              completed = true;
            });
            Assert.equal(
              gl.getError(),
              gl.NO_ERROR,
              `Dissolve ${run} starts without a WebGL error`
            );

            // Read in the first animation frame, before the drawing buffer clears.
            await new Promise(resolve =>
              content.requestAnimationFrame(resolve)
            );
            const pixels = new Uint8Array(64 * 64 * 4);
            gl.readPixels(
              20,
              canvas.height - 84,
              64,
              64,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              pixels
            );
            Assert.ok(
              pixels.some((value, index) => index % 4 === 3 && value > 0),
              `Dissolve ${run} paints visible particles`
            );
            await ContentTaskUtils.waitForCondition(
              () => completed,
              `Dissolve ${run} completes`
            );
          }
        } finally {
          effect.tearDown();
        }
      });
    }
  );
});
