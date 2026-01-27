/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Changed_Pinned() {
  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  await BrowserTestUtils.withNewTab({ gBrowser, url: "https://example.com/1" }, async (browser) => {
    const tab = gBrowser.getTabForBrowser(browser);
    gBrowser.pinTab(tab);

    ok(tab.pinned, "The tab should be pinned after calling gBrowser.pinTab()");

    await gBrowser.TabStateFlusher.flush(browser);
    await new Promise((r) => setTimeout(r, 500));
    BrowserTestUtils.startLoadingURIString(browser, "https://example.com/2");
    await BrowserTestUtils.browserLoaded(browser, false, "https://example.com/2");
    setTimeout(() => {
      ok(
        tab.hasAttribute("zen-pinned-changed"),
        "The tab should have a zen-pinned-changed attribute after being pinned"
      );
      resolvePromise();
    }, 500);

    await promise;
  });
});
