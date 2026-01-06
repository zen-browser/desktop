/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* Tests to ensure that the reason dropdown is shown or hidden
 * based on its pref, and that its optional and required modes affect
 * the Send button and report appropriately.
 */

"use strict";

add_common_setup();

async function ensureLearnMoreLinkWorks(menu) {
  const rbs = await menu.openReportBrokenSite();
  const { win, mainView, learnMoreLink } = rbs;
  ok(learnMoreLink, "Found a learn more link");

  const promises = [
    BrowserTestUtils.waitForEvent(mainView, "ViewHiding"),
    BrowserTestUtils.waitForNewTab(win.gBrowser, LEARN_MORE_TEST_URL),
  ];
  EventUtils.synthesizeMouseAtCenter(learnMoreLink, {}, win);
  const results = await Promise.all(promises);
  gBrowser.removeTab(results[1]);
}

add_task(async function testLearnMoreLink() {
  ensureReportBrokenSitePreffedOn();
  await BrowserTestUtils.withNewTab(REPORTABLE_PAGE_URL, async function () {
    await ensureLearnMoreLinkWorks(AppMenu());
    await ensureLearnMoreLinkWorks(HelpMenu());
    await ensureLearnMoreLinkWorks(ProtectionsPanel());
  });
  const telemetry = Glean.webcompatreporting.learnMore.testGetValue();
  is(telemetry.length, 3, "Got telemetry");
});
