/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* This test records which services, frame scripts, process scripts, and
 * JS modules are loaded when creating a new content process.
 *
 * If you made changes that cause this test to fail, it's likely because you
 * are loading more JS code during content process startup. Please try to
 * avoid this.
 *
 * If your code isn't strictly required to show a page, consider loading it
 * lazily. If you can't, consider delaying its load until after we have started
 * handling user events.
 */

"use strict";

/* Set this to true only for debugging purpose; it makes the output noisy. */
const kDumpAllStacks = false;

const known_scripts = {
  modules: new Set([
    "chrome://mochikit/content/ShutdownLeaksCollector.sys.mjs",

    // General utilities
    "resource://gre/modules/AppConstants.sys.mjs",
    "resource://gre/modules/Timer.sys.mjs",
    "resource://gre/modules/XPCOMUtils.sys.mjs",

    // Logging related
    // eslint-disable-next-line mozilla/use-console-createInstance
    "resource://gre/modules/Log.sys.mjs",

    // Browser front-end
    "resource:///actors/AboutReaderChild.sys.mjs",
    "resource:///actors/InteractionsChild.sys.mjs",
    "resource:///actors/LinkHandlerChild.sys.mjs",
    "resource:///actors/SearchSERPTelemetryChild.sys.mjs",
    "moz-src:///toolkit/actors/ContentMetaChild.sys.mjs",
    "resource://gre/modules/Readerable.sys.mjs",

    // Telemetry
    "resource://gre/modules/TelemetryControllerBase.sys.mjs", // bug 1470339
    "resource://gre/modules/TelemetryControllerContent.sys.mjs", // bug 1470339

    // Extensions
    "resource://gre/modules/ExtensionProcessScript.sys.mjs",
    "resource://gre/modules/ExtensionUtils.sys.mjs",

    // Enterprise policies
    "resource://gre/modules/EnterprisePolicies.sys.mjs",
    "resource://gre/modules/EnterprisePoliciesContent.sys.mjs",
  ]),
  frameScripts: new Set([
    // Test related
    "chrome://mochikit/content/shutdown-leaks-collector.js",
  ]),
  processScripts: new Set([
    "chrome://global/content/process-content.js",
    "resource://gre/modules/extensionProcessScriptLoader.js",
  ]),
};

// Items on this list *might* load when creating the process, as opposed to
// items in the main list, which we expect will always load.
const intermittently_loaded_scripts = {
  modules: new Set([
    "resource://gre/modules/nsAsyncShutdown.sys.mjs",

    // Translations code which may be preffed on.
    "resource://gre/actors/TranslationsChild.sys.mjs",
    "resource://gre/modules/translations/LanguageDetector.sys.mjs",
    "resource://gre/modules/ConsoleAPIStorage.sys.mjs", // Logging related.

    // Session store.
    "resource://gre/modules/sessionstore/SessionHistory.sys.mjs",

    "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",

    // Canonical URL detection behind pref `browser.tabs.notes.enabled`
    "resource:///actors/CanonicalURLChild.sys.mjs",
    "moz-src:///browser/components/tabnotes/CanonicalURL.sys.mjs",

    // Test related
    "chrome://remote/content/marionette/actors/MarionetteEventsChild.sys.mjs",
    "chrome://remote/content/shared/Log.sys.mjs",
    "resource://testing-common/BrowserTestUtilsChild.sys.mjs",
    "resource://testing-common/ContentEventListenerChild.sys.mjs",
    "resource://specialpowers/AppTestDelegateChild.sys.mjs",
    "resource://testing-common/SpecialPowersChild.sys.mjs",
    "resource://testing-common/WrapPrivileged.sys.mjs",
  ]),
  frameScripts: new Set([]),
  processScripts: new Set([]),
};

const forbiddenScripts = {
  services: new Set([
    "@mozilla.org/base/telemetry-startup;1",
    "@mozilla.org/embedcomp/default-tooltiptextprovider;1",
    "@mozilla.org/push/Service;1",
  ]),
};

add_task(async function () {
  SimpleTest.requestCompleteLog();

  let tab = await BrowserTestUtils.openNewForegroundTab({
    gBrowser,
    url:
      getRootDirectory(gTestPath).replace(
        "chrome://mochitests/content",
        "https://example.com"
      ) + "file_empty.html",
    forceNewProcess: true,
  });

  let mm = gBrowser.selectedBrowser.messageManager;
  let promise = BrowserTestUtils.waitForMessage(mm, "Test:LoadedScripts");

  // Load a custom frame script to avoid using SpecialPowers.spawn which may
  // load other modules.
  mm.loadFrameScript(
    "data:text/javascript,(" +
      function () {
        const Cm = Components.manager;
        Cm.QueryInterface(Ci.nsIServiceManager);
        const { AppConstants } = ChromeUtils.importESModule(
          "resource://gre/modules/AppConstants.sys.mjs"
        );
        let collectStacks = AppConstants.NIGHTLY_BUILD || AppConstants.DEBUG;
        let modules = new Map();
        for (let module of Cu.loadedESModules) {
          modules.set(
            module,
            collectStacks ? Cu.getModuleImportStack(module) : ""
          );
        }
        let services = new Map();
        for (let contractID of Object.keys(Cc)) {
          try {
            if (
              Cm.isServiceInstantiatedByContractID(contractID, Ci.nsISupports)
            ) {
              services.set(contractID, "");
            }
          } catch (e) {}
        }
        sendAsyncMessage("Test:LoadedScripts", {
          modules,
          services,
        });
      } +
      ")()",
    false
  );

  let loadedInfo = await promise;

  // Gather loaded frame scripts.
  loadedInfo.frameScripts = new Map();
  for (let [uri] of Services.mm.getDelayedFrameScripts()) {
    loadedInfo.frameScripts.set(uri, "");
  }

  // Gather loaded process scripts.
  loadedInfo.processScripts = new Map();
  for (let [uri] of Services.ppmm.getDelayedProcessScripts()) {
    loadedInfo.processScripts.set(uri, "");
  }

  await checkLoadedScripts({
    loadedInfo,
    known: known_scripts,
    intermittent: intermittently_loaded_scripts,
    forbidden: forbiddenScripts,
    dumpAllStacks: kDumpAllStacks,
  });

  BrowserTestUtils.removeTab(tab);
});
