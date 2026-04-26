/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_clicking_icon_opens_and_prepares_panel() {
  const tab = BrowserTestUtils.addTab(gBrowser, HTTPS_PAGE, {
    skipAnimation: true,
  });
  await BrowserTestUtils.switchTab(gBrowser, tab);

  try {
    const panel = await openSiteDataPanel();
    Assert.equal(panel.state, "open", "panel is in the open state");

    // #preparePanel ran — the security-info button got its identity attr
    // set (it has no default value in markup).
    const securityButton = document.getElementById(
      "zen-site-data-security-info"
    );
    ok(
      securityButton.hasAttribute("identity"),
      "panel popupshowing populated the security-info identity attribute"
    );

    await closeSiteDataPanel();
    Assert.equal(panel.state, "closed", "panel closed cleanly");
  } finally {
    await closeSiteDataPanel();
    BrowserTestUtils.removeTab(tab);
  }
});
