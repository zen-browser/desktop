/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Theme_Picker_Visualization_Mode() {
  const originalDots = gZenThemePicker.dots;
  const gradient = document.querySelector(".zen-theme-picker-gradient");

  registerCleanupFunction(() => {
    gZenThemePicker.dots = originalDots;
    gZenThemePicker.updateThemePickerVisualization();
  });

  gZenThemePicker.dots = [];
  gZenThemePicker.updateThemePickerVisualization();
  Assert.equal(
    gradient.getAttribute("data-color-mode"),
    "lightness",
    "A picker without generated colors resets to the default visualization"
  );

  const testCases = [
    { type: undefined, lightness: 50, expectedMode: "lightness" },
    {
      type: "explicit-lightness",
      lightness: 70,
      expectedMode: "saturation",
    },
    {
      type: "explicit-black-white",
      lightness: 30,
      expectedMode: "grayscale",
    },
  ];

  for (const { type, lightness, expectedMode } of testCases) {
    gZenThemePicker.dots = [{ ID: 0, type, lightness }];
    gZenThemePicker.updateThemePickerVisualization();

    Assert.equal(
      gradient.getAttribute("data-color-mode"),
      expectedMode,
      `The ${type ?? "default"} picker uses the expected visualization`
    );
    Assert.equal(
      gradient.style.getPropertyValue("--zen-theme-picker-lightness"),
      `${lightness}%`,
      "The visualization reflects the primary color lightness"
    );
  }
});
