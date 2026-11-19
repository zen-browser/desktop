/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function gradientTheme(algorithm, lightness) {
  return {
    type: "gradient",
    gradientColors: [
      {
        c: [120, 40, 200],
        isCustom: false,
        algorithm,
        isPrimary: true,
        lightness,
        position: { x: 10, y: 10 },
        type: "primary",
      },
    ],
    opacity: 0.5,
    texture: 0,
  };
}

add_task(async function test_RenderingAnotherSpaceKeepsTheAlgorithm() {
  await gZenWorkspaces.promiseInitialized;
  const picker = gZenThemePicker;
  const other = {
    uuid: "test-theme-algorithm-other",
    theme: gradientTheme("complementary", 40),
  };

  picker.useAlgo = "analogous";
  picker.invalidateGradientCache(other.uuid);
  const rendered = picker.getGradientForWorkspace(other);

  Assert.ok(rendered.gradient, "The other space's gradient should be built");
  Assert.equal(
    picker.useAlgo,
    "analogous",
    "Rendering another space should leave the edited algorithm alone"
  );

  picker.invalidateGradientCache(other.uuid);
});
