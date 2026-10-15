/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

ChromeUtils.importESModule("resource://services-sync/engines/tabs.sys.mjs");
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

const { SyncScheduler } = ChromeUtils.importESModule(
  "resource://services-sync/policies.sys.mjs"
);

var scheduler = new SyncScheduler(Service);
let clientsEngine;

add_task(async function setup() {
  await Service.promiseInitialized;
  clientsEngine = Service.clientsEngine;

  scheduler.setDefaults();
});

function fakeSvcWinMediator() {
  // actions on windows are captured in logs
  let logs = [];
  delete Services.wm;

  function getNext() {
    let elt = { addTopics: [], remTopics: [], numAPL: 0, numRPL: 0 };
    logs.push(elt);
    return {
      addEventListener(topic) {
        elt.addTopics.push(topic);
      },
      removeEventListener(topic) {
        elt.remTopics.push(topic);
      },
      gBrowser: {
        addProgressListener() {
          elt.numAPL++;
        },
        removeProgressListener() {
          elt.numRPL++;
        },
      },
    };
  }

  Services.wm = {
    getEnumerator() {
      return [getNext(), getNext()];
    },
  };
  return logs;
}

function fakeGetTabState(tab) {
  return tab;
}

function clearQuickWriteTimer(tracker) {
  if (tracker.tabsQuickWriteTimer) {
    tracker.tabsQuickWriteTimer.clear();
  }
}

add_task(async function run_test() {
  let engine = Service.engineManager.get("tabs");
  await engine.initialize();
  _("We assume that tabs have changed at startup.");
  let tracker = engine._tracker;
  tracker.getTabState = fakeGetTabState;

  Assert.ok(tracker.modified);
  Assert.ok(
    Utils.deepEquals(Object.keys(await engine.getChangedIDs()), [
      clientsEngine.localID,
    ])
  );

  let logs;

  _("Test listeners are registered on windows");
  logs = fakeSvcWinMediator();
  tracker.start();
  Assert.equal(logs.length, 2);
  for (let log of logs) {
    Assert.equal(log.addTopics.length, 3);
    Assert.ok(log.addTopics.includes("TabOpen"));
    Assert.ok(log.addTopics.includes("TabClose"));
    Assert.ok(log.addTopics.includes("unload"));
    Assert.equal(log.remTopics.length, 0);
    Assert.equal(log.numAPL, 1, "Added 1 progress listener");
    Assert.equal(log.numRPL, 0, "Didn't remove a progress listener");
  }

  _("Test listeners are unregistered on windows");
  logs = fakeSvcWinMediator();
  await tracker.stop();
  Assert.equal(logs.length, 2);
  for (let log of logs) {
    Assert.equal(log.addTopics.length, 0);
    Assert.equal(log.remTopics.length, 3);
    Assert.ok(log.remTopics.includes("TabOpen"));
    Assert.ok(log.remTopics.includes("TabClose"));
    Assert.ok(log.remTopics.includes("unload"));
    Assert.equal(log.numAPL, 0, "Didn't add a progress listener");
    Assert.equal(log.numRPL, 1, "Removed 1 progress listener");
  }

  _("Test tab listener");
  for (let evttype of ["TabOpen", "TabClose"]) {
    // Pretend we just synced.
    await tracker.clearChangedIDs();
    Assert.ok(!tracker.modified);

    // Send a fake tab event
    tracker.onTab({
      type: evttype,
      originalTarget: evttype,
      target: { entries: [], currentURI: "about:config" },
    });
    Assert.ok(tracker.modified);
    Assert.ok(
      Utils.deepEquals(Object.keys(await engine.getChangedIDs()), [
        clientsEngine.localID,
      ])
    );
  }

  // Pretend we just synced.
  await tracker.clearChangedIDs();
  Assert.ok(!tracker.modified);

  tracker.onTab({
    type: "TabOpen",
    originalTarget: "TabOpen",
    target: { entries: [], currentURI: "about:config" },
  });
  Assert.ok(
    Utils.deepEquals(Object.keys(await engine.getChangedIDs()), [
      clientsEngine.localID,
    ])
  );

  // Pretend we just synced and saw some progress listeners.
  await tracker.clearChangedIDs();
  Assert.ok(!tracker.modified);
  tracker.onLocationChange({ isTopLevel: false }, undefined, undefined, 0);
  Assert.ok(!tracker.modified, "non-toplevel request didn't flag as modified");

  tracker.onLocationChange(
    { isTopLevel: true },
    undefined,
    Services.io.newURI("https://www.mozilla.org"),
    Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT
  );
  Assert.ok(
    tracker.modified,
    "location change within the same document request did flag as modified"
  );

  tracker.onLocationChange(
    { isTopLevel: true },
    undefined,
    Services.io.newURI("https://www.mozilla.org")
  );
  Assert.ok(
    tracker.modified,
    "location change for a new top-level document flagged as modified"
  );
  Assert.ok(
    Utils.deepEquals(Object.keys(await engine.getChangedIDs()), [
      clientsEngine.localID,
    ])
  );
});

add_task(async function run_sync_on_tab_change_test() {
  let testPrefDelay = 20000;

  // This is the pref that determines sync delay after tab change
  Svc.PrefBranch.setIntPref(
    "syncedTabs.syncDelayAfterTabChange",
    testPrefDelay
  );
  // We should only be syncing on tab change if
  // the user has > 1 client
  Svc.PrefBranch.setIntPref("clients.devices.desktop", 1);
  Svc.PrefBranch.setIntPref("clients.devices.mobile", 1);
  scheduler.updateClientMode();
  Assert.equal(scheduler.numClients, 2);

  let engine = Service.engineManager.get("tabs");

  _("We assume that tabs have changed at startup.");
  let tracker = engine._tracker;
  tracker.getTabState = fakeGetTabState;

  Assert.ok(tracker.modified);
  Assert.ok(
    Utils.deepEquals(Object.keys(await engine.getChangedIDs()), [
      clientsEngine.localID,
    ])
  );

  _("Test sync is scheduled after a tab change");
  for (let evttype of ["TabOpen", "TabClose"]) {
    // Pretend we just synced
    await tracker.clearChangedIDs();
    clearQuickWriteTimer(tracker);

    // Send a fake tab event
    tracker.onTab({
      type: evttype,
      originalTarget: evttype,
      target: { entries: [], currentURI: "about:config" },
    });
    // Ensure the tracker fired
    Assert.ok(tracker.modified);
    // We should be more delayed at or more than what the pref is set at
    let nextSchedule = tracker.tabsQuickWriteTimer.delay;
    Assert.greaterOrEqual(nextSchedule, testPrefDelay);
  }

  _("Test sync is NOT scheduled after an unsupported tab open");
  for (let evttype of ["TabOpen"]) {
    // Send a fake tab event
    tracker.onTab({
      type: evttype,
      originalTarget: evttype,
      target: { entries: ["about:newtab"], currentURI: null },
    });
    // Ensure the tracker fired
    Assert.ok(tracker.modified);
    // We should be scheduling <= pref value
    Assert.lessOrEqual(scheduler.nextSync - Date.now(), testPrefDelay);
  }

  _("Test navigating within the same tab does NOT trigger a sync");
  // Pretend we just synced
  await tracker.clearChangedIDs();
  clearQuickWriteTimer(tracker);

  tracker.onLocationChange(
    { isTopLevel: true },
    undefined,
    Services.io.newURI("https://www.mozilla.org"),
    Ci.nsIWebProgressListener.LOCATION_CHANGE_RELOAD
  );
  Assert.ok(
    !tracker.modified,
    "location change for reloading doesn't trigger a sync"
  );
  Assert.ok(!tracker.tabsQuickWriteTimer, "reload does not trigger a sync");

  // Pretend we just synced
  await tracker.clearChangedIDs();
  clearQuickWriteTimer(tracker);

  _("Test navigating to an about page does trigger sync");
  tracker.onLocationChange(
    { isTopLevel: true },
    undefined,
    Services.io.newURI("about:config")
  );
  Assert.ok(tracker.modified, "about page does not trigger a tab modified");
  Assert.ok(
    tracker.tabsQuickWriteTimer,
    "about schema should trigger a sync happening soon"
  );

  _("Test adjusting the filterScheme pref works");
  // Pretend we just synced
  await tracker.clearChangedIDs();
  clearQuickWriteTimer(tracker);

  Svc.PrefBranch.setStringPref(
    "engine.tabs.filteredSchemes",
    // Removing the about scheme for this test
    "resource|chrome|file|blob|moz-extension"
  );
  tracker.onLocationChange(
    { isTopLevel: true },
    undefined,
    Services.io.newURI("about:config")
  );
  Assert.ok(
    tracker.modified,
    "about page triggers a modified after we changed the pref"
  );
  Assert.ok(
    tracker.tabsQuickWriteTimer,
    "about page should schedule a quickWrite sync soon after we changed the pref"
  );

  _("Test no sync after tab change for accounts with <= 1 clients");
  // Pretend we just synced
  await tracker.clearChangedIDs();
  clearQuickWriteTimer(tracker);
  // Setting clients to only 1 so we don't sync after a tab change
  Svc.PrefBranch.setIntPref("clients.devices.desktop", 1);
  Svc.PrefBranch.setIntPref("clients.devices.mobile", 0);
  scheduler.updateClientMode();
  Assert.equal(scheduler.numClients, 1);

  tracker.onLocationChange(
    { isTopLevel: true },
    undefined,
    Services.io.newURI("https://www.mozilla.org")
  );
  Assert.ok(
    tracker.modified,
    "location change for a new top-level document flagged as modified"
  );
  Assert.ok(
    !tracker.tabsQuickWriteTimer,
    "We should NOT be syncing shortly because there is only one client"
  );

  _("Changing the pref adjusts the sync schedule");
  Svc.PrefBranch.setIntPref("syncedTabs.syncDelayAfterTabChange", 10000); // 10seconds
  let delayPref = Svc.PrefBranch.getIntPref(
    "syncedTabs.syncDelayAfterTabChange"
  );
  let evttype = "TabOpen";
  Assert.equal(delayPref, 10000); // ensure our pref is at 10s
  // Only have task continuity if we have more than 1 device
  Svc.PrefBranch.setIntPref("clients.devices.desktop", 1);
  Svc.PrefBranch.setIntPref("clients.devices.mobile", 1);
  scheduler.updateClientMode();
  Assert.equal(scheduler.numClients, 2);
  clearQuickWriteTimer(tracker);

  // Fire ontab event
  tracker.onTab({
    type: evttype,
    originalTarget: evttype,
    target: { entries: [], currentURI: "about:config" },
  });

  // Ensure the tracker fired
  Assert.ok(tracker.modified);
  // We should be scheduling <= preference value
  Assert.equal(tracker.tabsQuickWriteTimer.delay, delayPref);

  _("We should not have a sync scheduled if pref is at 0");

  Svc.PrefBranch.setIntPref("syncedTabs.syncDelayAfterTabChange", 0);
  // Pretend we just synced
  await tracker.clearChangedIDs();
  clearQuickWriteTimer(tracker);

  // Fire ontab event
  evttype = "TabOpen";
  tracker.onTab({
    type: evttype,
    originalTarget: evttype,
    target: { entries: [], currentURI: "about:config" },
  });
  // Ensure the tracker fired
  Assert.ok(tracker.modified);

  // We should NOT be scheduled for a sync soon
  Assert.ok(!tracker.tabsQuickWriteTimer);

  scheduler.setDefaults();
  for (const pref of Svc.PrefBranch.getChildList("")) {
    Svc.PrefBranch.clearUserPref(pref);
  }
});
