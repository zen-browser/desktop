/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* Tests that the send more info link appears only when its pref
 * is set to true, and that when clicked it will open a tab to
 * the webcompat.com endpoint and send the right data.
 */

/* import-globals-from send_more_info.js */

"use strict";

const VIDEO_URL = `${BASE_URL}/videotest.mp4`;

Services.scriptloader.loadSubScript(
  getRootDirectory(gTestPath) + "send_more_info.js",
  this
);

add_common_setup();

requestLongerTimeout(2);

add_task(async function testSendMoreInfoPref() {
  ensureReportBrokenSitePreffedOn();

  await BrowserTestUtils.withNewTab(REPORTABLE_PAGE_URL, async function () {
    await changeTab(gBrowser.selectedTab, REPORTABLE_PAGE_URL);

    ensureSendMoreInfoDisabled();
    let rbs = await AppMenu().openReportBrokenSite();
    await rbs.isSendMoreInfoHidden();
    await rbs.close();

    ensureSendMoreInfoEnabled();
    rbs = await AppMenu().openReportBrokenSite();
    await rbs.isSendMoreInfoShown();
    await rbs.close();
  });
});

add_task(async function testSendingMoreInfo() {
  ensureReportBrokenSitePreffedOn();
  ensureSendMoreInfoEnabled();

  const tab = await openTab(REPORTABLE_PAGE_URL);

  await testSendMoreInfo(tab, AppMenu());

  await changeTab(tab, REPORTABLE_PAGE_URL2);

  await testSendMoreInfo(tab, ProtectionsPanel(), {
    url: "https://override.com",
    description: "another",
    expectNoTabDetails: true,
  });

  // also load a video to ensure system codec
  // information is loaded and properly sent
  const tab2 = await openTab(VIDEO_URL);
  await testSendMoreInfo(tab2, HelpMenu());
  closeTab(tab2);

  closeTab(tab);
});
