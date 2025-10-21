/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* Test that the Report Broken Site errors messages are shown on
 * the UI if the user enters an invalid URL or clicks the send
 * button while it is disabled due to not selecting a "reason"
 */

"use strict";

add_common_setup();

add_task(async function test() {
  ensureReportBrokenSitePreffedOn();
  ensureReasonRequired();

  await BrowserTestUtils.withNewTab(REPORTABLE_PAGE_URL, async function () {
    for (const menu of [AppMenu(), ProtectionsPanel(), HelpMenu()]) {
      const rbs = await menu.openReportBrokenSite();
      const { sendButton, URLInput } = rbs;

      rbs.isURLInvalidMessageHidden();
      rbs.isReasonNeededMessageHidden();

      rbs.setURL("");
      window.document.activeElement.blur();
      rbs.isURLInvalidMessageShown();
      rbs.isReasonNeededMessageHidden();

      rbs.setURL("https://asdf");
      window.document.activeElement.blur();
      rbs.isURLInvalidMessageHidden();
      rbs.isReasonNeededMessageHidden();

      rbs.setURL("http:/ /asdf");
      window.document.activeElement.blur();
      rbs.isURLInvalidMessageShown();
      rbs.isReasonNeededMessageHidden();

      rbs.setURL("https://asdf");
      const selectPromise = BrowserTestUtils.waitForSelectPopupShown(window);
      EventUtils.synthesizeMouseAtCenter(sendButton, {}, window);
      await selectPromise;
      rbs.isURLInvalidMessageHidden();
      rbs.isReasonNeededMessageShown();
      await rbs.dismissDropdownPopup();

      rbs.chooseReason("slow");
      rbs.isURLInvalidMessageHidden();
      rbs.isReasonNeededMessageHidden();

      rbs.setURL("");
      rbs.chooseReason("choose");
      window.ownerGlobal.document.activeElement?.blur();
      const focusPromise = BrowserTestUtils.waitForEvent(URLInput, "focus");
      EventUtils.synthesizeMouseAtCenter(sendButton, {}, window);
      await focusPromise;
      rbs.isURLInvalidMessageShown();
      rbs.isReasonNeededMessageShown();

      rbs.clickCancel();
    }
  });
});
