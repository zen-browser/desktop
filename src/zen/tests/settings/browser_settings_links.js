/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_links_pane() {
  const { gZenSpaceRoutingManager } = ChromeUtils.importESModule(
    "resource:///modules/zen/spacerouting/ZenSpaceRoutingManager.sys.mjs"
  );
  const originalRoute = gZenSpaceRoutingManager.getDefaultExternalRoute();
  gZenSpaceRoutingManager.setDefaultExternalRoute("most-recent-space");

  const win = await openSettingsWindow(() => ZenSettings.open("links"));
  const doc = win.document;
  const external = doc.getElementById("zen-settings-little-external-links");
  ok(!external.pressed, "Links from other apps don't go to a little window");
  await clickToggle(external);
  is(
    gZenSpaceRoutingManager.getDefaultExternalRoute(),
    "little-window",
    "Turning the toggle on routes links from other apps to a little window"
  );
  await clickToggle(external);
  is(
    gZenSpaceRoutingManager.getDefaultExternalRoute(),
    "most-recent-space",
    "Turning it off routes them to the most recent space"
  );

  const shortcutLabel = doc.getElementById(
    "zen-settings-little-shortcut-label"
  );
  if (AppConstants.platform == "linux") {
    ok(!shortcutLabel, "There is no system wide shortcut to offer on Linux");
  } else {
    is(
      shortcutLabel.dataset.l10nId,
      "zen-settings-window-little-global-shortcut-key",
      "The global shortcut row names the shortcut"
    );
  }
  gZenSpaceRoutingManager.setDefaultExternalRoute(originalRoute);
  gZenSpaceRoutingManager.saveRoutes();
  await BrowserTestUtils.closeWindow(win);
});
