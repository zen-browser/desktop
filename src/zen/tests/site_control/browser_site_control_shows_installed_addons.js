/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function loadTestExtension(id, name) {
  const ext = ExtensionTestUtils.loadExtension({
    manifest: {
      browser_specific_settings: { gecko: { id } },
      name,
    },
    useAddonManager: "temporary",
  });
  await ext.startup();
  return ext;
}

function addonItemsInPanel() {
  return siteDataPanel().querySelectorAll(
    ".unified-extensions-item[data-extensionid]"
  );
}

add_task(async function test_panel_lists_installed_addons() {
  const tab = BrowserTestUtils.addTab(gBrowser, HTTPS_PAGE, {
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  await BrowserTestUtils.switchTab(gBrowser, tab);

  const extA = await loadTestExtension("ext-a@zen-test", "Zen Test Addon A");
  const extB = await loadTestExtension("ext-b@zen-test", "Zen Test Addon B");

  try {
    await openSiteDataPanel();

    await BrowserTestUtils.waitForCondition(() => {
      const ids = Array.from(addonItemsInPanel()).map(el =>
        el.getAttribute("data-extensionid")
      );
      return ids.includes(extA.id) && ids.includes(extB.id);
    }, "both installed addons appear in the panel");

    const renderedIds = Array.from(addonItemsInPanel()).map(el =>
      el.getAttribute("data-extensionid")
    );
    Assert.ok(
      renderedIds.includes(extA.id),
      `addon A (${extA.id}) is rendered`
    );
    Assert.ok(
      renderedIds.includes(extB.id),
      `addon B (${extB.id}) is rendered`
    );

    const itemA = siteDataPanel().querySelector(
      `.unified-extensions-item[data-extensionid="${extA.id}"]`
    );
    Assert.equal(
      itemA.querySelector(".unified-extensions-item-name").textContent,
      "Zen Test Addon A",
      "addon A is rendered with its declared name"
    );

    await closeSiteDataPanel();
  } finally {
    await closeSiteDataPanel();
    await extA.unload();
    await extB.unload();
    BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_panel_drops_uninstalled_addon() {
  const tab = BrowserTestUtils.addTab(gBrowser, HTTPS_PAGE, {
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  await BrowserTestUtils.switchTab(gBrowser, tab);

  const ext = await loadTestExtension(
    "ext-transient@zen-test",
    "Zen Transient Addon"
  );

  try {
    await openSiteDataPanel();
    await BrowserTestUtils.waitForCondition(
      () =>
        siteDataPanel().querySelector(
          `.unified-extensions-item[data-extensionid="${ext.id}"]`
        ),
      "addon initially present in the panel"
    );
    await closeSiteDataPanel();

    await ext.unload();

    await openSiteDataPanel();
    Assert.equal(
      siteDataPanel().querySelector(
        `.unified-extensions-item[data-extensionid="${ext.id}"]`
      ),
      null,
      "uninstalled addon no longer appears in the panel"
    );
    await closeSiteDataPanel();
  } finally {
    await closeSiteDataPanel();
    BrowserTestUtils.removeTab(tab);
  }
});
