/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_NewTab_Extension_Gets_Its_Page() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.urlbar.replace-newtab", true]],
  });
  const originalTestingEnabled = gZenUIManager.testingEnabled;
  // Testing mode makes handleNewTab bail out before the check under test.
  gZenUIManager.testingEnabled = false;
  const extension = ExtensionTestUtils.loadExtension({
    manifest: { chrome_url_overrides: { newtab: "newtab.html" } },
    files: {
      "newtab.html": "<!DOCTYPE html><title>Extension new tab</title>",
    },
    useAddonManager: "temporary",
  });
  try {
    await extension.startup();
    ok(
      AboutNewTab.newTabURLOverridden,
      "The extension replaced the new-tab page"
    );
    ok(
      !gZenUIManager.handleNewTab(false, false, "tab"),
      "A new tab is left to the extension's page, not the URL bar"
    );
  } finally {
    await extension.unload();
    gZenUIManager.testingEnabled = originalTestingEnabled;
  }
  ok(
    !AboutNewTab.newTabURLOverridden,
    "The new-tab page is Zen's again once the extension is gone"
  );
});
