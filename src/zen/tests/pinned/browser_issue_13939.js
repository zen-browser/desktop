/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Issue #13939: when "zen.pinned-tab-manager.detect-fragment-changes" is
// enabled, a pinned tab should treat a URL fragment change as a deviation from
// its pinned URL (showing "Back to pinned URL"). When disabled (the default),
// the fragment is stripped before comparing, so a fragment-only change is not
// treated as a deviation.

async function pinAndNavigate(detectFragmentChanges) {
  let result;
  await SpecialPowers.pushPrefEnv({
    set: [
      [
        "zen.pinned-tab-manager.detect-fragment-changes",
        detectFragmentChanges,
      ],
    ],
  });

  await BrowserTestUtils.withNewTab(
    { gBrowser, url: "https://example.com/#a" },
    async browser => {
      const tab = gBrowser.getTabForBrowser(browser);
      gBrowser.pinTab(tab);
      ok(tab.pinned, "The tab should be pinned after calling gBrowser.pinTab()");

      await gBrowser.TabStateFlusher.flush(browser);
      await new Promise(r => setTimeout(r, 500));

      const locationChanged = BrowserTestUtils.waitForLocationChange(
        gBrowser,
        "https://example.com/#b"
      );
      BrowserTestUtils.startLoadingURIString(browser, "https://example.com/#b");
      await locationChanged;
      await new Promise(r => setTimeout(r, 500));

      result = tab.hasAttribute("zen-pinned-changed");
    }
  );

  await SpecialPowers.popPrefEnv();
  return result;
}

add_task(async function test_fragment_change_detected_when_enabled() {
  const changed = await pinAndNavigate(true);
  ok(
    changed,
    "With detect-fragment-changes enabled, a fragment change should mark the " +
      "pinned tab as changed"
  );
});

add_task(async function test_fragment_change_ignored_by_default() {
  const changed = await pinAndNavigate(false);
  ok(
    !changed,
    "With detect-fragment-changes disabled (default), a fragment-only change " +
      "should not mark the pinned tab as changed"
  );
});
