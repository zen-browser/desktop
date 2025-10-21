/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* Test that the Report Broken Site menu items are disabled
 * when the active tab is not on a reportable URL, and is hidden
 * when the feature is disabled via pref. Also ensure that the
 * Report Broken Site item that is automatically generated in
 * the app menu's help sub-menu is hidden.
 */

"use strict";

add_common_setup();

add_task(async function testMenus() {
  ensureReportBrokenSitePreffedOff();

  const appMenu = AppMenu();
  const menus = [appMenu, ProtectionsPanel(), HelpMenu()];

  async function forceMenuItemStateUpdate() {
    ReportBrokenSite.enableOrDisableMenuitems(window);

    // the hidden/disabled state of all of the menuitems may not update until one
    // is rendered; then the related <command>'s state is propagated to them all.
    await appMenu.open();
    await appMenu.close();
  }

  await BrowserTestUtils.withNewTab("about:blank", async function () {
    await forceMenuItemStateUpdate();
    for (const { menuDescription, reportBrokenSite } of menus) {
      isMenuItemHidden(
        reportBrokenSite,
        `${menuDescription} option hidden on invalid page when preffed off`
      );
    }
  });

  await BrowserTestUtils.withNewTab(REPORTABLE_PAGE_URL, async function () {
    await forceMenuItemStateUpdate();
    for (const { menuDescription, reportBrokenSite } of menus) {
      isMenuItemHidden(
        reportBrokenSite,
        `${menuDescription} option hidden on valid page when preffed off`
      );
    }
  });

  ensureReportBrokenSitePreffedOn();

  await BrowserTestUtils.withNewTab("about:blank", async function () {
    await forceMenuItemStateUpdate();
    for (const { menuDescription, reportBrokenSite } of menus) {
      isMenuItemDisabled(
        reportBrokenSite,
        `${menuDescription} option disabled on invalid page when preffed on`
      );
    }
  });

  await BrowserTestUtils.withNewTab(REPORTABLE_PAGE_URL, async function () {
    await forceMenuItemStateUpdate();
    for (const { menuDescription, reportBrokenSite } of menus) {
      isMenuItemEnabled(
        reportBrokenSite,
        `${menuDescription} option enabled on valid page when preffed on`
      );
    }
  });

  ensureReportBrokenSitePreffedOff();

  await BrowserTestUtils.withNewTab(REPORTABLE_PAGE_URL, async function () {
    await forceMenuItemStateUpdate();
    for (const { menuDescription, reportBrokenSite } of menus) {
      isMenuItemHidden(
        reportBrokenSite,
        `${menuDescription} option hidden again when pref toggled back off`
      );
    }
  });

  ensureReportBrokenSitePreffedOn();
  ensureReportBrokenSiteDisabledByPolicy();

  await BrowserTestUtils.withNewTab(REPORTABLE_PAGE_URL, async function () {
    await forceMenuItemStateUpdate();
    for (const { menuDescription, reportBrokenSite } of menus) {
      isMenuItemHidden(
        reportBrokenSite,
        `${menuDescription} option hidden when disabled by DisableFeedbackCommands enterprise policy`
      );
    }
  });
});
