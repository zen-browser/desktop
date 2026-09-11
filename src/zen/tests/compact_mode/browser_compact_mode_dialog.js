/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_popup_tracking_clears_after_close_warning() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.tabs.warnOnClose", true],
      ["browser.warnOnQuit", true],
    ],
  });
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:blank"
  );
  const toolbar = document.getElementById("zen-appcontent-navbar-wrapper");
  const popupAnchor = document.getElementById("PanelUI-menu-button");
  const popup = document.createXULElement("menupopup");
  let trackedToolbar;
  Assert.ok(
    toolbar.contains(popupAnchor),
    "The popup anchor should be inside a tracked toolbar"
  );
  registerCleanupFunction(() => {
    if (gZenUIManager.__removeHasPopupAttribute) {
      document.removeEventListener(
        "mousemove",
        gZenUIManager.__removeHasPopupAttribute
      );
      gZenUIManager.__removeHasPopupAttribute();
      gZenUIManager.__removeHasPopupAttribute = null;
    }
    gZenUIManager.__currentPopup = null;
    gZenUIManager.__currentPopupTrackElement = null;
    if (tab.isConnected) {
      BrowserTestUtils.removeTab(tab);
    }
    trackedToolbar?.removeAttribute("has-popup-menu");
  });

  const dialogClosed = BrowserTestUtils.promiseAlertDialog("", undefined, {
    callback(dialogWindow) {
      gZenUIManager.onPopupShowing({
        explicitOriginalTarget: popupAnchor,
        target: popup,
      });
      trackedToolbar = gZenUIManager.__currentPopupTrackElement;
      Assert.ok(
        trackedToolbar?.hasAttribute("has-popup-menu"),
        "Opening a toolbar popup should set the tracking attribute"
      );

      const mainWindow = document.getElementById("main-window");
      const matches = mainWindow.matches;
      Object.defineProperty(mainWindow, "matches", {
        configurable: true,
        value(selector) {
          return selector === ":hover"
            ? false
            : matches.call(mainWindow, selector);
        },
      });
      try {
        gZenUIManager.onPopupHidden({ target: popup });
      } finally {
        delete mainWindow.matches;
      }
      Assert.ok(
        trackedToolbar.hasAttribute("has-popup-menu"),
        "Popup cleanup should be deferred while the modal owns hover"
      );
      dialogWindow.document.querySelector("dialog").getButton("cancel").click();
    },
  });
  BrowserCommands.tryToCloseWindow();
  await dialogClosed;

  Assert.ok(
    !trackedToolbar.hasAttribute("has-popup-menu"),
    "Closing the warning clears the stale toolbar popup state"
  );
  BrowserTestUtils.removeTab(tab);
});
