/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* This test records which services, JS components, frame scripts, process
 * scripts, and JS modules are loaded when creating a new content process for a
 * subframe.
 *
 * If you made changes that cause this test to fail, it's likely because you
 * are loading more JS code during content process startup. Please try to
 * avoid this.
 *
 * If your code isn't strictly required to show an iframe, consider loading it
 * lazily. If you can't, consider delaying its load until after we have started
 * handling user events.
 *
 * This test differs from browser_startup_content.js in that it tests a process
 * with no toplevel browsers opened, but with a single subframe document
 * loaded. This leads to a different set of scripts being loaded.
 */

"use strict";

const actorModuleURI =
  getRootDirectory(gTestPath) + "StartupContentSubframe.sys.mjs";
const subframeURI =
  getRootDirectory(gTestPath).replace(
    "chrome://mochitests/content",
    "https://example.com"
  ) + "file_empty.html";

// Set this to true only for debugging purpose; it makes the output noisy.
const kDumpAllStacks = false;

const known_scripts = {
  modules: new Set([
    // Loaded by this test
    actorModuleURI,

    // General utilities
    "resource://gre/modules/AppConstants.sys.mjs",
    "resource://gre/modules/XPCOMUtils.sys.mjs",

    // Logging related
    // eslint-disable-next-line mozilla/use-console-createInstance
    "resource://gre/modules/Log.sys.mjs",

    // Telemetry
    "resource://gre/modules/TelemetryControllerBase.sys.mjs", // bug 1470339
    "resource://gre/modules/TelemetryControllerContent.sys.mjs", // bug 1470339

    // Extensions
    "resource://gre/modules/ExtensionProcessScript.sys.mjs",
    "resource://gre/modules/ExtensionUtils.sys.mjs",
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

    "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",

    // Test related
    "chrome://remote/content/marionette/actors/MarionetteEventsChild.sys.mjs",
    "chrome://remote/content/shared/Log.sys.mjs",
    "resource://testing-common/BrowserTestUtilsChild.sys.mjs",
    "resource://testing-common/ContentEventListenerChild.sys.mjs",
    "resource://testing-common/SpecialPowersChild.sys.mjs",
    "resource://specialpowers/AppTestDelegateChild.sys.mjs",
    "resource://testing-common/WrapPrivileged.sys.mjs",
  ]),
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

  // Increase the maximum number of webIsolated content processes to make sure
  // our newly-created iframe is spawned into a new content process.
  //
  // Unfortunately, we don't have something like `forceNewProcess` for subframe
  // loads.
  await SpecialPowers.pushPrefEnv({
    set: [["dom.ipc.processCount.webIsolated", 10]],
  });
  Services.ppmm.releaseCachedProcesses();

  // Register a custom window actor which will send us a notification when the
  // script loading information is available.
  ChromeUtils.registerWindowActor("StartupContentSubframe", {
    parent: {
      esModuleURI: actorModuleURI,
    },
    child: {
      esModuleURI: actorModuleURI,
      events: {
        load: { mozSystemGroup: true, capture: true },
      },
    },
    matches: [subframeURI],
    allFrames: true,
    safeForUntrustedWebProcess: true,
  });

  // Create a tab, and load a remote subframe with the specific URI in it.
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser);

  SpecialPowers.spawn(tab.linkedBrowser, [subframeURI], uri => {
    let iframe = content.document.createElement("iframe");
    iframe.src = uri;
    content.document.body.appendChild(iframe);
  });

  // Wait for the reply to come in, remove the XPCOM wrapper, and unregister our actor.
  let [subject] = await TestUtils.topicObserved(
    "startup-content-subframe-loaded-scripts"
  );
  let loadedInfo = subject.wrappedJSObject;

  ChromeUtils.unregisterWindowActor("StartupContentSubframe");
  BrowserTestUtils.removeTab(tab);

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
});
