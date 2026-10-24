/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
});

for (const typedValue of ["", "a new tab search"]) {
  add_task(async function test_location_command_leaves_newtab_mode() {
    await SimpleTest.promiseFocus(window);
    await BrowserTestUtils.withNewTab("https://example.com/", async browser => {
      const tab = gBrowser.selectedTab;
      const tabCount = gBrowser.tabs.length;
      const token = {};
      await UrlbarTestUtils.promisePopupOpen(window, () => {
        ok(
          gZenUIManager.handleNewTab(false, false, "tab", true, token),
          "Open the floating new-tab bar"
        );
      });

      ok(gURLBar.hasAttribute("zen-newtab"), "Opening keeps new-tab mode");
      ok(gZenUIManager._isOwner(token.id), "The new-tab session owns the bar");
      const staleClose = gURLBar._zenHandleUrlbarClose;
      if (typedValue) {
        await UrlbarTestUtils.promiseAutocompleteResultPopup({
          window,
          waitForFocus: SimpleTest.waitForFocus,
          value: typedValue,
          fireInputEvent: true,
        });
      }

      EventUtils.synthesizeKey("l", { accelKey: true });

      ok(!gURLBar.hasAttribute("zen-newtab"), "Ctrl+L exits new-tab mode");
      ok(
        !gURLBar._zenHandleUrlbarClose,
        "The session close handler is cleared"
      );
      ok(!gZenUIManager._isOwner(token.id), "The session releases ownership");
      ok(
        tab.hasAttribute("visuallyselected"),
        "The current tab is visually selected again"
      );
      for (const button of gNavToolbox.querySelectorAll(
        "#tabs-newtab-button"
      )) {
        ok(!button.hasAttribute("in-urlbar"), "The new-tab button is restored");
      }
      ok(gURLBar.focused, "The URL bar remains focused");
      is(
        gURLBar.untrimmedValue,
        browser.currentURI.spec,
        "The current URL is restored"
      );
      is(gURLBar.selectionStart, 0, "Selection starts at the beginning");
      is(
        gURLBar.selectionEnd,
        gURLBar.value.length,
        "The entire URL is selected"
      );
      is(gBrowser.selectedTab, tab, "The current tab stays selected");
      is(gBrowser.tabs.length, tabCount, "No new tab is created");

      const closed = BrowserTestUtils.waitForEvent(
        window,
        "ZenURLBarClosed",
        false,
        event => gZenUIManager.matchesCloseToken(token, event)
      );
      staleClose();
      await closed;
      ok(
        gURLBar.view.isOpen,
        "A stale session close cannot close the current URL bar"
      );
      is(
        gURLBar.untrimmedValue,
        browser.currentURI.spec,
        "A stale close preserves the URL"
      );

      await UrlbarTestUtils.promisePopupClose(window, () => {
        EventUtils.synthesizeKey("KEY_Escape");
      });
    });
  });
}
