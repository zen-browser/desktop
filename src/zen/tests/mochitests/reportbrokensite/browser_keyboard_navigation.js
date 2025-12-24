/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* Tests to ensure that sending or canceling reports with
 * the Send and Cancel buttons work (as well as the Okay button)
 */

"use strict";

add_common_setup();

requestLongerTimeout(2);

async function testPressingKey(key, tabToMatch, makePromise, followUp) {
  await BrowserTestUtils.withNewTab(REPORTABLE_PAGE_URL, async function () {
    for (const menu of [AppMenu(), ProtectionsPanel(), HelpMenu()]) {
      info(
        `Opening RBS to test pressing ${key} for ${tabToMatch} on ${menu.menuDescription}`
      );
      const rbs = await menu.openReportBrokenSite();
      const promise = makePromise(rbs);
      if (tabToMatch) {
        if (await tabTo(tabToMatch)) {
          await pressKeyAndAwait(promise, key);
          followUp && (await followUp(rbs));
          await rbs.close();
          ok(true, `was able to activate ${tabToMatch} with keyboard`);
        } else {
          await rbs.close();
          ok(false, `could not tab to ${tabToMatch}`);
        }
      } else {
        await pressKeyAndAwait(promise, key);
        followUp && (await followUp(rbs));
        await rbs.close();
        ok(true, `was able to use keyboard`);
      }
    }
  });
}

add_task(async function testSendMoreInfo() {
  ensureReportBrokenSitePreffedOn();
  ensureSendMoreInfoEnabled();
  await testPressingKey(
    "KEY_Enter",
    "#report-broken-site-popup-send-more-info-link",
    rbs => rbs.waitForSendMoreInfoTab(),
    () => gBrowser.removeCurrentTab()
  );
});

add_task(async function testCancel() {
  ensureReportBrokenSitePreffedOn();
  await testPressingKey(
    "KEY_Enter",
    "#report-broken-site-popup-cancel-button",
    rbs => BrowserTestUtils.waitForEvent(rbs.mainView, "ViewHiding")
  );
});

add_task(async function testSendAndOkay() {
  ensureReportBrokenSitePreffedOn();
  await testPressingKey(
    "KEY_Enter",
    "#report-broken-site-popup-send-button",
    rbs => rbs.awaitReportSentViewOpened(),
    async rbs => {
      await tabTo("#report-broken-site-popup-okay-button");
      const promise = BrowserTestUtils.waitForEvent(rbs.sentView, "ViewHiding");
      await pressKeyAndAwait(promise, "KEY_Enter");
    }
  );
});

add_task(async function testESCOnMain() {
  ensureReportBrokenSitePreffedOn();
  await testPressingKey("KEY_Escape", undefined, rbs =>
    BrowserTestUtils.waitForEvent(rbs.mainView, "ViewHiding")
  );
});

add_task(async function testESCOnSent() {
  ensureReportBrokenSitePreffedOn();
  await testPressingKey(
    "KEY_Enter",
    "#report-broken-site-popup-send-button",
    rbs => rbs.awaitReportSentViewOpened(),
    async rbs => {
      const promise = BrowserTestUtils.waitForEvent(rbs.sentView, "ViewHiding");
      await pressKeyAndAwait(promise, "KEY_Escape");
    }
  );
});

add_task(async function testBackButtons() {
  ensureReportBrokenSitePreffedOn();
  await BrowserTestUtils.withNewTab(REPORTABLE_PAGE_URL, async function () {
    for (const menu of [AppMenu(), ProtectionsPanel()]) {
      await menu.openReportBrokenSite();
      await tabTo("#report-broken-site-popup-mainView .subviewbutton-back");
      const promise = BrowserTestUtils.waitForEvent(menu.popup, "ViewShown");
      await pressKeyAndAwait(promise, "KEY_Enter");
      menu.close();
    }
  });
});
