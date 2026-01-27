/* Ensure that hostnames in the whitelisted pref are not blocked. */

const PREF_WHITELISTED_HOSTNAMES = "urlclassifier.skipHostnames";
const TEST_PAGE = "http://www.itisatrap.org/firefox/its-an-attack.html";
var tabbrowser = null;

registerCleanupFunction(function () {
  tabbrowser = null;
  Services.prefs.clearUserPref(PREF_WHITELISTED_HOSTNAMES);
  while (gBrowser.tabs.length > 1) {
    gBrowser.removeCurrentTab();
  }
});

function testBlockedPage() {
  info("Non-whitelisted pages must be blocked");
  ok(true, "about:blocked was shown");
}

function testWhitelistedPage(window) {
  info("Whitelisted pages must be skipped");
  var getmeout_button = window.document.getElementById("getMeOutButton");
  var ignorewarning_button = window.document.getElementById(
    "ignoreWarningButton"
  );
  ok(!getmeout_button, "GetMeOut button not present");
  ok(!ignorewarning_button, "IgnoreWarning button not present");
}

add_task(async function testNormalBrowsing() {
  tabbrowser = gBrowser;
  let tab = (tabbrowser.selectedTab = BrowserTestUtils.addTab(tabbrowser));

  info("Load a test page that's whitelisted");
  Services.prefs.setCharPref(
    PREF_WHITELISTED_HOSTNAMES,
    "example.com,www.ItIsaTrap.org,example.net"
  );
  await promiseTabLoadEvent(tab, TEST_PAGE, "load");
  testWhitelistedPage(tab.ownerGlobal);

  info("Load a test page that's no longer whitelisted");
  Services.prefs.setCharPref(PREF_WHITELISTED_HOSTNAMES, "");
  await promiseTabLoadEvent(tab, TEST_PAGE, "AboutBlockedLoaded");
  testBlockedPage(tab.ownerGlobal);
});
