/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_manage_addons_opens_addons_manager() {
  const tab = BrowserTestUtils.addTab(gBrowser, HTTPS_PAGE, {
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  await BrowserTestUtils.switchTab(gBrowser, tab);

  let addonsTab;
  try {
    await openSiteDataPanel();

    const manageButton = document.getElementById("zen-site-data-manage-addons");
    ok(manageButton, "manage-addons link exists in the panel");

    const newTabOpened = BrowserTestUtils.waitForNewTab(
      gBrowser,
      url => url.startsWith("about:addons"),
      true
    );

    manageButton.click();

    addonsTab = await newTabOpened;
    Assert.ok(
      addonsTab.linkedBrowser.currentURI.spec.startsWith("about:addons"),
      "about:addons opened in a new tab"
    );

    await BrowserTestUtils.waitForCondition(
      () => siteDataPanel().state === "closed",
      "panel auto-closes after opening the addons manager"
    );
  } finally {
    await closeSiteDataPanel();
    if (addonsTab) {
      BrowserTestUtils.removeTab(addonsTab);
    }
    BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_get_addons_button_opens_amo() {
  await SpecialPowers.pushPrefEnv({
    set: [["extensions.getAddons.link.url", "https://example.com/"]],
  });

  const tab = BrowserTestUtils.addTab(gBrowser, HTTPS_PAGE, {
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  await BrowserTestUtils.switchTab(gBrowser, tab);

  const amoUrl = Services.urlFormatter.formatURLPref(
    "extensions.getAddons.link.url"
  );

  let amoTab;
  try {
    await openSiteDataPanel();

    const getAddonsButton = document.getElementById(
      "zen-site-data-new-addon-button"
    );
    ok(getAddonsButton, "get-addons button exists in the panel");

    const newTabOpened = BrowserTestUtils.waitForNewTab(
      gBrowser,
      url => url === amoUrl,
      true
    );

    getAddonsButton.dispatchEvent(new Event("command", { bubbles: true }));

    amoTab = await newTabOpened;
    Assert.equal(
      amoTab.linkedBrowser.currentURI.spec,
      amoUrl,
      "AMO URL opened in a new tab"
    );
  } finally {
    await closeSiteDataPanel();
    if (amoTab) {
      BrowserTestUtils.removeTab(amoTab);
    }
    BrowserTestUtils.removeTab(tab);
    await SpecialPowers.popPrefEnv();
  }
});
