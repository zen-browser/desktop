/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function securityIdentity() {
  return document
    .getElementById("zen-site-data-security-info")
    .getAttribute("identity");
}

add_task(async function test_security_identity_by_scheme() {
  const tab = BrowserTestUtils.addTab(gBrowser, HTTPS_PAGE, {
    skipAnimation: true,
  });
  await BrowserTestUtils.switchTab(gBrowser, tab);

  try {
    await openSiteDataPanel();
    Assert.equal(
      securityIdentity(),
      "secure",
      "https page shows identity='secure'"
    );
    await closeSiteDataPanel();

    await loadUrl(HTTP_PAGE);

    await openSiteDataPanel();
    Assert.equal(
      securityIdentity(),
      "not-secure",
      "http page shows identity='not-secure'"
    );
    await closeSiteDataPanel();
  } finally {
    await closeSiteDataPanel();
    BrowserTestUtils.removeTab(tab);
  }
});
