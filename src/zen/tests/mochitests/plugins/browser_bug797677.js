var gTestRoot = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content/",
  "http://127.0.0.1:8888/"
);
var gTestBrowser = null;
var gConsoleErrors = 0;

add_task(async function () {
  registerCleanupFunction(function () {
    Services.console.unregisterListener(errorListener);
    gBrowser.removeCurrentTab();
    window.focus();
    gTestBrowser = null;
  });

  gBrowser.selectedTab = BrowserTestUtils.addTab(gBrowser);
  gTestBrowser = gBrowser.selectedBrowser;

  let errorListener = {
    observe(aMessage) {
      if (aMessage.message.includes("NS_ERROR_FAILURE")) {
        gConsoleErrors++;
      }
    },
  };
  Services.console.registerListener(errorListener);

  await BrowserTestUtils.loadURIString({
    browser: gBrowser.selectedTab.linkedBrowser,
    uriString: gTestRoot + "plugin_bug797677.html",
  });

  let pluginInfo = await promiseForPluginInfo("plugin");
  is(
    pluginInfo.displayedType,
    Ci.nsIObjectLoadingContent.TYPE_FALLBACK,
    "plugin should not have been found."
  );

  await SpecialPowers.spawn(gTestBrowser, [], function () {
    let plugin = content.document.getElementById("plugin");
    ok(plugin, "plugin should be in the page");
  });
  is(gConsoleErrors, 0, "should have no console errors");
});
