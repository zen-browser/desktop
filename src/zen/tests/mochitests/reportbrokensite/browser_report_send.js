/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* Tests to ensure that sending or canceling reports with
 * the Send and Cancel buttons work (as well as the Okay button)
 */

/* import-globals-from send.js */

"use strict";

Services.scriptloader.loadSubScript(
  getRootDirectory(gTestPath) + "send.js",
  this
);

add_common_setup();

requestLongerTimeout(10);

async function testCancel(menu, url, description) {
  let rbs = await menu.openAndPrefillReportBrokenSite(url, description);
  await rbs.clickCancel();
  ok(!rbs.opened, "clicking Cancel closes Report Broken Site");

  // re-opening the panel, the url and description should be reset
  rbs = await menu.openReportBrokenSite();
  rbs.isMainViewResetToCurrentTab();
  rbs.close();
}

add_task(async function testSendButton() {
  ensureReportBrokenSitePreffedOn();
  ensureReasonOptional();

  const tab1 = await openTab(REPORTABLE_PAGE_URL);

  await testSend(tab1, AppMenu());

  const tab2 = await openTab(REPORTABLE_PAGE_URL);

  await testSend(tab2, ProtectionsPanel(), {
    url: "https://test.org/test/#fake",
    breakageCategory: "media",
    description: "test description",
  });

  closeTab(tab1);
  closeTab(tab2);
});

add_task(async function testCancelButton() {
  ensureReportBrokenSitePreffedOn();

  const tab1 = await openTab(REPORTABLE_PAGE_URL);

  await testCancel(AppMenu());
  await testCancel(ProtectionsPanel());
  await testCancel(HelpMenu());

  const tab2 = await openTab(REPORTABLE_PAGE_URL);

  await testCancel(AppMenu());
  await testCancel(ProtectionsPanel());
  await testCancel(HelpMenu());

  const win2 = await BrowserTestUtils.openNewBrowserWindow();
  const tab3 = await openTab(REPORTABLE_PAGE_URL2, win2);

  await testCancel(AppMenu(win2));
  await testCancel(ProtectionsPanel(win2));
  await testCancel(HelpMenu(win2));

  closeTab(tab3);
  await BrowserTestUtils.closeWindow(win2);

  closeTab(tab1);
  closeTab(tab2);
});
