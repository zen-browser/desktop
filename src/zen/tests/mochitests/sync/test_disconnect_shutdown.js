/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { SyncDisconnect, SyncDisconnectInternal } = ChromeUtils.importESModule(
  "resource://services-sync/SyncDisconnect.sys.mjs"
);
const { AsyncShutdown } = ChromeUtils.importESModule(
  "resource://gre/modules/AsyncShutdown.sys.mjs"
);
const { PREF_LAST_FXA_USER_UID } = ChromeUtils.importESModule(
  "resource://gre/modules/FxAccountsCommon.sys.mjs"
);

add_task(async function test_shutdown_blocker() {
  let spySignout = sinon.stub(
    SyncDisconnectInternal,
    "doSyncAndAccountDisconnect"
  );

  // We don't need to check for the lock regularly as we end up aborting the wait.
  SyncDisconnectInternal.lockRetryInterval = 1000;
  // Force the retry count to a very large value - this test should never
  // abort due to the retry count and we want the test to fail (aka timeout)
  // should our abort code not work.
  SyncDisconnectInternal.lockRetryCount = 10000;
  // mock the "browser" sanitize function - it should not be called by
  // this test.
  let spyBrowser = sinon.stub(SyncDisconnectInternal, "doSanitizeBrowserData");
  // mock Sync
  let mockEngine1 = {
    enabled: true,
    name: "Test Engine 1",
    wipeClient: sinon.spy(),
  };
  let mockEngine2 = {
    enabled: false,
    name: "Test Engine 2",
    wipeClient: sinon.spy(),
  };

  // This weave mock never gives up the lock.
  let Weave = {
    Service: {
      enabled: true,
      lock: () => false, // so we never get the lock.
      unlock: sinon.spy(),

      engineManager: {
        getAll: sinon.stub().returns([mockEngine1, mockEngine2]),
      },
      errorHandler: {
        resetFileLog: sinon.spy(),
      },
    },
  };
  let weaveStub = sinon.stub(SyncDisconnectInternal, "getWeave");
  weaveStub.returns(Weave);

  Services.prefs.setStringPref(
    PREF_LAST_FXA_USER_UID,
    "dGVzdEBleGFtcGxlLmNvbQ=="
  );

  let promiseDisconnected = SyncDisconnect.disconnect(true);

  // Pretend we hit the shutdown blocker.
  info("simulating appShutdownConfirmed");
  Services.prefs.setBoolPref("toolkit.asyncshutdown.testing", true);
  AsyncShutdown.appShutdownConfirmed._trigger();
  Services.prefs.clearUserPref("toolkit.asyncshutdown.testing");

  info("waiting for disconnect to complete");
  await promiseDisconnected;

  Assert.ok(
    !Services.prefs.prefHasUserValue(PREF_LAST_FXA_USER_UID),
    "Should have reset different user warning pref"
  );
  Assert.equal(
    Weave.Service.unlock.callCount,
    0,
    "should not have unlocked at the end"
  );
  Assert.ok(!Weave.Service.enabled, "Weave should be and remain disabled");
  Assert.equal(
    Weave.Service.errorHandler.resetFileLog.callCount,
    1,
    "should have reset the log"
  );
  Assert.equal(
    mockEngine1.wipeClient.callCount,
    1,
    "enabled engine should have been wiped"
  );
  Assert.equal(
    mockEngine2.wipeClient.callCount,
    0,
    "disabled engine should not have been wiped"
  );
  Assert.equal(spyBrowser.callCount, 1, "should not sanitize the browser");
  Assert.equal(spySignout.callCount, 1, "should have signed out of FxA");
});
