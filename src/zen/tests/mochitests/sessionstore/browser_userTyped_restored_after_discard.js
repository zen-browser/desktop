/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

add_task(async function testDiscardWithNotLoadedUserTypedValue() {
  let tab1 = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com"
  );

  // Make sure we flushed the state at least once (otherwise the fix
  // for Bug 1422588 would make SessionStore.resetBrowserToLazyState
  // to still store the user typed value into the tab state cache
  // even when the user typed value was not yet being loading when
  // the tab got discarded).
  await TabStateFlusher.flush(tab1.linkedBrowser);

  tab1.linkedBrowser.userTypedValue = "mockUserTypedValue";

  let tab2 = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:robots"
  );

  let waitForTabDiscarded = BrowserTestUtils.waitForEvent(
    tab1,
    "TabBrowserDiscarded"
  );
  gBrowser.discardBrowser(tab1);
  await waitForTabDiscarded;

  const promiseTabLoaded = BrowserTestUtils.browserLoaded(
    tab1.linkedBrowser,
    false,
    "https://example.com/"
  );
  await BrowserTestUtils.switchTab(gBrowser, tab1);
  info("Wait for the restored tab to load https://example.com");
  await promiseTabLoaded;
  is(
    tab1.linkedBrowser.currentURI.spec,
    "https://example.com/",
    "Restored discarded tab has loaded the expected url"
  );

  BrowserTestUtils.removeTab(tab2);
  BrowserTestUtils.removeTab(tab1);
});
