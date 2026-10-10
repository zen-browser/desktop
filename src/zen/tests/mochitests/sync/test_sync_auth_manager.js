/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const { AuthenticationError, SyncAuthManager } = ChromeUtils.importESModule(
  "resource://services-sync/sync_auth.sys.mjs"
);
const { Resource } = ChromeUtils.importESModule(
  "resource://services-sync/resource.sys.mjs"
);
const { initializeIdentityWithTokenServerResponse } =
  ChromeUtils.importESModule(
    "resource://testing-common/services/sync/fxa_utils.sys.mjs"
  );
const { HawkClient } = ChromeUtils.importESModule(
  "resource://services-common/hawkclient.sys.mjs"
);
const { FxAccounts } = ChromeUtils.importESModule(
  "resource://gre/modules/FxAccounts.sys.mjs"
);
const { FxAccountsClient } = ChromeUtils.importESModule(
  "resource://gre/modules/FxAccountsClient.sys.mjs"
);
const { ERRNO_INVALID_AUTH_TOKEN, SCOPE_APP_SYNC } = ChromeUtils.importESModule(
  "resource://gre/modules/FxAccountsCommon.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { Status } = ChromeUtils.importESModule(
  "resource://services-sync/status.sys.mjs"
);
const { TokenServerClient, TokenServerClientServerError } =
  ChromeUtils.importESModule(
    "resource://services-common/tokenserverclient.sys.mjs"
  );
const { AccountState, ERROR_INVALID_ACCOUNT_STATE } =
  ChromeUtils.importESModule("resource://gre/modules/FxAccounts.sys.mjs");

const SECOND_MS = 1000;
const MINUTE_MS = SECOND_MS * 60;
const HOUR_MS = MINUTE_MS * 60;

const MOCK_ACCESS_TOKEN =
  "e3c5caf17f27a0d9e351926a928938b3737df43e91d4992a5a5fca9a7bdef8ba";

var globalIdentityConfig = makeIdentityConfig();
var globalSyncAuthManager = new SyncAuthManager();
configureFxAccountIdentity(globalSyncAuthManager, globalIdentityConfig);

/**
 * Mock client clock and skew vs server in FxAccounts signed-in user module and
 * API client.  sync_auth.js queries these values to construct HAWK
 * headers.  We will use this to test clock skew compensation in these headers
 * below.
 */
var MockFxAccountsClient = function () {
  FxAccountsClient.apply(this);
};
MockFxAccountsClient.prototype = {
  accountStatus() {
    return Promise.resolve(true);
  },
  getScopedKeyData() {
    return Promise.resolve({
      [SCOPE_APP_SYNC]: {
        identifier: SCOPE_APP_SYNC,
        keyRotationSecret:
          "0000000000000000000000000000000000000000000000000000000000000000",
        keyRotationTimestamp: 1234567890123,
      },
    });
  },
};
Object.setPrototypeOf(
  MockFxAccountsClient.prototype,
  FxAccountsClient.prototype
);

add_test(function test_initial_state() {
  _("Verify initial state");
  Assert.ok(!globalSyncAuthManager._token);
  Assert.ok(!globalSyncAuthManager._hasValidToken());
  run_next_test();
});

add_task(async function test_initialialize() {
  _("Verify start after fetching token");
  await globalSyncAuthManager._ensureValidToken();
  Assert.ok(!!globalSyncAuthManager._token);
  Assert.ok(globalSyncAuthManager._hasValidToken());
});

add_task(async function test_refreshOAuthTokenOn401() {
  _("Refreshes the FXA OAuth token after a 401.");
  let getTokenCount = 0;
  let syncAuthManager = new SyncAuthManager();
  let identityConfig = makeIdentityConfig();
  let fxaInternal = makeFxAccountsInternalMock(identityConfig);
  configureFxAccountIdentity(syncAuthManager, identityConfig, fxaInternal);
  syncAuthManager._fxaService._internal.initialize();
  syncAuthManager._fxaService.getOAuthToken = () => {
    ++getTokenCount;
    return Promise.resolve(MOCK_ACCESS_TOKEN);
  };

  let didReturn401 = false;
  let didReturn200 = false;
  let mockTSC = mockTokenServer(() => {
    if (getTokenCount <= 1) {
      didReturn401 = true;
      return {
        status: 401,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      };
    }
    didReturn200 = true;
    return {
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "id",
        key: "key",
        api_endpoint: "http://example.com/",
        uid: "uid",
        duration: 300,
      }),
    };
  });

  syncAuthManager._tokenServerClient = mockTSC;

  await syncAuthManager._ensureValidToken();

  Assert.equal(getTokenCount, 2);
  Assert.ok(didReturn401);
  Assert.ok(didReturn200);
  Assert.ok(syncAuthManager._token);
  Assert.ok(syncAuthManager._hasValidToken());
});

add_task(async function test_initialializeWithAuthErrorAndDeletedAccount() {
  _("Verify sync state with auth error + account deleted");

  var identityConfig = makeIdentityConfig();
  var syncAuthManager = new SyncAuthManager();

  // Use the real `getOAuthToken` method that calls
  // `mockFxAClient.accessTokenWithSessionToken`.
  let fxaInternal = makeFxAccountsInternalMock(identityConfig);
  delete fxaInternal.getOAuthToken;

  configureFxAccountIdentity(syncAuthManager, identityConfig, fxaInternal);
  syncAuthManager._fxaService._internal.initialize();

  let accessTokenWithSessionTokenCalled = false;
  let accountStatusCalled = false;
  let sessionStatusCalled = false;

  let AuthErrorMockFxAClient = function () {
    FxAccountsClient.apply(this);
  };
  AuthErrorMockFxAClient.prototype = {
    accessTokenWithSessionToken() {
      accessTokenWithSessionTokenCalled = true;
      return Promise.reject({
        code: 401,
        errno: ERRNO_INVALID_AUTH_TOKEN,
      });
    },
    accountStatus() {
      accountStatusCalled = true;
      return Promise.resolve(false);
    },
    sessionStatus() {
      sessionStatusCalled = true;
      return Promise.resolve(false);
    },
  };
  Object.setPrototypeOf(
    AuthErrorMockFxAClient.prototype,
    FxAccountsClient.prototype
  );

  let mockFxAClient = new AuthErrorMockFxAClient();
  syncAuthManager._fxaService._internal._fxAccountsClient = mockFxAClient;

  await Assert.rejects(
    syncAuthManager._ensureValidToken(),
    err => {
      Assert.equal(err.message, ERROR_INVALID_ACCOUNT_STATE);
      return true; // expected error
    },
    "should reject because the account was deleted"
  );

  Assert.ok(accessTokenWithSessionTokenCalled);
  Assert.ok(sessionStatusCalled);
  Assert.ok(accountStatusCalled);
  Assert.ok(!syncAuthManager._token);
  Assert.ok(!syncAuthManager._hasValidToken());
});

add_task(async function test_getResourceAuthenticator() {
  _(
    "SyncAuthManager supplies a Resource Authenticator callback which returns a Hawk header."
  );
  configureFxAccountIdentity(globalSyncAuthManager);
  let authenticator = globalSyncAuthManager.getResourceAuthenticator();
  Assert.ok(!!authenticator);
  let req = {
    uri: CommonUtils.makeURI("https://example.net/somewhere/over/the/rainbow"),
    method: "GET",
  };
  let output = await authenticator(req, "GET");
  Assert.ok("headers" in output);
  Assert.ok("authorization" in output.headers);
  Assert.ok(output.headers.authorization.startsWith("Hawk"));
  _("Expected internal state after successful call.");
  Assert.equal(
    globalSyncAuthManager._token.uid,
    globalIdentityConfig.fxaccount.token.uid
  );
});

add_task(async function test_resourceAuthenticatorSkew() {
  _(
    "SyncAuthManager Resource Authenticator compensates for clock skew in Hawk header."
  );

  // Clock is skewed 12 hours into the future
  // We pick a date in the past so we don't risk concealing bugs in code that
  // uses new Date() instead of our given date.
  let now =
    new Date("Fri Apr 09 2004 00:00:00 GMT-0700").valueOf() + 12 * HOUR_MS;
  let syncAuthManager = new SyncAuthManager();
  let hawkClient = new HawkClient("https://example.net/v1", "/foo");

  // mock fxa hawk client skew
  hawkClient.now = function () {
    dump("mocked client now: " + now + "\n");
    return now;
  };
  // Imagine there's already been one fxa request and the hawk client has
  // already detected skew vs the fxa auth server.
  let localtimeOffsetMsec = -1 * 12 * HOUR_MS;
  hawkClient._localtimeOffsetMsec = localtimeOffsetMsec;

  let fxaClient = new MockFxAccountsClient();
  fxaClient.hawk = hawkClient;

  // Sanity check
  Assert.equal(hawkClient.now(), now);
  Assert.equal(hawkClient.localtimeOffsetMsec, localtimeOffsetMsec);

  // Properly picked up by the client
  Assert.equal(fxaClient.now(), now);
  Assert.equal(fxaClient.localtimeOffsetMsec, localtimeOffsetMsec);

  let identityConfig = makeIdentityConfig();
  let fxaInternal = makeFxAccountsInternalMock(identityConfig);
  fxaInternal._now_is = now;
  fxaInternal.fxAccountsClient = fxaClient;

  // Mocks within mocks...
  configureFxAccountIdentity(
    syncAuthManager,
    globalIdentityConfig,
    fxaInternal
  );

  Assert.equal(syncAuthManager._fxaService._internal.now(), now);
  Assert.equal(
    syncAuthManager._fxaService._internal.localtimeOffsetMsec,
    localtimeOffsetMsec
  );

  Assert.equal(syncAuthManager._fxaService._internal.now(), now);
  Assert.equal(
    syncAuthManager._fxaService._internal.localtimeOffsetMsec,
    localtimeOffsetMsec
  );

  let request = new Resource("https://example.net/i/like/pie/");
  let authenticator = syncAuthManager.getResourceAuthenticator();
  let output = await authenticator(request, "GET");
  dump("output" + JSON.stringify(output));
  let authHeader = output.headers.authorization;
  Assert.ok(authHeader.startsWith("Hawk"));

  // Skew correction is applied in the header and we're within the two-minute
  // window.
  Assert.equal(getTimestamp(authHeader), now - 12 * HOUR_MS);
  Assert.less(getTimestampDelta(authHeader, now) - 12 * HOUR_MS, 2 * MINUTE_MS);
});

add_task(async function test_RESTResourceAuthenticatorSkew() {
  _(
    "SyncAuthManager REST Resource Authenticator compensates for clock skew in Hawk header."
  );

  // Clock is skewed 12 hours into the future from our arbitary date
  let now =
    new Date("Fri Apr 09 2004 00:00:00 GMT-0700").valueOf() + 12 * HOUR_MS;
  let syncAuthManager = new SyncAuthManager();
  let hawkClient = new HawkClient("https://example.net/v1", "/foo");

  // mock fxa hawk client skew
  hawkClient.now = function () {
    return now;
  };
  // Imagine there's already been one fxa request and the hawk client has
  // already detected skew vs the fxa auth server.
  hawkClient._localtimeOffsetMsec = -1 * 12 * HOUR_MS;

  let fxaClient = new MockFxAccountsClient();
  fxaClient.hawk = hawkClient;

  let identityConfig = makeIdentityConfig();
  let fxaInternal = makeFxAccountsInternalMock(identityConfig);
  fxaInternal._now_is = now;
  fxaInternal.fxAccountsClient = fxaClient;

  configureFxAccountIdentity(
    syncAuthManager,
    globalIdentityConfig,
    fxaInternal
  );

  Assert.equal(syncAuthManager._fxaService._internal.now(), now);

  let request = new Resource("https://example.net/i/like/pie/");
  let authenticator = syncAuthManager.getResourceAuthenticator();
  let output = await authenticator(request, "GET");
  dump("output" + JSON.stringify(output));
  let authHeader = output.headers.authorization;
  Assert.ok(authHeader.startsWith("Hawk"));

  // Skew correction is applied in the header and we're within the two-minute
  // window.
  Assert.equal(getTimestamp(authHeader), now - 12 * HOUR_MS);
  Assert.less(getTimestampDelta(authHeader, now) - 12 * HOUR_MS, 2 * MINUTE_MS);
});

add_task(async function test_ensureLoggedIn() {
  configureFxAccountIdentity(globalSyncAuthManager);
  await globalSyncAuthManager._ensureValidToken();
  Assert.equal(Status.login, LOGIN_SUCCEEDED, "original initialize worked");
  Assert.ok(globalSyncAuthManager._token);

  // arrange for no logged in user.
  let fxa = globalSyncAuthManager._fxaService;
  let signedInUser =
    fxa._internal.currentAccountState.storageManager.accountData;
  fxa._internal.currentAccountState.storageManager.accountData = null;
  await Assert.rejects(
    globalSyncAuthManager._ensureValidToken(true),
    /no user is logged in/,
    "expecting rejection due to no user"
  );
  // Restore the logged in user to what it was.
  fxa._internal.currentAccountState.storageManager.accountData = signedInUser;
  Status.login = LOGIN_FAILED_LOGIN_REJECTED;
  await globalSyncAuthManager._ensureValidToken(true);
  Assert.equal(Status.login, LOGIN_SUCCEEDED, "final ensureLoggedIn worked");
});

add_task(async function test_tokenExpiration() {
  _("SyncAuthManager notices token expiration:");
  let bimExp = new SyncAuthManager();
  configureFxAccountIdentity(bimExp, globalIdentityConfig);

  let authenticator = bimExp.getResourceAuthenticator();
  Assert.ok(!!authenticator);
  let req = {
    uri: CommonUtils.makeURI("https://example.net/somewhere/over/the/rainbow"),
    method: "GET",
  };
  await authenticator(req, "GET");

  // Mock the clock.
  _("Forcing the token to expire ...");
  Object.defineProperty(bimExp, "_now", {
    value: function customNow() {
      return Date.now() + 3000001;
    },
    writable: true,
  });
  Assert.less(bimExp._token.expiration, bimExp._now());
  _("... means SyncAuthManager knows to re-fetch it on the next call.");
  Assert.ok(!bimExp._hasValidToken());
});

add_task(async function test_getTokenErrors() {
  _("SyncAuthManager correctly handles various failures to get a token.");

  _("Arrange for a 401 - Sync should reflect an auth error.");
  initializeIdentityWithTokenServerResponse({
    status: 401,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  let syncAuthManager = Service.identity;

  await Assert.rejects(
    syncAuthManager._ensureValidToken(),
    AuthenticationError,
    "should reject due to 401"
  );
  Assert.equal(Status.login, LOGIN_FAILED_LOGIN_REJECTED, "login was rejected");

  // XXX - other interesting responses to return?

  // And for good measure, some totally "unexpected" errors - we generally
  // assume these problems are going to magically go away at some point.
  _(
    "Arrange for an empty body with a 200 response - should reflect a network error."
  );
  initializeIdentityWithTokenServerResponse({
    status: 200,
    headers: [],
    body: "",
  });
  syncAuthManager = Service.identity;
  await Assert.rejects(
    syncAuthManager._ensureValidToken(),
    TokenServerClientServerError,
    "should reject due to non-JSON response"
  );
  Assert.equal(
    Status.login,
    LOGIN_FAILED_NETWORK_ERROR,
    "login state is LOGIN_FAILED_NETWORK_ERROR"
  );
});

add_task(async function test_refreshAccessTokenOn401() {
  _("SyncAuthManager refreshes the FXA OAuth access token after a 401.");
  var identityConfig = makeIdentityConfig();
  var syncAuthManager = new SyncAuthManager();
  // Use the real `getOAuthToken` method that calls
  // `mockFxAClient.accessTokenWithSessionToken`.
  let fxaInternal = makeFxAccountsInternalMock(identityConfig);
  delete fxaInternal.getOAuthToken;
  configureFxAccountIdentity(syncAuthManager, identityConfig, fxaInternal);
  syncAuthManager._fxaService._internal.initialize();

  let getTokenCount = 0;

  let CheckSignMockFxAClient = function () {
    FxAccountsClient.apply(this);
  };
  CheckSignMockFxAClient.prototype = {
    accessTokenWithSessionToken() {
      ++getTokenCount;
      return Promise.resolve({ access_token: "token" });
    },
  };
  Object.setPrototypeOf(
    CheckSignMockFxAClient.prototype,
    FxAccountsClient.prototype
  );

  let mockFxAClient = new CheckSignMockFxAClient();
  syncAuthManager._fxaService._internal._fxAccountsClient = mockFxAClient;

  let didReturn401 = false;
  let didReturn200 = false;
  let mockTSC = mockTokenServer(() => {
    if (getTokenCount <= 1) {
      didReturn401 = true;
      return {
        status: 401,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      };
    }
    didReturn200 = true;
    return {
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "id",
        key: "key",
        api_endpoint: "http://example.com/",
        uid: "uid",
        duration: 300,
      }),
    };
  });

  syncAuthManager._tokenServerClient = mockTSC;

  await syncAuthManager._ensureValidToken();

  Assert.equal(getTokenCount, 2);
  Assert.ok(didReturn401);
  Assert.ok(didReturn200);
  Assert.ok(syncAuthManager._token);
  Assert.ok(syncAuthManager._hasValidToken());
});

add_task(async function test_getTokenErrorWithRetry() {
  _("tokenserver sends an observer notification on various backoff headers.");

  // Set Sync's backoffInterval to zero - after we simulated the backoff header
  // it should reflect the value we sent.
  Status.backoffInterval = 0;
  _("Arrange for a 503 with a Retry-After header.");
  initializeIdentityWithTokenServerResponse({
    status: 503,
    headers: { "content-type": "application/json", "retry-after": "100" },
    body: JSON.stringify({}),
  });
  let syncAuthManager = Service.identity;

  await Assert.rejects(
    syncAuthManager._ensureValidToken(),
    TokenServerClientServerError,
    "should reject due to 503"
  );

  // The observer should have fired - check it got the value in the response.
  Assert.equal(Status.login, LOGIN_FAILED_NETWORK_ERROR, "login was rejected");
  // Sync will have the value in ms with some slop - so check it is at least that.
  Assert.greaterOrEqual(Status.backoffInterval, 100000);

  _("Arrange for a 200 with an X-Backoff header.");
  Status.backoffInterval = 0;
  initializeIdentityWithTokenServerResponse({
    status: 503,
    headers: { "content-type": "application/json", "x-backoff": "200" },
    body: JSON.stringify({}),
  });
  syncAuthManager = Service.identity;

  await Assert.rejects(
    syncAuthManager._ensureValidToken(),
    TokenServerClientServerError,
    "should reject due to no token in response"
  );

  // The observer should have fired - check it got the value in the response.
  Assert.greaterOrEqual(Status.backoffInterval, 200000);
});

add_task(async function test_getKeysErrorWithBackoff() {
  _(
    "Auth server (via hawk) sends an observer notification on backoff headers."
  );

  // Set Sync's backoffInterval to zero - after we simulated the backoff header
  // it should reflect the value we sent.
  Status.backoffInterval = 0;
  _("Arrange for a 503 with a X-Backoff header.");

  let config = makeIdentityConfig();
  // We want no scopedKeys so we attempt to fetch them.
  delete config.fxaccount.user.scopedKeys;
  config.fxaccount.user.keyFetchToken = "keyfetchtoken";
  await initializeIdentityWithHAWKResponseFactory(
    config,
    function (method, data, uri) {
      Assert.equal(method, "get");
      Assert.equal(uri, "http://mockedserver:9999/account/keys");
      return {
        status: 503,
        headers: { "content-type": "application/json", "x-backoff": "100" },
        body: "{}",
      };
    }
  );

  let syncAuthManager = Service.identity;
  await Assert.rejects(
    syncAuthManager._ensureValidToken(),
    TokenServerClientServerError,
    "should reject due to 503"
  );

  // The observer should have fired - check it got the value in the response.
  Assert.equal(Status.login, LOGIN_FAILED_NETWORK_ERROR, "login was rejected");
  // Sync will have the value in ms with some slop - so check it is at least that.
  Assert.greaterOrEqual(Status.backoffInterval, 100000);
});

add_task(async function test_getKeysErrorWithRetry() {
  _("Auth server (via hawk) sends an observer notification on retry headers.");

  // Set Sync's backoffInterval to zero - after we simulated the backoff header
  // it should reflect the value we sent.
  Status.backoffInterval = 0;
  _("Arrange for a 503 with a Retry-After header.");

  let config = makeIdentityConfig();
  // We want no scopedKeys so we attempt to fetch them.
  delete config.fxaccount.user.scopedKeys;
  config.fxaccount.user.keyFetchToken = "keyfetchtoken";
  await initializeIdentityWithHAWKResponseFactory(
    config,
    function (method, data, uri) {
      Assert.equal(method, "get");
      Assert.equal(uri, "http://mockedserver:9999/account/keys");
      return {
        status: 503,
        headers: { "content-type": "application/json", "retry-after": "100" },
        body: "{}",
      };
    }
  );

  let syncAuthManager = Service.identity;
  await Assert.rejects(
    syncAuthManager._ensureValidToken(),
    TokenServerClientServerError,
    "should reject due to 503"
  );

  // The observer should have fired - check it got the value in the response.
  Assert.equal(Status.login, LOGIN_FAILED_NETWORK_ERROR, "login was rejected");
  // Sync will have the value in ms with some slop - so check it is at least that.
  Assert.greaterOrEqual(Status.backoffInterval, 100000);
});

add_task(async function test_getHAWKErrors() {
  _("SyncAuthManager correctly handles various HAWK failures.");

  _("Arrange for a 401 - Sync should reflect an auth error.");
  let config = makeIdentityConfig();
  await initializeIdentityWithHAWKResponseFactory(
    config,
    function (method, data, uri) {
      if (uri == "http://mockedserver:9999/oauth/token") {
        Assert.equal(method, "post");
        return {
          status: 401,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            code: 401,
            errno: 110,
            error: "invalid token",
          }),
        };
      }
      // For any follow-up requests that check account status.
      return {
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      };
    }
  );
  Assert.equal(Status.login, LOGIN_FAILED_LOGIN_REJECTED, "login was rejected");

  // XXX - other interesting responses to return?

  // And for good measure, some totally "unexpected" errors - we generally
  // assume these problems are going to magically go away at some point.
  _(
    "Arrange for an empty body with a 200 response - should reflect a network error."
  );
  await initializeIdentityWithHAWKResponseFactory(
    config,
    function (method, data, uri) {
      Assert.equal(method, "post");
      Assert.equal(uri, "http://mockedserver:9999/oauth/token");
      return {
        status: 200,
        headers: [],
        body: "",
      };
    }
  );
  Assert.equal(
    Status.login,
    LOGIN_FAILED_NETWORK_ERROR,
    "login state is LOGIN_FAILED_NETWORK_ERROR"
  );
});

// End of tests
// Utility functions follow

// Create a new sync_auth object and initialize it with a
// hawk mock that simulates HTTP responses.
// The callback function will be called each time the mocked hawk server wants
// to make a request.  The result of the callback should be the mock response
// object that will be returned to hawk.
// A token server mock will be used that doesn't hit a server, so we move
// directly to a hawk request.
async function initializeIdentityWithHAWKResponseFactory(
  config,
  cbGetResponse
) {
  // A mock request object.
  function MockRESTRequest(uri, credentials, extra) {
    this._uri = uri;
    this._credentials = credentials;
    this._extra = extra;
  }
  MockRESTRequest.prototype = {
    setHeader() {},
    async post(data) {
      this.response = cbGetResponse(
        "post",
        data,
        this._uri,
        this._credentials,
        this._extra
      );
      return this.response;
    },
    async get() {
      // Skip /status requests (sync_auth checks if the account still
      // exists after an auth error)
      if (this._uri.startsWith("http://mockedserver:9999/account/status")) {
        this.response = {
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ exists: true }),
        };
      } else {
        this.response = cbGetResponse(
          "get",
          null,
          this._uri,
          this._credentials,
          this._extra
        );
      }
      return this.response;
    },
  };

  // The hawk client.
  function MockedHawkClient() {}
  MockedHawkClient.prototype = new HawkClient("http://mockedserver:9999");
  MockedHawkClient.prototype.constructor = MockedHawkClient;
  MockedHawkClient.prototype.newHAWKAuthenticatedRESTRequest = function (
    uri,
    credentials,
    extra
  ) {
    return new MockRESTRequest(uri, credentials, extra);
  };
  // Arrange for the same observerPrefix as FxAccountsClient uses
  MockedHawkClient.prototype.observerPrefix = "FxA:hawk";

  // tie it all together - configureFxAccountIdentity isn't useful here :(
  let fxaClient = new MockFxAccountsClient();
  fxaClient.hawk = new MockedHawkClient();
  let internal = {
    fxAccountsClient: fxaClient,
    newAccountState(credentials) {
      // We only expect this to be called with null indicating the (mock)
      // storage should be read.
      if (credentials) {
        throw new Error("Not expecting to have credentials passed");
      }
      let storageManager = new MockFxaStorageManager();
      storageManager.initialize(config.fxaccount.user);
      return new AccountState(storageManager);
    },
  };
  let fxa = new FxAccounts(internal);

  globalSyncAuthManager._fxaService = fxa;
  await Assert.rejects(
    globalSyncAuthManager._ensureValidToken(true),
    // TODO: Ideally this should have a specific check for an error.
    () => true,
    "expecting rejection due to hawk error"
  );
}

function getTimestamp(hawkAuthHeader) {
  return parseInt(/ts="(\d+)"/.exec(hawkAuthHeader)[1], 10) * SECOND_MS;
}

function getTimestampDelta(hawkAuthHeader, now = Date.now()) {
  return Math.abs(getTimestamp(hawkAuthHeader) - now);
}

function mockTokenServer(func) {
  let requestLog = Log.repository.getLogger("testing.mock-rest");
  if (!requestLog.appenders.length) {
    // might as well see what it says :)
    requestLog.addAppender(new Log.DumpAppender());
    requestLog.level = Log.Level.Trace;
  }
  function MockRESTRequest() {}
  MockRESTRequest.prototype = {
    _log: requestLog,
    setHeader() {},
    async get() {
      this.response = func();
      return this.response;
    },
  };
  // The mocked TokenServer client which will get the response.
  function MockTSC() {}
  MockTSC.prototype = new TokenServerClient();
  MockTSC.prototype.constructor = MockTSC;
  MockTSC.prototype.newRESTRequest = function (url) {
    return new MockRESTRequest(url);
  };
  // Arrange for the same observerPrefix as sync_auth uses.
  MockTSC.prototype.observerPrefix = "weave:service";
  return new MockTSC();
}
