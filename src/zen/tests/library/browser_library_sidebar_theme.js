/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_space_preview_uses_sidebar_background() {
  await gZenWorkspaces.promiseInitialized;
  await gZenThemePicker.promiseInitialized;

  const Library = customElements.get("zen-library");
  const library = document.querySelector("zen-library");
  const workspace = gZenWorkspaces.getActiveWorkspace();
  const originalTheme = structuredClone(workspace.theme);
  const originalCompact = gZenCompactModeManager.preference;
  const originalSection = library.activeTab;
  const originalOpen = Library.isLibraryOpen;
  const noAcrylic = document.documentElement.getAttribute("zen-no-acrylic");

  registerCleanupFunction(async () => {
    if (Library.isLibraryOpen) {
      Library.toggle();
    }
    await TestUtils.waitForCondition(() => !Library.isLibrarySlightlyOpen);
    workspace.theme = originalTheme;
    gZenThemePicker.onWorkspaceChange(workspace);
    library.activeTab = originalSection;
    gZenCompactModeManager.preference = originalCompact;
    await TestUtils.waitForCondition(
      () => !document.documentElement.hasAttribute("zen-compact-animating")
    );
    if (originalOpen) {
      Library.toggle();
    }
    if (noAcrylic === null) {
      document.documentElement.removeAttribute("zen-no-acrylic");
    } else {
      document.documentElement.setAttribute("zen-no-acrylic", noAcrylic);
    }
  });

  await SpecialPowers.pushPrefEnv({
    set: [["zen.view.window.scheme", 1]],
  });
  if (Library.isLibraryOpen) {
    Library.toggle();
  }
  await TestUtils.waitForCondition(() => !Library.isLibrarySlightlyOpen);
  gZenCompactModeManager.preference = true;
  await TestUtils.waitForCondition(
    () => !document.documentElement.hasAttribute("zen-compact-animating"),
    "compact mode finishes animating"
  );

  // Exercise the acrylic CSS even on software-rendered test workers. This test
  // compares styles, rather than relying on hardware backdrop rendering.
  document.documentElement.removeAttribute("zen-no-acrylic");
  Services.focus.activeWindow = window;

  workspace.theme = {
    type: "gradient",
    gradientColors: [
      {
        c: [158, 219, 204],
        isPrimary: true,
        algorithm: "float",
        lightness: 75,
        type: "primary",
      },
    ],
    opacity: 0.5,
    texture: 0.25,
  };
  gZenThemePicker.onWorkspaceChange(workspace);

  if (Library.isLibraryOpen) {
    library.activeTab = "spaces";
  } else {
    Library.toggle("spaces");
  }
  await TestUtils.waitForCondition(
    () => document.querySelector("zen-library-spaces-section"),
    "the Spaces preview is mounted"
  );
  const section = document.querySelector("zen-library-spaces-section");
  await section.updateComplete;
  const card = section.querySelector(`[data-uuid="${workspace.uuid}"]`);
  const preview = card.querySelector(".zen-library-space-background");
  const sidebar = document.getElementById("zen-toolbar-background");
  ok(preview, "The space preview uses the shared background component");

  const coloredTheme = structuredClone(workspace.theme);
  // Default themes follow the window; explicit workspace themes can override it.
  for (const [scheme, acrylic, color] of [
    [1, true, null],
    [1, false, null],
    [0, true, null],
    [0, false, null],
    [1, true, [30, 30, 30]],
    [0, true, [235, 235, 235]],
    [1, true, [158, 219, 204]],
    [0, true, [158, 219, 204]],
  ]) {
    await SpecialPowers.pushPrefEnv({
      set: [
        ["zen.theme.acrylic-sidebar", acrylic],
        ["zen.view.window.scheme", scheme],
        ["zen.theme.gradient-legacy-version", 1],
      ],
    });
    workspace.theme = structuredClone(coloredTheme);
    workspace.theme.gradientColors = color
      ? [{ ...workspace.theme.gradientColors[0], c: color }]
      : [];
    gZenThemePicker.onWorkspaceChange(workspace);
    await section.updateComplete;
    await new Promise(resolve => requestAnimationFrame(resolve));
    for (const pseudo of [null, "::after"]) {
      const previewStyle = getComputedStyle(preview, pseudo);
      const sidebarStyle = getComputedStyle(sidebar, pseudo);
      for (const property of ["background", "backdrop-filter"]) {
        is(
          previewStyle.getPropertyValue(property),
          sidebarStyle.getPropertyValue(property),
          `${property} matches with scheme ${scheme}, acrylic ${acrylic} (${pseudo})`
        );
      }
    }
    is(
      getComputedStyle(preview.querySelector(".zen-browser-grain")).opacity,
      getComputedStyle(sidebar.querySelector(".zen-browser-grain")).opacity,
      "The preview uses the sidebar's grain opacity"
    );
    if (!matchMedia("(prefers-reduced-transparency: reduce)").matches) {
      is(
        getComputedStyle(preview).backdropFilter,
        acrylic ? "blur(42px)" : "none",
        "Acrylic preserves blur without changing brightness or saturation"
      );
      const { isDarkMode } = gZenThemePicker.getGradientForWorkspace(workspace);
      const rgb = isDarkMode ? "19, 19, 19" : "233, 233, 233";
      for (const element of [preview, sidebar]) {
        is(
          getComputedStyle(element).backgroundColor,
          acrylic ? `rgba(${rgb}, 0.8)` : `rgb(${rgb})`,
          "The base surface follows the effective workspace scheme and only acrylic is translucent"
        );
      }
    }
    await SpecialPowers.popPrefEnv();
  }

  await SpecialPowers.pushPrefEnv({
    set: [["zen.theme.acrylic-sidebar", true]],
  });
  for (const reducedTransparency of [false, true]) {
    await SpecialPowers.pushPrefEnv({
      set: [["ui.prefersReducedTransparency", reducedTransparency ? 1 : 0]],
    });
    for (const unsupported of [false, true]) {
      if (unsupported) {
        document.documentElement.setAttribute("zen-no-acrylic", "true");
      } else {
        document.documentElement.removeAttribute("zen-no-acrylic");
      }
      await new Promise(resolve => requestAnimationFrame(resolve));
      for (const element of [preview, sidebar]) {
        is(
          getComputedStyle(element).backdropFilter,
          reducedTransparency || unsupported ? "none" : "blur(42px)",
          "Reduced transparency and unsupported compositors disable acrylic"
        );
        ok(
          getComputedStyle(element).backgroundColor.startsWith(
            reducedTransparency || unsupported ? "rgb(" : "rgba("
          ),
          "Acrylic fallbacks retain an opaque base surface"
        );
      }
    }
    await SpecialPowers.popPrefEnv();
  }
  document.documentElement.removeAttribute("zen-no-acrylic");
  await SpecialPowers.popPrefEnv();

  Library.toggle();
  await TestUtils.waitForCondition(() => !Library.isLibrarySlightlyOpen);
  gZenCompactModeManager.preference = false;
  await TestUtils.waitForCondition(
    () => !document.documentElement.hasAttribute("zen-compact-animating"),
    "leaving compact mode finishes animating"
  );
  await section.updateComplete;
  ok(
    !card
      .querySelector(".zen-library-space-background")
      .classList.contains("zen-toolbar-background"),
    "The preview follows the regular window background outside compact mode"
  );
});
