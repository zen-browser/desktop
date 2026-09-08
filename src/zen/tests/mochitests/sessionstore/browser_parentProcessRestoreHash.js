"use strict";

const SELFCHROMEURL =
  "chrome://mochitests/content/browser/browser/" +
  "components/sessionstore/test/browser_parentProcessRestoreHash.js";

const Cm = Components.manager;

const TESTCLASSID = "78742c04-3630-448c-9be3-6c5070f062de";

const TESTURL = "about:testpageforsessionrestore#foo";

let TestAboutPage = {
  QueryInterface: ChromeUtils.generateQI(["nsIAboutModule"]),
  getURIFlags() {
    // No CAN_ or MUST_LOAD_IN_CHILD means this loads in the parent:
    return (
      Ci.nsIAboutModule.ALLOW_SCRIPT |
      Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT |
      Ci.nsIAboutModule.HIDE_FROM_ABOUTABOUT
    );
  },

  newChannel(aURI, aLoadInfo) {
    // about: page inception!
    let newURI = Services.io.newURI(SELFCHROMEURL);
    let channel = Services.io.newChannelFromURIWithLoadInfo(newURI, aLoadInfo);
    channel.originalURI = aURI;
    return channel;
  },

  createInstance(iid) {
    return this.QueryInterface(iid);
  },

  register() {
    Cm.QueryInterface(Ci.nsIComponentRegistrar).registerFactory(
      Components.ID(TESTCLASSID),
      "Only here for a test",
      "@mozilla.org/network/protocol/about;1?what=testpageforsessionrestore",
      this
    );
  },

  unregister() {
    Cm.QueryInterface(Ci.nsIComponentRegistrar).unregisterFactory(
      Components.ID(TESTCLASSID),
      this
    );
  },
};

/**
 * Test that switching from a remote to a parent process browser
 * correctly clears the userTypedValue
 */
add_task(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["dom.security.skip_about_page_has_csp_assert", true]],
  });

  TestAboutPage.register();
  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "http://example.com/",
    true,
    true
  );
  ok(tab.linkedBrowser.isRemoteBrowser, "Browser should be remote");

  let resolveLocationChangePromise;
  let locationChangePromise = new Promise(
    r => (resolveLocationChangePromise = r)
  );
  let wpl = {
    onStateChange(listener, request, state, _status) {
      let location = request.QueryInterface(Ci.nsIChannel).originalURI;
      // Ignore about:blank loads.
      let docStop =
        Ci.nsIWebProgressListener.STATE_STOP |
        Ci.nsIWebProgressListener.STATE_IS_NETWORK;
      if (location.spec == "about:blank" || (state & docStop) != docStop) {
        return;
      }
      is(location.spec, TESTURL, "Got the expected URL");
      resolveLocationChangePromise();
    },
  };
  gBrowser.addProgressListener(wpl);

  gURLBar.value = TESTURL;
  gURLBar.select();
  EventUtils.sendKey("return");

  await locationChangePromise;

  ok(!tab.linkedBrowser.isRemoteBrowser, "Browser should no longer be remote");

  is(gURLBar.value, TESTURL, "URL bar visible value should be correct.");
  is(gURLBar.untrimmedValue, TESTURL, "URL bar value should be correct.");
  is(
    gURLBar.getAttribute("pageproxystate"),
    "valid",
    "URL bar is in valid page proxy state"
  );

  ok(
    !tab.linkedBrowser.userTypedValue,
    "No userTypedValue should be on the browser."
  );

  BrowserTestUtils.removeTab(tab);
  gBrowser.removeProgressListener(wpl);
  TestAboutPage.unregister();
});
