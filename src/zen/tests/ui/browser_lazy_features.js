/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_secondary_chrome_stays_unloaded_until_used() {
  Assert.ok(gZenLazyFeatures, "the lazy registry is installed");
  Assert.ok(gZenStartup, "startup stays eager");
  Assert.ok(gZenUIManager, "the UI manager stays eager");
  Assert.ok(gZenWorkspaces, "workspaces stay eager");
  Assert.ok(window.ZenDragAndDrop, "tab drag-and-drop is constructed at parse");

  Assert.ok(gZenLazyFeatures.isLoaded("glance"), "glance is up by DOMContentLoaded");
  Assert.ok(gZenLazyFeatures.isLoaded("folders"), "folders are up by DOMContentLoaded");
  await TestUtils.waitForCondition(
    () => gZenLazyFeatures.isLoaded("homepage"),
    "the homepage loads once workspaces are up"
  );
  Assert.equal(
    gZenLazyFeatures.isLoaded("emoji"),
    false,
    "the emoji picker waits until it is opened"
  );
  Assert.equal(
    gZenLazyFeatures.isLoaded("media"),
    false,
    "media controls wait for playing audio"
  );
});
