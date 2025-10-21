/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* Tests to ensure that the reason dropdown is shown or hidden
 * based on its pref, and that its optional and required modes affect
 * the Send button and report appropriately.
 */

"use strict";

add_common_setup();

requestLongerTimeout(2);

async function clickSendAndCheckPing(rbs, expectedReason = null) {
  await GleanPings.brokenSiteReport.testSubmission(
    () =>
      Assert.equal(
        Glean.brokenSiteReport.breakageCategory.testGetValue(),
        expectedReason
      ),
    () => rbs.clickSend()
  );
}

add_task(async function testReasonDropdown() {
  ensureReportBrokenSitePreffedOn();

  await BrowserTestUtils.withNewTab(REPORTABLE_PAGE_URL, async function () {
    ensureReasonDisabled();

    let rbs = await AppMenu().openReportBrokenSite();
    await rbs.isReasonHidden();
    await rbs.isSendButtonEnabled();
    await clickSendAndCheckPing(rbs);
    await rbs.clickOkay();

    ensureReasonOptional();
    rbs = await AppMenu().openReportBrokenSite();
    await rbs.isReasonOptional();
    await rbs.isSendButtonEnabled();
    await clickSendAndCheckPing(rbs);
    await rbs.clickOkay();

    rbs = await AppMenu().openReportBrokenSite();
    await rbs.isReasonOptional();
    rbs.chooseReason("slow");
    await rbs.isSendButtonEnabled();
    await clickSendAndCheckPing(rbs, "slow");
    await rbs.clickOkay();

    ensureReasonRequired();
    rbs = await AppMenu().openReportBrokenSite();
    await rbs.isReasonRequired();
    await rbs.isSendButtonEnabled();
    const selectPromise = BrowserTestUtils.waitForSelectPopupShown(window);
    EventUtils.synthesizeMouseAtCenter(rbs.sendButton, {}, window);
    await selectPromise;
    rbs.chooseReason("media");
    await rbs.dismissDropdownPopup();
    await rbs.isSendButtonEnabled();
    await clickSendAndCheckPing(rbs, "media");
    await rbs.clickOkay();
  });
});

async function getListItems(rbs) {
  const items = Array.from(rbs.reasonInput.querySelectorAll("option")).map(i =>
    i.id.replace("report-broken-site-popup-reason-", "")
  );
  Assert.equal(items[0], "choose", "First option is always 'choose'");
  return items.join(",");
}

add_task(async function testReasonDropdownRandomized() {
  ensureReportBrokenSitePreffedOn();
  ensureReasonOptional();

  const USER_ID_PREF = "app.normandy.user_id";
  const RANDOMIZE_PREF = "ui.new-webcompat-reporter.reason-dropdown.randomized";

  const origNormandyUserID = Services.prefs.getCharPref(
    USER_ID_PREF,
    undefined
  );

  await BrowserTestUtils.withNewTab(REPORTABLE_PAGE_URL, async function () {
    // confirm that the default order is initially used
    Services.prefs.setBoolPref(RANDOMIZE_PREF, false);
    const rbs = await AppMenu().openReportBrokenSite();
    const defaultOrder = [
      "choose",
      "checkout",
      "load",
      "slow",
      "media",
      "content",
      "account",
      "adblocker",
      "notsupported",
      "other",
    ];
    Assert.deepEqual(
      await getListItems(rbs),
      defaultOrder,
      "non-random order is correct"
    );

    // confirm that a random order happens per user
    let randomOrder;
    let isRandomized = false;
    Services.prefs.setBoolPref(RANDOMIZE_PREF, true);

    // This becomes ClientEnvironment.randomizationId, which we can set to
    // any value which results in a different order from the default ordering.
    Services.prefs.setCharPref("app.normandy.user_id", "dummy");

    // clicking cancel triggers a reset, which is when the randomization
    // logic is called. so we must click cancel after pref-changes here.
    rbs.clickCancel();
    await AppMenu().openReportBrokenSite();
    randomOrder = await getListItems(rbs);
    Assert.notEqual(
      randomOrder,
      defaultOrder,
      "options are randomized with pref on"
    );

    // confirm that the order doesn't change per user
    isRandomized = false;
    for (let attempt = 0; attempt < 5; ++attempt) {
      rbs.clickCancel();
      await AppMenu().openReportBrokenSite();
      const order = await getListItems(rbs);

      if (order != randomOrder) {
        isRandomized = true;
        break;
      }
    }
    Assert.ok(!isRandomized, "options keep the same order per user");

    // confirm that the order reverts to the default if pref flipped to false
    Services.prefs.setBoolPref(RANDOMIZE_PREF, false);
    rbs.clickCancel();
    await AppMenu().openReportBrokenSite();
    Assert.deepEqual(
      defaultOrder,
      await getListItems(rbs),
      "reverts to non-random order correctly"
    );
    rbs.clickCancel();
  });

  Services.prefs.setCharPref(USER_ID_PREF, origNormandyUserID);
});
