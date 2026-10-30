/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Extensions (e.g. ones that redirect links to an already open tab) can remove
// the glance tab before its opening animation has finished. The parent tab
// must not be left dimmed behind a glance that no longer exists.
async function closeGlanceWhileOpening(rect) {
  const parentTab = gBrowser.selectedTab;
  const parentContainer = parentTab.linkedBrowser.closest(
    ".browserSidebarContainer"
  );

  const openPromise = gZenGlanceManager.openGlance({
    url: "https://example.com",
    ...rect,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });
  const glanceTab = gBrowser.selectedTab;
  ok(
    glanceTab.hasAttribute("zen-glance-tab"),
    "The glance tab should be selected while opening"
  );

  gBrowser.removeTab(glanceTab);

  const result = await openPromise;
  Assert.equal(result, null, "Opening should be abandoned once the tab closes");

  await TestUtils.waitForCondition(
    () => !gZenGlanceManager.closingGlance && !gZenGlanceManager._animating,
    "Waiting for the glance to finish closing"
  );

  ok(!glanceTab.isConnected, "The glance tab should be removed");
  ok(
    !parentTab.hasAttribute("glance-id"),
    "The parent tab should no longer reference the glance"
  );
  Assert.equal(
    gBrowser.selectedTab,
    parentTab,
    "The parent should be selected"
  );
  ok(
    !parentContainer.classList.contains("zen-glance-background"),
    "The parent should not be styled as a glance background"
  );
  // Closing waits for the parent's dimming animation to finish before
  // restoring it, so the parent can still be fading back in at this point.
  await TestUtils.waitForCondition(
    () => parentContainer.style.opacity === "",
    "The parent should not be left dimmed"
  );
  ok(true, "The parent is no longer dimmed");
}

add_task(async function test_Glance_Close_While_Opening() {
  await closeGlanceWhileOpening({
    clientX: 0,
    clientY: 0,
    width: 0,
    height: 0,
  });
});

add_task(async function test_Glance_Close_While_Capturing_Preview() {
  // A non-empty rect makes the glance capture an element preview first,
  // which gives the tab a chance to be closed before the animation starts.
  await closeGlanceWhileOpening({
    clientX: 10,
    clientY: 10,
    width: 100,
    height: 100,
  });
});
