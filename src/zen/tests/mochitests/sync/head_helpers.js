/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* import-globals-from head_appinfo.js */
/* import-globals-from ../../../common/tests/unit/head_helpers.js */
/* import-globals-from head_errorhandler_common.js */
/* import-globals-from head_http_server.js */

// This file expects Service to be defined in the global scope when EHTestsCommon
// is used (from service.js).
/* global Service */

var { AddonTestUtils, MockAsyncShutdown } = ChromeUtils.importESModule(
  "resource://testing-common/AddonTestUtils.sys.mjs"
);
var { Async } = ChromeUtils.importESModule(
  "resource://services-common/async.sys.mjs"
);
var { CommonUtils } = ChromeUtils.importESModule(
  "resource://services-common/utils.sys.mjs"
);
var { PlacesTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PlacesTestUtils.sys.mjs"
);
var { sinon } = ChromeUtils.importESModule(
  "resource://testing-common/Sinon.sys.mjs"
);
var { SerializableSet, Svc, Utils, getChromeWindow } =
  ChromeUtils.importESModule("resource://services-sync/util.sys.mjs");
var { XPCOMUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/XPCOMUtils.sys.mjs"
);
var { PlacesUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/PlacesUtils.sys.mjs"
);
var { PlacesSyncUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/PlacesSyncUtils.sys.mjs"
);
var { ObjectUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/ObjectUtils.sys.mjs"
);
var {
  MockFxaStorageManager,
  SyncTestingInfrastructure,
  configureFxAccountIdentity,
  configureIdentity,
  encryptPayload,
  getLoginTelemetryScalar,
  makeFxAccountsInternalMock,
  makeIdentityConfig,
  promiseNamedTimer,
  promiseZeroTimer,
  sumHistogram,
  syncTestLogging,
  waitForZeroTimer,
} = ChromeUtils.importESModule(
  "resource://testing-common/services/sync/utils.sys.mjs"
);
ChromeUtils.defineESModuleGetters(this, {
  AddonManager: "resource://gre/modules/AddonManager.sys.mjs",
});

add_setup(async function head_setup() {
  // Initialize logging. This will sometimes be reset by a pref reset,
  // so it's also called as part of SyncTestingInfrastructure().
  syncTestLogging();
  // If a test imports Service, make sure it is initialized first.
  if (typeof Service !== "undefined") {
    await Service.promiseInitialized;
  }
});

// This is needed for loadAddonTestFunctions().
var gGlobalScope = this;

function ExtensionsTestPath(path) {
  if (path[0] != "/") {
    throw Error("Path must begin with '/': " + path);
  }

  return "../../../../toolkit/mozapps/extensions/test/xpcshell" + path;
}

function webExtensionsTestPath(path) {
  if (path[0] != "/") {
    throw Error("Path must begin with '/': " + path);
  }

  return "../../../../toolkit/components/extensions/test/xpcshell" + path;
}

/**
 * Loads the WebExtension test functions by importing its test file.
 */
function loadWebExtensionTestFunctions() {
  /* import-globals-from ../../../../toolkit/components/extensions/test/xpcshell/head_sync.js */
  const path = webExtensionsTestPath("/head_sync.js");
  let file = do_get_file(path);
  let uri = Services.io.newFileURI(file);
  Services.scriptloader.loadSubScript(uri.spec, gGlobalScope);
}

/**
 * Installs an add-on from an addonInstall
 *
 * @param  install addonInstall instance to install
 */
async function installAddonFromInstall(install) {
  await install.install();

  Assert.notEqual(null, install.addon);
  Assert.notEqual(null, install.addon.syncGUID);

  return install.addon;
}

/**
 * Convenience function to install an add-on from the extensions unit tests.
 *
 * @param  file
 *         Add-on file to install.
 * @param  reconciler
 *         addons reconciler, if passed we will wait on the events to be
 *         processed before resolving
 * @return addon object that was installed
 */
async function installAddon(file, reconciler = null) {
  let install = await AddonManager.getInstallForFile(file);
  Assert.notEqual(null, install);
  const addon = await installAddonFromInstall(install);
  if (reconciler) {
    await reconciler.queueCaller.promiseCallsComplete();
  }
  return addon;
}

/**
 * Convenience function to uninstall an add-on.
 *
 * @param addon
 *        Addon instance to uninstall
 * @param reconciler
 *        addons reconciler, if passed we will wait on the events to be
 *        processed before resolving
 */
async function uninstallAddon(addon, reconciler = null) {
  const uninstallPromise = new Promise(res => {
    let listener = {
      onUninstalled(uninstalled) {
        if (uninstalled.id == addon.id) {
          AddonManager.removeAddonListener(listener);
          res(uninstalled);
        }
      },
    };
    AddonManager.addAddonListener(listener);
  });
  addon.uninstall();
  await uninstallPromise;
  if (reconciler) {
    await reconciler.queueCaller.promiseCallsComplete();
  }
}

async function generateNewKeys(collectionKeys, collections = null) {
  let wbo = await collectionKeys.generateNewKeysWBO(collections);
  let modified = new_timestamp();
  collectionKeys.setContents(wbo.cleartext, modified);
}

// Helpers for testing open tabs.
// These reflect part of the internal structure of TabEngine,
// and stub part of Service.wm.

function mockGetTabState(tab) {
  return tab;
}

function mockGetOrderedNonPrivateWindows(urls) {
  let tabs = [];
  let win = {
    gBrowser: {
      tabs,
    },
  };

  let lastAccessed = 2000;
  for (let url of urls) {
    tabs.push({
      linkedBrowser: {
        currentURI: Services.io.newURI(url),
        contentTitle: "title",
      },
      lastAccessed,
    });
    lastAccessed += 1000;
  }

  return [win];
}

// Helper function to get the sync telemetry and add the typically used test
// engine names to its list of allowed engines.
function get_sync_test_telemetry() {
  let { SyncTelemetry } = ChromeUtils.importESModule(
    "resource://services-sync/telemetry.sys.mjs"
  );
  SyncTelemetry.tryRefreshDevices = function () {};
  let testEngines = ["rotary", "steam", "sterling", "catapult", "nineties"];
  for (let engineName of testEngines) {
    SyncTelemetry.allowedEngines.add(engineName);
  }
  SyncTelemetry.submissionInterval = -1;
  return SyncTelemetry;
}

function assert_valid_ping(record) {
  if (record && (record.why != "shutdown" || !!record.syncs.length)) {
    record.syncs.forEach(p => {
      lessOrEqual(p.when, Date.now());
    });
  }
}

function assert_success_sync(record) {
  ok(!record.failureReason, JSON.stringify(record.failureReason));
  equal(undefined, record.status);
  greater(record.engines.length, 0);
  for (let e of record.engines) {
    ok(!e.failureReason);
    equal(undefined, e.status);
    if (e.validation) {
      equal(undefined, e.validation.problems);
      equal(undefined, e.validation.failureReason);
    }
    if (e.outgoing) {
      for (let o of e.outgoing) {
        equal(undefined, o.failed);
        notEqual(undefined, o.sent);
      }
    }
    if (e.incoming) {
      equal(undefined, e.incoming.failed);
      equal(undefined, e.incoming.newFailed);
      notEqual(undefined, e.incoming.applied || e.incoming.reconciled);
    }
  }
}

// Asserts that `ping` is a ping that doesn't contain any failure information
function assert_success_ping(ping) {
  ok(!!ping);
  assert_valid_ping(ping);
  ping.syncs.forEach(assert_success_sync);
}

// Hooks into telemetry to validate all pings after calling.
function validate_all_future_pings() {
  let telem = get_sync_test_telemetry();
  telem.submit = assert_valid_ping;
}

function wait_for_pings(expectedPings) {
  return new Promise(resolve => {
    let telem = get_sync_test_telemetry();
    let oldSubmit = telem.submit;
    let pings = [];
    telem.submit = function (record) {
      pings.push(record);
      if (pings.length == expectedPings) {
        telem.submit = oldSubmit;
        resolve(pings);
      }
    };
  });
}

async function wait_for_ping(callback, allowErrorPings, getFullPing = false) {
  let pingsPromise = wait_for_pings(1);
  await callback();
  let [record] = await pingsPromise;
  if (allowErrorPings) {
    assert_valid_ping(record);
  } else {
    assert_success_ping(record);
  }
  if (getFullPing) {
    return record;
  }
  equal(record.syncs.length, 1);
  return record.syncs[0];
}

// Perform a sync and validate all telemetry caused by the sync. If fnValidate
// is null, we just check the ping records success. If fnValidate is specified,
// then the sync must have recorded just a single sync, and that sync will be
// passed to the function to be checked.
async function sync_and_validate_telem(
  fnValidate = null,
  wantFullPing = false
) {
  let numErrors = 0;
  let telem = get_sync_test_telemetry();
  let oldSubmit = telem.submit;
  try {
    telem.submit = function (record) {
      // This is called via an observer, so failures here don't cause the test
      // to fail :(
      try {
        // All pings must be valid.
        assert_valid_ping(record);
        if (fnValidate) {
          // for historical reasons most of these callbacks expect a "sync"
          // record, not the entire ping.
          if (wantFullPing) {
            fnValidate(record);
          } else {
            Assert.equal(record.syncs.length, 1);
            fnValidate(record.syncs[0]);
          }
        } else {
          // no validation function means it must be a "success" ping.
          assert_success_ping(record);
        }
      } catch (ex) {
        print("Failure in ping validation callback", ex, "\n", ex.stack);
        numErrors += 1;
      }
    };
    await Service.sync();
    Assert.equal(numErrors, 0, "There were telemetry validation errors");
  } finally {
    telem.submit = oldSubmit;
  }
}

// Used for the (many) cases where we do a 'partial' sync, where only a single
// engine is actually synced, but we still want to ensure we're generating a
// valid ping. Returns a promise that resolves to the ping, or rejects with the
// thrown error after calling an optional callback.
async function sync_engine_and_validate_telem(
  engine,
  allowErrorPings,
  onError,
  wantFullPing = false
) {
  let telem = get_sync_test_telemetry();
  let caughtError = null;
  // Clear out status, so failures from previous syncs won't show up in the
  // telemetry ping.
  let { Status } = ChromeUtils.importESModule(
    "resource://services-sync/status.sys.mjs"
  );
  Status._engines = {};
  Status.partial = false;
  // Ideally we'd clear these out like we do with engines, (probably via
  // Status.resetSync()), but this causes *numerous* tests to fail, so we just
  // assume that if no failureReason or engine failures are set, and the
  // status properties are the same as they were initially, that it's just
  // a leftover.
  // This is only an issue since we're triggering the sync of just one engine,
  // without doing any other parts of the sync.
  let initialServiceStatus = Status._service;
  let initialSyncStatus = Status._sync;

  let oldSubmit = telem.submit;
  let submitPromise = new Promise((resolve, reject) => {
    telem.submit = function (ping) {
      telem.submit = oldSubmit;
      ping.syncs.forEach(record => {
        if (record && record.status) {
          // did we see anything to lead us to believe that something bad actually happened
          let realProblem =
            record.failureReason ||
            record.engines.some(e => {
              if (e.failureReason || e.status) {
                return true;
              }
              if (e.outgoing && e.outgoing.some(o => o.failed > 0)) {
                return true;
              }
              return e.incoming && e.incoming.failed;
            });
          if (!realProblem) {
            // no, so if the status is the same as it was initially, just assume
            // that its leftover and that we can ignore it.
            if (record.status.sync && record.status.sync == initialSyncStatus) {
              delete record.status.sync;
            }
            if (
              record.status.service &&
              record.status.service == initialServiceStatus
            ) {
              delete record.status.service;
            }
            if (!record.status.sync && !record.status.service) {
              delete record.status;
            }
          }
        }
      });
      if (allowErrorPings) {
        assert_valid_ping(ping);
      } else {
        assert_success_ping(ping);
      }
      equal(ping.syncs.length, 1);
      if (caughtError) {
        if (onError) {
          onError(ping.syncs[0], ping);
        }
        reject(caughtError);
      } else if (wantFullPing) {
        resolve(ping);
      } else {
        resolve(ping.syncs[0]);
      }
    };
  });
  // neuter the scheduler as it interacts badly with some of the tests - the
  // engine being synced usually isn't the registered engine, so we see
  // scored incremented and not removed, which schedules unexpected syncs.
  let oldObserve = Service.scheduler.observe;
  Service.scheduler.observe = () => {};
  try {
    Svc.Obs.notify("weave:service:sync:start");
    try {
      await engine.sync();
    } catch (e) {
      caughtError = e;
    }
    if (caughtError) {
      Svc.Obs.notify("weave:service:sync:error", caughtError);
    } else {
      Svc.Obs.notify("weave:service:sync:finish");
    }
  } finally {
    Service.scheduler.observe = oldObserve;
  }
  return submitPromise;
}

// Returns a promise that resolves once the specified observer notification
// has fired.
function promiseOneObserver(topic) {
  return new Promise(resolve => {
    let observer = function (subject, data) {
      Svc.Obs.remove(topic, observer);
      resolve({ subject, data });
    };
    Svc.Obs.add(topic, observer);
  });
}

async function registerRotaryEngine() {
  let { RotaryEngine } = ChromeUtils.importESModule(
    "resource://testing-common/services/sync/rotaryengine.sys.mjs"
  );
  await Service.engineManager.clear();

  await Service.engineManager.register(RotaryEngine);
  let engine = Service.engineManager.get("rotary");
  let syncID = await engine.resetLocalSyncID();
  engine.enabled = true;

  return { engine, syncID, tracker: engine._tracker };
}

// Set the validation prefs to attempt validation every time to avoid non-determinism.
function enableValidationPrefs(engines = ["bookmarks"]) {
  for (let engine of engines) {
    Svc.PrefBranch.setIntPref(`engine.${engine}.validation.interval`, 0);
    Svc.PrefBranch.setIntPref(
      `engine.${engine}.validation.percentageChance`,
      100
    );
    Svc.PrefBranch.setIntPref(`engine.${engine}.validation.maxRecords`, -1);
    Svc.PrefBranch.setBoolPref(`engine.${engine}.validation.enabled`, true);
  }
}

async function serverForEnginesWithKeys(users, engines, callback) {
  // Generate and store a fake default key bundle to avoid resetting the client
  // before the first sync.
  let wbo = await Service.collectionKeys.generateNewKeysWBO();
  let modified = new_timestamp();
  Service.collectionKeys.setContents(wbo.cleartext, modified);

  let allEngines = [Service.clientsEngine].concat(engines);

  let globalEngines = {};
  for (let engine of allEngines) {
    let syncID = await engine.resetLocalSyncID();
    globalEngines[engine.name] = { version: engine.version, syncID };
  }

  let contents = {
    meta: {
      global: {
        syncID: Service.syncID,
        storageVersion: STORAGE_VERSION,
        engines: globalEngines,
      },
    },
    crypto: {
      keys: encryptPayload(wbo.cleartext),
    },
  };
  for (let engine of allEngines) {
    contents[engine.name] = {};
  }

  return serverForUsers(users, contents, callback);
}

async function serverForFoo(engine, callback) {
  // The bookmarks engine *always* tracks changes, meaning we might try
  // and sync due to the bookmarks we ourselves create! Worse, because we
  // do an engine sync only, there's no locking - so we end up with multiple
  // syncs running. Neuter that by making the threshold very large.
  Service.scheduler.syncThreshold = 10000000;
  return serverForEnginesWithKeys({ foo: "password" }, engine, callback);
}

// Places notifies history observers asynchronously, so `addVisits` might return
// before the tracker receives the notification. This helper registers an
// observer that resolves once the expected notification fires.
async function promiseVisit(expectedType, expectedURI) {
  return new Promise(resolve => {
    function done(type, uri) {
      if (uri == expectedURI.spec && type == expectedType) {
        PlacesObservers.removeListener(
          ["page-visited", "page-removed"],
          observer.handlePlacesEvents
        );
        resolve();
      }
    }
    let observer = {
      handlePlacesEvents(events) {
        Assert.equal(events.length, 1);

        if (events[0].type === "page-visited") {
          done("added", events[0].url);
        } else if (events[0].type === "page-removed") {
          Assert.ok(events[0].isRemovedFromStore);
          done("removed", events[0].url);
        }
      },
    };
    PlacesObservers.addListener(
      ["page-visited", "page-removed"],
      observer.handlePlacesEvents
    );
  });
}

async function addVisit(
  suffix,
  referrer = null,
  transition = PlacesUtils.history.TRANSITION_LINK
) {
  let uriString = "http://getfirefox.com/" + suffix;
  let uri = CommonUtils.makeURI(uriString);
  _("Adding visit for URI " + uriString);

  let visitAddedPromise = promiseVisit("added", uri);
  await PlacesTestUtils.addVisits({
    uri,
    visitDate: Date.now() * 1000,
    transition,
    referrer,
  });
  await visitAddedPromise;

  return uri;
}

function bookmarkNodesToInfos(nodes) {
  return nodes.map(node => {
    let info = {
      guid: node.guid,
      index: node.index,
    };
    if (node.children) {
      info.children = bookmarkNodesToInfos(node.children);
    }
    return info;
  });
}

async function assertBookmarksTreeMatches(rootGuid, expected, message) {
  let root = await PlacesUtils.promiseBookmarksTree(rootGuid, {
    includeItemIds: true,
  });
  let actual = bookmarkNodesToInfos(root.children);

  if (!ObjectUtils.deepEqual(actual, expected)) {
    _(`Expected structure for ${rootGuid}`, JSON.stringify(expected));
    _(`Actual structure for ${rootGuid}`, JSON.stringify(actual));
    throw new Assert.constructor.AssertionError({ actual, expected, message });
  }
}

function add_bookmark_test(task) {
  const { BookmarksEngine } = ChromeUtils.importESModule(
    "resource://services-sync/engines/bookmarks.sys.mjs"
  );

  add_task(async function () {
    _(`Running bookmarks test ${task.name}`);
    let engine = new BookmarksEngine(Service);
    await engine.initialize();
    await engine._resetClient();
    try {
      await task(engine);
    } finally {
      await engine.finalize();
    }
  });
}
