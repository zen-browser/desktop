/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* Tests to ensure that Report Broken Site popups will be
 * reset to whichever tab the user is on as they change
 * between windows and tabs. */

"use strict";

add_common_setup();

add_task(async function testResetsProperlyOnTabSwitch() {
  ensureReportBrokenSitePreffedOn();

  const badTab = await openTab("about:blank");
  const goodTab1 = await openTab(REPORTABLE_PAGE_URL);
  const goodTab2 = await openTab(REPORTABLE_PAGE_URL2);

  const appMenu = AppMenu();
  const protPanel = ProtectionsPanel();

  let rbs = await appMenu.openReportBrokenSite();
  rbs.isMainViewResetToCurrentTab();
  rbs.close();

  gBrowser.selectedTab = goodTab1;

  rbs = await protPanel.openReportBrokenSite();
  rbs.isMainViewResetToCurrentTab();
  rbs.close();

  gBrowser.selectedTab = badTab;
  await appMenu.open();
  appMenu.isReportBrokenSiteDisabled();
  await appMenu.close();

  gBrowser.selectedTab = goodTab1;
  rbs = await protPanel.openReportBrokenSite();
  rbs.isMainViewResetToCurrentTab();
  rbs.close();

  closeTab(badTab);
  closeTab(goodTab1);
  closeTab(goodTab2);
});

add_task(async function testResetsProperlyOnWindowSwitch() {
  ensureReportBrokenSitePreffedOn();

  const tab1 = await openTab(REPORTABLE_PAGE_URL);

  const win2 = await BrowserTestUtils.openNewBrowserWindow();
  const tab2 = await openTab(REPORTABLE_PAGE_URL2, win2);

  const appMenu1 = AppMenu();
  const appMenu2 = ProtectionsPanel(win2);

  let rbs2 = await appMenu2.openReportBrokenSite();
  rbs2.isMainViewResetToCurrentTab();
  rbs2.close();

  // flip back to tab1's window and ensure its URL pops up instead of tab2's URL
  await switchToWindow(window);
  isSelectedTab(window, tab1); // sanity check

  let rbs1 = await appMenu1.openReportBrokenSite();
  rbs1.isMainViewResetToCurrentTab();
  rbs1.close();

  // likewise flip back to tab2's window and ensure its URL pops up instead of tab1's URL
  await switchToWindow(win2);
  isSelectedTab(win2, tab2); // sanity check

  rbs2 = await appMenu2.openReportBrokenSite();
  rbs2.isMainViewResetToCurrentTab();
  rbs2.close();

  closeTab(tab1);
  closeTab(tab2);
  await BrowserTestUtils.closeWindow(win2);
});
