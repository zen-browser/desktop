/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { UIState } = ChromeUtils.importESModule(
  "resource://services-sync/UIState.sys.mjs"
);

const UIStateInternal = UIState._internal;

add_task(async function test_isReady_unconfigured() {
  UIState.reset();

  let refreshState = sinon.spy(UIStateInternal, "refreshState");

  // On the first call, returns false
  // Does trigger a refresh of the state - even though services.sync.username
  // is undefined we still need to check the account state.
  ok(!UIState.isReady());
  // resfreshState is called when idle - so only check after idle.
  await new Promise(resolve => {
    Services.tm.idleDispatchToMainThread(resolve);
  });
  ok(refreshState.called);
  refreshState.resetHistory();

  // On subsequent calls, only return true
  ok(UIState.isReady());
  ok(!refreshState.called);

  refreshState.restore();
});

add_task(async function test_isReady_signedin() {
  UIState.reset();
  Services.prefs.setStringPref("services.sync.username", "foo");

  let refreshState = sinon.spy(UIStateInternal, "refreshState");

  // On the first call, returns false and triggers a refresh of the state
  ok(!UIState.isReady());
  await new Promise(resolve => {
    Services.tm.idleDispatchToMainThread(resolve);
  });
  ok(refreshState.calledOnce);
  refreshState.resetHistory();

  // On subsequent calls, only return true
  ok(UIState.isReady());
  ok(!refreshState.called);

  refreshState.restore();
});

add_task(async function test_refreshState_signedin() {
  UIState.reset();
  const fxAccountsOrig = UIStateInternal.fxAccounts;

  const now = new Date().toString();
  Services.prefs.setStringPref("services.sync.lastSync", now);
  Services.prefs.setStringPref("services.sync.username", "foo@bar.com");
  UIStateInternal.syncing = false;

  UIStateInternal.fxAccounts = {
    getSignedInUser: () =>
      Promise.resolve({
        verified: true,
        uid: "123",
        email: "foo@bar.com",
        displayName: "Foo Bar",
        avatar: "https://foo/bar",
      }),
    hasLocalSession: () => Promise.resolve(true),
    keys: {
      canGetKeyForScope: () => Promise.resolve(true),
      hasKeysForScope: () => Promise.resolve(true),
    },
  };

  let state = await UIState.refresh();

  equal(state.status, UIState.STATUS_SIGNED_IN);
  equal(state.uid, "123");
  equal(state.email, "foo@bar.com");
  equal(state.displayName, "Foo Bar");
  equal(state.avatarURL, "https://foo/bar");
  equal(state.lastSync, now);
  equal(state.syncing, false);
  equal(state.hasSyncKeys, true);

  UIStateInternal.fxAccounts = fxAccountsOrig;
  Services.prefs.clearUserPref("services.sync.username");
});

add_task(async function test_refreshState_syncButNoFxA() {
  UIState.reset();
  const fxAccountsOrig = UIStateInternal.fxAccounts;

  const now = new Date().toString();
  Services.prefs.setStringPref("services.sync.lastSync", now);
  Services.prefs.setStringPref("services.sync.username", "test@test.com");
  UIStateInternal.syncing = false;

  UIStateInternal.fxAccounts = {
    getSignedInUser: () => Promise.resolve(null),
  };

  let state = await UIState.refresh();

  equal(state.status, UIState.STATUS_LOGIN_FAILED);
  equal(state.uid, undefined);
  equal(state.email, "test@test.com");
  equal(state.displayName, undefined);
  equal(state.avatarURL, undefined);
  equal(state.lastSync, undefined); // only set when STATUS_SIGNED_IN.
  equal(state.syncing, false);

  UIStateInternal.fxAccounts = fxAccountsOrig;
  Services.prefs.clearUserPref("services.sync.lastSync");
  Services.prefs.clearUserPref("services.sync.username");
});

add_task(async function test_refreshState_signedin_profile_unavailable() {
  UIState.reset();
  const fxAccountsOrig = UIStateInternal.fxAccounts;

  const now = new Date().toString();
  Services.prefs.setStringPref("services.sync.lastSync", now);
  Services.prefs.setStringPref("services.sync.username", "test@test.com");
  UIStateInternal.syncing = false;

  UIStateInternal.fxAccounts = {
    getSignedInUser: () =>
      Promise.resolve({ verified: true, uid: "123", email: "foo@bar.com" }),
    hasLocalSession: () => Promise.resolve(true),
    keys: {
      canGetKeyForScope: () => Promise.resolve(true),
      hasKeysForScope: () => Promise.resolve(true),
    },
    _internal: {
      profile: {
        getProfile: () => {
          return Promise.reject(new Error("Profile unavailable"));
        },
      },
    },
  };

  let state = await UIState.refresh();

  equal(state.status, UIState.STATUS_SIGNED_IN);
  equal(state.uid, "123");
  equal(state.email, "foo@bar.com");
  equal(state.displayName, undefined);
  equal(state.avatarURL, undefined);
  equal(state.lastSync, now);
  equal(state.syncing, false);

  UIStateInternal.fxAccounts = fxAccountsOrig;
  Services.prefs.clearUserPref("services.sync.lastSync");
  Services.prefs.clearUserPref("services.sync.username");
});

add_task(async function test_refreshState_unverified() {
  UIState.reset();
  const fxAccountsOrig = UIStateInternal.fxAccounts;

  UIStateInternal.fxAccounts = {
    getSignedInUser: () =>
      Promise.resolve({ verified: false, uid: "123", email: "foo@bar.com" }),
    hasLocalSession: () => Promise.resolve(true),
    keys: {
      hasKeysForScope: () => Promise.resolve(true),
    },
  };

  let state = await UIState.refresh();

  equal(state.status, UIState.STATUS_NOT_VERIFIED);
  equal(state.uid, "123");
  equal(state.email, "foo@bar.com");
  equal(state.displayName, undefined);
  equal(state.avatarURL, undefined);
  equal(state.lastSync, undefined);

  UIStateInternal.fxAccounts = fxAccountsOrig;
});

add_task(async function test_refreshState_unverified_nosession() {
  UIState.reset();
  const fxAccountsOrig = UIStateInternal.fxAccounts;

  UIStateInternal.fxAccounts = {
    getSignedInUser: () =>
      Promise.resolve({ verified: false, uid: "123", email: "foo@bar.com" }),
    hasLocalSession: () => Promise.resolve(false),
    keys: {
      hasKeysForScope: () => Promise.resolve(true),
    },
  };

  let state = await UIState.refresh();

  // No session should "win" over the unverified state.
  equal(state.status, UIState.STATUS_LOGIN_FAILED);
  equal(state.uid, "123");
  equal(state.email, "foo@bar.com");
  equal(state.displayName, undefined);
  equal(state.avatarURL, undefined);
  equal(state.lastSync, undefined);

  UIStateInternal.fxAccounts = fxAccountsOrig;
});

add_task(async function test_refreshState_loginFailed() {
  UIState.reset();
  const fxAccountsOrig = UIStateInternal.fxAccounts;

  let loginFailed = sinon.stub(UIStateInternal, "_loginFailed");
  loginFailed.returns(true);

  UIStateInternal.fxAccounts = {
    getSignedInUser: () =>
      Promise.resolve({ verified: true, uid: "123", email: "foo@bar.com" }),
    keys: {
      canGetKeyForScope: () => Promise.resolve(true),
      hasKeysForScope: () => Promise.resolve(true),
    },
  };

  let state = await UIState.refresh();

  equal(state.status, UIState.STATUS_LOGIN_FAILED);
  equal(state.uid, "123");
  equal(state.email, "foo@bar.com");
  equal(state.displayName, undefined);
  equal(state.avatarURL, undefined);
  equal(state.lastSync, undefined);

  loginFailed.restore();
  UIStateInternal.fxAccounts = fxAccountsOrig;
});

add_task(async function test_observer_refreshState() {
  let refreshState = sinon.spy(UIStateInternal, "refreshState");

  let shouldRefresh = [
    "weave:service:login:got-hashed-id",
    "weave:service:login:error",
    "weave:service:ready",
    "fxaccounts:onverified",
    "fxaccounts:onlogin",
    "fxaccounts:onlogout",
    "fxaccounts:profilechange",
  ];

  for (let topic of shouldRefresh) {
    let uiUpdateObserved = observeUIUpdate();
    Services.obs.notifyObservers(null, topic);
    await uiUpdateObserved;
    ok(refreshState.calledOnce);
    refreshState.resetHistory();
  }

  refreshState.restore();
});

// Drive the UIState in a configured state.
async function configureUIState(syncing, lastSync = new Date()) {
  UIState.reset();
  const fxAccountsOrig = UIStateInternal.fxAccounts;

  UIStateInternal._syncing = syncing;
  Services.prefs.setStringPref("services.sync.lastSync", lastSync.toString());
  Services.prefs.setStringPref("services.sync.username", "test@test.com");

  UIStateInternal.fxAccounts = {
    getSignedInUser: () =>
      Promise.resolve({ verified: true, uid: "123", email: "foo@bar.com" }),
    hasLocalSession: () => Promise.resolve(true),
    keys: {
      canGetKeyForScope: () => Promise.resolve(true),
      hasKeysForScope: () => Promise.resolve(true),
    },
  };
  await UIState.refresh();
  UIStateInternal.fxAccounts = fxAccountsOrig;
}

add_task(async function test_syncStarted() {
  await configureUIState(false);

  const oldState = Object.assign({}, UIState.get());
  ok(!oldState.syncing);

  let uiUpdateObserved = observeUIUpdate();
  Services.obs.notifyObservers(null, "weave:service:sync:start");
  await uiUpdateObserved;

  const newState = Object.assign({}, UIState.get());
  ok(newState.syncing);
});

add_task(async function test_syncFinished() {
  let yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await configureUIState(true, yesterday);

  const oldState = Object.assign({}, UIState.get());
  ok(oldState.syncing);

  let uiUpdateObserved = observeUIUpdate();
  Services.prefs.setStringPref("services.sync.lastSync", new Date().toString());
  Services.obs.notifyObservers(null, "weave:service:sync:finish");
  await uiUpdateObserved;

  const newState = Object.assign({}, UIState.get());
  ok(!newState.syncing);
  Assert.greater(new Date(newState.lastSync), new Date(oldState.lastSync));
});

add_task(async function test_syncError() {
  let yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await configureUIState(true, yesterday);

  const oldState = Object.assign({}, UIState.get());
  ok(oldState.syncing);

  let uiUpdateObserved = observeUIUpdate();
  Services.obs.notifyObservers(null, "weave:service:sync:error");
  await uiUpdateObserved;

  const newState = Object.assign({}, UIState.get());
  ok(!newState.syncing);
  deepEqual(newState.lastSync, oldState.lastSync);
});

add_task(async function test_refreshState_signedin_with_synckeys() {
  UIState.reset();
  const fxAccountsOrig = UIStateInternal.fxAccounts;

  Services.prefs.setStringPref("services.sync.username", "test@test.com");

  UIStateInternal.fxAccounts = {
    getSignedInUser: () =>
      Promise.resolve({
        verified: true,
        uid: "123",
        email: "foo@bar.com",
        displayName: "Foo Bar",
      }),
    hasLocalSession: () => Promise.resolve(true),
    keys: {
      canGetKeyForScope: () => Promise.resolve(true),
      hasKeysForScope: () => Promise.resolve(true),
    },
  };

  let state = await UIState.refresh();

  equal(state.status, UIState.STATUS_SIGNED_IN);
  equal(state.syncEnabled, true);
  equal(state.uid, "123");
  equal(state.email, "foo@bar.com");

  UIStateInternal.fxAccounts = fxAccountsOrig;
  Services.prefs.clearUserPref("services.sync.username");
});

// Testing third-party auth does not enable sync (should be impossible without keys)
add_task(async function test_refreshState_third_party_auth_no_sync() {
  UIState.reset();
  const fxAccountsOrig = UIStateInternal.fxAccounts;

  // Mock signing in but NO keys (third-party auth)
  UIStateInternal.fxAccounts = {
    getSignedInUser: () =>
      Promise.resolve({
        verified: true,
        uid: "123",
        email: "foo@bar.com",
      }),
    hasLocalSession: () => Promise.resolve(true),
    keys: {
      hasKeysForScope: () => Promise.resolve(false),
    },
  };

  let state = await UIState.refresh();

  equal(state.status, UIState.STATUS_SIGNED_IN);
  equal(state.syncEnabled, false);
  equal(state.hasSyncKeys, false);
  equal(state.uid, "123");
  equal(state.email, "foo@bar.com");

  UIStateInternal.fxAccounts = fxAccountsOrig;
});

function observeUIUpdate() {
  return new Promise(resolve => {
    let obs = (aSubject, aTopic) => {
      Services.obs.removeObserver(obs, aTopic);
      const state = UIState.get();
      resolve(state);
    };
    Services.obs.addObserver(obs, UIState.ON_UPDATE);
  });
}
