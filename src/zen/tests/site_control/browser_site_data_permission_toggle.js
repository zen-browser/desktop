/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { SitePermissions } = ChromeUtils.importESModule(
  "resource:///modules/SitePermissions.sys.mjs"
);

add_task(async function test_toggling_permission_flips_ui_and_store() {
  const tab = BrowserTestUtils.addTab(gBrowser, HTTPS_PAGE, {
    skipAnimation: true,
  });
  await BrowserTestUtils.switchTab(gBrowser, tab);
  await new Promise(r => setTimeout(r, 500)); // ensure the tab's browser is fully ready

  const principal = gBrowser.contentPrincipal;
  SitePermissions.setForPrincipal(principal, "geo", SitePermissions.ALLOW);

  try {
    await openSiteDataPanel();

    const geoItem = document.querySelector(
      ".permission-popup-permission-item-geo"
    );
    ok(geoItem, "geo permission row rendered in the panel");
    Assert.equal(
      geoItem.getAttribute("state"),
      "allow",
      "row starts in the allow state"
    );

    // The click handler lives on the container; synthesize a click on the
    // label (child) which bubbles to it.
    const label = geoItem.querySelector(
      ".permission-popup-permission-label-container"
    );
    EventUtils.synthesizeMouseAtCenter(label, {});

    await TestUtils.waitForCondition(
      () => geoItem.getAttribute("state") === "block",
      "row flips to the block state after the click"
    );

    // The backing store must agree.
    const stored = SitePermissions.getForPrincipal(principal, "geo");
    Assert.equal(
      stored.state,
      SitePermissions.BLOCK,
      "SitePermissions records BLOCK for the principal after the toggle"
    );

    await closeSiteDataPanel();
  } finally {
    SitePermissions.removeFromPrincipal(principal, "geo");
    await closeSiteDataPanel();
    BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_temporary_permission_labels_and_revoke() {
  const tab = BrowserTestUtils.addTab(gBrowser, HTTPS_PAGE, {
    skipAnimation: true,
  });
  await BrowserTestUtils.switchTab(gBrowser, tab);
  await new Promise(r => setTimeout(r, 500));

  const browser = gBrowser.selectedBrowser;
  const principal = browser.contentPrincipal;
  SitePermissions.setForPrincipal(
    principal,
    "geo",
    SitePermissions.ALLOW,
    SitePermissions.SCOPE_TEMPORARY,
    browser,
    0
  );
  SitePermissions.setForPrincipal(
    principal,
    "xr",
    SitePermissions.ALLOW,
    SitePermissions.SCOPE_TEMPORARY,
    browser,
    SitePermissions.TEMPORARY_GRANT_TIMED_MS
  );

  try {
    await openSiteDataPanel();

    const geoState = document.querySelector(
      ".permission-popup-permission-item-geo .zen-permission-popup-permission-state-label"
    );
    Assert.equal(
      geoState.getAttribute("data-l10n-id"),
      "zen-site-data-setting-allow-tab",
      "tab-lifetime grant is labeled until this tab closes"
    );

    const xrState = document.querySelector(
      ".permission-popup-permission-item-xr .zen-permission-popup-permission-state-label"
    );
    Assert.equal(
      xrState.getAttribute("data-l10n-id"),
      "zen-site-data-setting-allow-timed",
      "timed grant shows the remaining minutes"
    );

    const geoLabel = document.querySelector(
      ".permission-popup-permission-item-geo .permission-popup-permission-label-container"
    );
    EventUtils.synthesizeMouseAtCenter(geoLabel, {});

    await TestUtils.waitForCondition(
      () =>
        !document.querySelector(".permission-popup-permission-item-geo"),
      "temporary geo row is removed"
    );
    Assert.equal(
      SitePermissions.getForPrincipal(principal, "geo", browser).state,
      SitePermissions.UNKNOWN,
      "clicking a temporary row clears the grant"
    );
  } finally {
    SitePermissions.removeFromPrincipal(principal, "geo", browser);
    SitePermissions.removeFromPrincipal(principal, "xr", browser);
    await closeSiteDataPanel();
    BrowserTestUtils.removeTab(tab);
  }
});
