/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

function test() {
  Services.prefs.setBoolPref("browser.sessionstore.restore_on_demand", true);
  BrowserTestUtils.addTab(gBrowser, "about:mozilla");

  ss.setTabState(gBrowser.tabs[1], ss.getTabState(gBrowser.tabs[1]));
  ok(
    gBrowser.tabs[1].hasAttribute("pending"),
    "second tab should have 'pending' attribute"
  );

  gBrowser.selectedTab = gBrowser.tabs[1];
  ok(
    !gBrowser.tabs[1].hasAttribute("pending"),
    "second tab should have not 'pending' attribute"
  );

  gBrowser.removeTab(gBrowser.tabs[1]);
  Services.prefs.clearUserPref("browser.sessionstore.restore_on_demand");
}
