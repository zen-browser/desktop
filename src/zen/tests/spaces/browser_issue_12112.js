/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.urlbar.replace-newtab", false]],
  });
  registerCleanupFunction(async () => {
    await SpecialPowers.popPrefEnv();
  });
});

add_task(
  async function test_focuses_urlbar_on_startup_without_replace_newtab() {
    await gZenWorkspaces.promiseInitialized;
    Assert.ok(
      !gZenVerticalTabsManager._canReplaceNewTab,
      "Precondition: zen.urlbar.replace-newtab is disabled"
    );

    const originalTab = gBrowser.selectedTab;
    const originalOpenLocation = window.openLocation;
    const originalTestingEnabled = gZenUIManager.testingEnabled;

    let openLocationCalls = 0;
    window.openLocation = () => {
      openLocationCalls++;
    };

    // selectStartPage() and selectEmptyTab() are both no-ops while testing mode
    // is enabled; temporarily disable it to exercise the real startup path.
    gZenUIManager.testingEnabled = false;

    // The tab the startup page leaves selected, which Zen wants to replace.
    const tabToRemove = BrowserTestUtils.addTab(gBrowser, "about:blank", {
      skipAnimation: true,
    });
    gBrowser.selectedTab = tabToRemove;
    gZenWorkspaces._tabToRemoveForEmpty = tabToRemove;
    delete gZenWorkspaces._tabToSelect;
    delete gZenWorkspaces._shouldOverrideTabs;
    delete gZenWorkspaces._initialTab;

    try {
      await gZenWorkspaces.selectStartPage();

      await TestUtils.waitForCondition(
        () => openLocationCalls > 0,
        "openLocation() should be called to focus the address bar"
      );

      Assert.equal(
        openLocationCalls,
        1,
        "The address bar was focused via openLocation()"
      );
      Assert.ok(
        !gBrowser.selectedTab.hasAttribute("zen-empty-tab"),
        "A fallback homepage tab is selected (no zen-empty-tab attribute), so " +
          "the focus decision came from initialTabWasEmpty, not shownEmptyTab"
      );
      Assert.ok(
        !gBrowser.tabs.includes(tabToRemove),
        "The empty tab added by the startup page was removed"
      );
    } finally {
      window.openLocation = originalOpenLocation;
      gZenUIManager.testingEnabled = originalTestingEnabled;
      delete gZenWorkspaces._tabToRemoveForEmpty;

      // Remove any tab created by the startup path, then restore the original.
      for (const tab of [...gBrowser.tabs]) {
        if (tab !== originalTab && !tab.hasAttribute("zen-empty-tab")) {
          BrowserTestUtils.removeTab(tab);
        }
      }
      if (!originalTab.closing) {
        gBrowser.selectedTab = originalTab;
      }
    }
  }
);
