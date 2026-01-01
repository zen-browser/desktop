/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Unload_NoReset_Pinned() {
  await SpecialPowers.pushPrefEnv({
    set: [['zen.pinned-tab-manager.close-shortcut-behavior', 'close']],
  });

  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  await BrowserTestUtils.withNewTab({ gBrowser, url: 'https://example.com/1' }, async (browser) => {
    const tab = gBrowser.getTabForBrowser(browser);
    gBrowser.pinTab(tab);

    document.getElementById('cmd_close').doCommand();
    setTimeout(() => {
      ok(tab.closing, 'The tab should be closing after being closed');
      resolvePromise();
    }, 100);
    await promise;
  });
});
