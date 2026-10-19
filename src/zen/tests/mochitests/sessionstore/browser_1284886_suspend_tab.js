/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

add_task(async function test() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["dom.require_user_interaction_for_beforeunload", false],
      // Keep the tab closing animation, which this test relies on to observe
      // a tab in its closing state.
      ["ui.prefersReducedMotion", 0],
    ],
  });

  let url = "about:robots";
  let tab0 = gBrowser.tabs[0];
  let tab1 = await BrowserTestUtils.openNewForegroundTab(gBrowser, url);

  const staleAttributes = [
    "activemedia-blocked",
    "busy",
    "pendingicon",
    "progress",
    "soundplaying",
  ];
  for (let attr of staleAttributes) {
    tab0.toggleAttribute(attr, true);
  }
  gBrowser.discardBrowser(tab0);
  ok(!tab0.linkedPanel, "tab0 is suspended");
  for (let attr of staleAttributes) {
    ok(
      !tab0.hasAttribute(attr),
      `discarding browser removes "${attr}" tab attribute`
    );
  }

  await BrowserTestUtils.switchTab(gBrowser, tab0);
  ok(tab0.linkedPanel, "selecting tab unsuspends it");

  // Test that active tab is not able to be suspended.
  gBrowser.discardBrowser(tab0);
  ok(tab0.linkedPanel, "active tab is not able to be suspended");

  // Test that tab that is closing is not able to be suspended.
  gBrowser.removeTab(tab1, { animate: true });
  gBrowser.discardBrowser(tab1);

  ok(tab1.linkedPanel, "cannot suspend a tab that is closing");

  await TestUtils.waitForCondition(
    () => !tab1.isConnected,
    "tab1 finished closing"
  );

  // Open tab containing a page which has a beforeunload handler which shows a prompt.
  url =
    "http://example.com/browser/browser/components/sessionstore/test/browser_1284886_suspend_tab.html";
  tab1 = await BrowserTestUtils.openNewForegroundTab(gBrowser, url);
  await BrowserTestUtils.switchTab(gBrowser, tab0);

  // Test that tab with beforeunload handler which would show a prompt cannot be suspended.
  gBrowser.discardBrowser(tab1);
  ok(
    tab1.linkedPanel,
    "cannot suspend a tab with beforeunload handler which would show a prompt"
  );

  // Test that tab with beforeunload handler which would show a prompt will be suspended if forced.
  gBrowser.discardBrowser(tab1, true);
  ok(
    !tab1.linkedPanel,
    "force suspending a tab with beforeunload handler which would show a prompt"
  );

  BrowserTestUtils.removeTab(tab1);

  // Open tab containing a page which has a beforeunload handler which does not show a prompt.
  url =
    "http://example.com/browser/browser/components/sessionstore/test/browser_1284886_suspend_tab_2.html";
  tab1 = await BrowserTestUtils.openNewForegroundTab(gBrowser, url);
  await BrowserTestUtils.switchTab(gBrowser, tab0);

  // Test that tab with beforeunload handler which would not show a prompt can be suspended.
  gBrowser.discardBrowser(tab1);
  ok(
    !tab1.linkedPanel,
    "can suspend a tab with beforeunload handler which would not show a prompt"
  );

  BrowserTestUtils.removeTab(tab1);

  // Test that non-remote tab is not able to be suspended.
  url = "about:robots";
  tab1 = BrowserTestUtils.addTab(gBrowser, url, { forceNotRemote: true });
  await promiseBrowserLoaded(tab1.linkedBrowser, true, url);
  await BrowserTestUtils.switchTab(gBrowser, tab1);
  await BrowserTestUtils.switchTab(gBrowser, tab0);

  gBrowser.discardBrowser(tab1);
  ok(tab1.linkedPanel, "cannot suspend a remote tab");

  BrowserTestUtils.removeTab(tab1);
});
