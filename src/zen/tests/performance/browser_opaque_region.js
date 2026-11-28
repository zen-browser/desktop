/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  AddonManager: "resource://gre/modules/AddonManager.sys.mjs",
});

function get_content_area_corner_radius() {
  let style = getComputedStyle(gBrowser.getBrowserContainer());
  return Math.max(
    ...[
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomLeftRadius,
      style.borderBottomRightRadius,
    ].map(radius => parseFloat(radius) || 0)
  );
}

async function assert_opaque_region() {
  // Ensure we've painted.
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  let contentRect = document
    .getElementById("tabbrowser-tabbox")
    .getBoundingClientRect();
  // Add 1 to the corner radius to account for device-pixel snapping.
  let inset = get_content_area_corner_radius() + 1;
  let expectedRect = {
    left: contentRect.left + inset,
    top: contentRect.top + inset,
    right: contentRect.right - inset,
    bottom: contentRect.bottom - inset,
  };
  let opaqueRegion = window.windowUtils.getWidgetOpaqueRegion();

  info(`Got opaque region: ${JSON.stringify(opaqueRegion)}`);
  info(`Expected to contain: ${JSON.stringify(expectedRect)}`);
  isnot(opaqueRegion.length, 0, "Should have some part of the window opaque");

  let containsExpectedRect = opaqueRect => {
    return (
      opaqueRect.left <= expectedRect.left &&
      opaqueRect.top <= expectedRect.top &&
      opaqueRect.right >= expectedRect.right &&
      opaqueRect.bottom >= expectedRect.bottom
    );
  };

  ok(
    opaqueRegion.some(containsExpectedRect),
    "The browser area should be considered opaque by widget"
  );
}

registerCleanupFunction(async function () {
  let defaultTheme = await lazy.AddonManager.getAddonByID(
    "default-theme@mozilla.org"
  );
  await defaultTheme.enable();
});

add_task(async function assert_opaque_region_system_theme() {
  return assert_opaque_region();
});

add_task(async function assert_opaque_region_mica() {
  await SpecialPowers.pushPrefEnv({ set: [["widget.windows.mica", true]] });
  return assert_opaque_region();
});

add_task(async function assert_opaque_region_light_theme() {
  let lightTheme = await lazy.AddonManager.getAddonByID(
    "firefox-compact-light@mozilla.org"
  );
  await lightTheme.enable();
  return assert_opaque_region();
});

add_task(async function assert_opaque_region_dark_theme() {
  let lightTheme = await lazy.AddonManager.getAddonByID(
    "firefox-compact-dark@mozilla.org"
  );
  await lightTheme.enable();
  return assert_opaque_region();
});
