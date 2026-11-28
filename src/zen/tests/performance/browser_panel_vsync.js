/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

Services.scriptloader.loadSubScript(
  "chrome://mochitests/content/browser/browser/components/downloads/test/browser/head.js",
  this
);

add_task(
  async function test_opening_panel_and_closing_should_not_leave_vsync() {
    await SpecialPowers.pushPrefEnv({
      set: [["browser.download.autohideButton", false]],
    });
    await promiseButtonShown("downloads-button");

    const downloadsButton = document.getElementById("downloads-button");
    const shownPromise = promisePanelOpened();
    EventUtils.synthesizeNativeMouseEvent({
      type: "click",
      target: downloadsButton,
      atCenter: true,
    });
    await shownPromise;

    is(DownloadsPanel.panel.state, "open", "Check that panel state is 'open'");

    await TestUtils.waitForCondition(
      () => !ChromeUtils.vsyncEnabled(),
      "Make sure vsync disabled"
    );
    // Should not already be using vsync
    ok(!ChromeUtils.vsyncEnabled(), "vsync should be off initially");

    if (
      AppConstants.platform == "linux" &&
      DownloadsPanel.panel.state != "open"
    ) {
      // Panels sometime receive spurious popuphiding events on Linux.
      // Given the main target of this test is Windows, avoid causing
      // intermittent failures and just make the test return early.
      todo(
        false,
        "panel should still be 'open', current state: " +
          DownloadsPanel.panel.state
      );
      return;
    }

    const hiddenPromise = BrowserTestUtils.waitForEvent(
      DownloadsPanel.panel,
      "popuphidden"
    );
    EventUtils.synthesizeKey("VK_ESCAPE", {}, window);
    await hiddenPromise;
    await TestUtils.waitForCondition(
      () => !ChromeUtils.vsyncEnabled(),
      "wait for vsync to be disabled again"
    );

    ok(!ChromeUtils.vsyncEnabled(), "vsync should still be off");
    is(
      DownloadsPanel.panel.state,
      "closed",
      "Check that panel state is 'closed'"
    );
  }
);
