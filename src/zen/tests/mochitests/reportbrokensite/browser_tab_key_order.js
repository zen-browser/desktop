/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* Tests of the expected tab key element focus order */

"use strict";

add_common_setup();

requestLongerTimeout(2);

async function ensureTabOrder(order, win = window) {
  const config = { window: win };
  for (let matches of order) {
    // We need to tab through all elements in each match array in any order
    if (!Array.isArray(matches)) {
      matches = [matches];
    }
    let matchesLeft = matches.length;
    while (matchesLeft--) {
      const target = await pressKeyAndGetFocus("VK_TAB", config);
      let foundMatch = false;
      for (const [i, selector] of matches.entries()) {
        foundMatch = selector && target.matches(selector);
        if (foundMatch) {
          matches[i] = "";
          break;
        }
      }
      ok(
        foundMatch,
        `Expected [${matches}] next, got id=${target.id}, class=${target.className}, ${target}`
      );
      if (!foundMatch) {
        return false;
      }
    }
  }
  return true;
}

async function ensureExpectedTabOrder(
  expectBackButton,
  expectReason,
  expectSendMoreInfo
) {
  const { activeElement } = window.document;
  is(
    activeElement?.id,
    "report-broken-site-popup-url",
    "URL is already focused"
  );
  const order = [];
  if (expectReason) {
    order.push("#report-broken-site-popup-reason");
  }
  order.push("#report-broken-site-popup-description");
  if (expectSendMoreInfo) {
    order.push("#report-broken-site-popup-send-more-info-link");
  }
  // moz-button-groups swap the order of buttons to follow
  // platform conventions, so the order of send/cancel will vary.
  order.push([
    "#report-broken-site-popup-cancel-button",
    "#report-broken-site-popup-send-button",
  ]);
  if (expectBackButton) {
    order.push(".subviewbutton-back");
  }
  order.push("#report-broken-site-popup-url"); // check that we've cycled back
  return ensureTabOrder(order);
}

async function testTabOrder(menu) {
  ensureReasonDisabled();
  ensureSendMoreInfoDisabled();

  const { showsBackButton } = menu;

  let rbs = await menu.openReportBrokenSite();
  await ensureExpectedTabOrder(showsBackButton, false, false);
  await rbs.close();

  ensureSendMoreInfoEnabled();
  rbs = await menu.openReportBrokenSite();
  await ensureExpectedTabOrder(showsBackButton, false, true);
  await rbs.close();

  ensureReasonOptional();
  rbs = await menu.openReportBrokenSite();
  await ensureExpectedTabOrder(showsBackButton, true, true);
  await rbs.close();

  ensureReasonRequired();
  rbs = await menu.openReportBrokenSite();
  await ensureExpectedTabOrder(showsBackButton, true, true);
  await rbs.close();
  rbs = await menu.openReportBrokenSite();
  rbs.chooseReason("slow");
  await ensureExpectedTabOrder(showsBackButton, true, true);
  await rbs.clickCancel();

  ensureSendMoreInfoDisabled();
  rbs = await menu.openReportBrokenSite();
  await ensureExpectedTabOrder(showsBackButton, true, false);
  await rbs.close();
  rbs = await menu.openReportBrokenSite();
  rbs.chooseReason("slow");
  await ensureExpectedTabOrder(showsBackButton, true, false);
  await rbs.clickCancel();

  ensureReasonOptional();
  rbs = await menu.openReportBrokenSite();
  await ensureExpectedTabOrder(showsBackButton, true, false);
  await rbs.close();

  ensureReasonDisabled();
  rbs = await menu.openReportBrokenSite();
  await ensureExpectedTabOrder(showsBackButton, false, false);
  await rbs.close();
}

add_task(async function testTabOrdering() {
  ensureReportBrokenSitePreffedOn();
  ensureSendMoreInfoEnabled();

  await BrowserTestUtils.withNewTab(REPORTABLE_PAGE_URL, async function () {
    await testTabOrder(AppMenu());
    await testTabOrder(ProtectionsPanel());
    await testTabOrder(HelpMenu());
  });
});
