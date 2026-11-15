/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Glance_Basic_Open() {
  await openGlanceOnTab(async glanceTab => {
    ok(
      glanceTab.hasAttribute("zen-glance-tab"),
      "The glance tab should have the zen-glance-tab attribute"
    );
  });
});

add_task(async function test_Glance_From_Popup_Opens_A_Tab() {
  const url = "https://example.org/browser/";
  const popupOpened = BrowserTestUtils.waitForNewWindow({
    url: "https://example.com/",
  });
  await SpecialPowers.spawn(gBrowser.selectedBrowser, [], () => {
    content.eval(
      `window.open("https://example.com/", "_blank", "width=400,height=300")`
    );
  });
  const popup = await popupOpened;
  await popup.gZenStartup.promiseInitialized;
  ok(
    popup.document.documentElement.hasAttribute("popup-window"),
    "The window is a popup"
  );
  const popupTabs = popup.gBrowser.tabs.length;

  const opened = BrowserTestUtils.waitForNewTab(gBrowser, url);
  await popup.gZenGlanceManager.openGlance({
    url,
    clientX: 0,
    clientY: 0,
    width: 0,
    height: 0,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });
  const tab = await opened;
  ok(
    !tab.hasAttribute("zen-glance-tab"),
    "A glance asked for in a popup is a plain tab in a regular window"
  );
  is(popup.gBrowser.tabs.length, popupTabs, "And nothing in the popup");

  BrowserTestUtils.removeTab(tab);
  await BrowserTestUtils.closeWindow(popup);
});
