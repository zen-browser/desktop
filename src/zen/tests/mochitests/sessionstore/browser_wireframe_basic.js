/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Ensure that document wireframes are persisted when enabled,
 * and that we can generate previews for them.
 */
add_task(async function thumbnails_wireframe_basic() {
  // Wireframes only works when Fission is enabled.
  if (!Services.appinfo.fissionAutostart) {
    ok(true, "Skipping test_wireframes when Fission is not enabled.");
    return;
  }

  await SpecialPowers.pushPrefEnv({
    set: [["browser.history.collectWireframes", true]],
  });

  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://www.example.com/"
  );
  await TabStateFlusher.flush(tab.linkedBrowser);
  info("Checking a loaded tab");
  checkWireframeForTab(tab);

  await BrowserTestUtils.switchTab(gBrowser, gBrowser.tabs[0]);
  gBrowser.discardBrowser(tab, true);

  info("Checking a discarded tab");
  checkWireframeForTab(tab);

  gBrowser.removeTab(tab);
});

function checkWireframeForTab(tab) {
  let wireframe = PageWireframes.getWireframeState(tab);
  ok(wireframe, "After load: Got wireframe state");
  Assert.greater(wireframe.rects.length, 0, "After load: Got wireframe rects");
  let wireframeElement = PageWireframes.getWireframeElementForTab(tab);
  is(wireframeElement.tagName, "svg", "Got wireframe element");
}
