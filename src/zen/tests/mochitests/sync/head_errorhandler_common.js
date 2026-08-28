/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* import-globals-from head_appinfo.js */
/* import-globals-from ../../../common/tests/unit/head_helpers.js */
/* import-globals-from head_helpers.js */
/* import-globals-from head_http_server.js */

// This file expects Service to be defined in the global scope when EHTestsCommon
// is used (from service.js).
/* global Service */

var { Changeset, EngineManager, Store, SyncEngine, Tracker, LegacyTracker } =
  ChromeUtils.importESModule("resource://services-sync/engines.sys.mjs");
var {
  ABORT_SYNC_COMMAND,
  CLIENT_NOT_CONFIGURED,
  CREDENTIALS_CHANGED,
  DEFAULT_DOWNLOAD_BATCH_SIZE,
  DEFAULT_GUID_FETCH_BATCH_SIZE,
  DEFAULT_KEYBUNDLE_NAME,
  DEVICE_TYPE_DESKTOP,
  DEVICE_TYPE_MOBILE,
  ENGINE_APPLY_FAIL,
  ENGINE_BATCH_INTERRUPTED,
  ENGINE_DOWNLOAD_FAIL,
  ENGINE_SUCCEEDED,
  ENGINE_UNKNOWN_FAIL,
  ENGINE_UPLOAD_FAIL,
  HMAC_EVENT_INTERVAL,
  IDLE_OBSERVER_BACK_DELAY,
  LOGIN_FAILED,
  LOGIN_FAILED_INVALID_PASSPHRASE,
  LOGIN_FAILED_LOGIN_REJECTED,
  LOGIN_FAILED_NETWORK_ERROR,
  LOGIN_FAILED_NO_PASSPHRASE,
  LOGIN_FAILED_NO_USERNAME,
  LOGIN_FAILED_SERVER_ERROR,
  LOGIN_SUCCEEDED,
  MASTER_PASSWORD_LOCKED,
  MASTER_PASSWORD_LOCKED_RETRY_INTERVAL,
  MAXIMUM_BACKOFF_INTERVAL,
  MAX_ERROR_COUNT_BEFORE_BACKOFF,
  MAX_HISTORY_DOWNLOAD,
  MAX_HISTORY_UPLOAD,
  METARECORD_DOWNLOAD_FAIL,
  MINIMUM_BACKOFF_INTERVAL,
  MULTI_DEVICE_THRESHOLD,
  NO_SYNC_NODE_FOUND,
  NO_SYNC_NODE_INTERVAL,
  OVER_QUOTA,
  PREFS_BRANCH,
  RESPONSE_OVER_QUOTA,
  SCORE_INCREMENT_MEDIUM,
  SCORE_INCREMENT_SMALL,
  SCORE_INCREMENT_XLARGE,
  SCORE_UPDATE_DELAY,
  SERVER_MAINTENANCE,
  SINGLE_USER_THRESHOLD,
  SQLITE_MAX_VARIABLE_NUMBER,
  STATUS_DISABLED,
  STATUS_OK,
  STORAGE_VERSION,
  SYNC_FAILED,
  SYNC_FAILED_PARTIAL,
  SYNC_KEY_DECODED_LENGTH,
  SYNC_KEY_ENCODED_LENGTH,
  SYNC_SUCCEEDED,
  URI_LENGTH_MAX,
  VERSION_OUT_OF_DATE,
  WEAVE_VERSION,
  kFirefoxShuttingDown,
  kFirstSyncChoiceNotMade,
  kSyncBackoffNotMet,
  kSyncMasterPasswordLocked,
  kSyncNetworkOffline,
  kSyncNotConfigured,
  kSyncWeaveDisabled,
} = ChromeUtils.importESModule("resource://services-sync/constants.sys.mjs");
var { BulkKeyBundle, SyncKeyBundle } = ChromeUtils.importESModule(
  "resource://services-sync/keys.sys.mjs"
);

// Common code for test_errorhandler_{1,2}.js -- pulled out to make it less
// monolithic and take less time to execute.
const EHTestsCommon = {
  service_unavailable(request, response) {
    let body = "Service Unavailable";
    response.setStatusLine(request.httpVersion, 503, "Service Unavailable");
    response.setHeader("Retry-After", "42");
    response.bodyOutputStream.write(body, body.length);
  },

  async sync_httpd_setup() {
    let clientsEngine = Service.clientsEngine;
    let clientsSyncID = await clientsEngine.resetLocalSyncID();
    let catapultEngine = Service.engineManager.get("catapult");
    let catapultSyncID = await catapultEngine.resetLocalSyncID();
    let global = new ServerWBO("global", {
      syncID: Service.syncID,
      storageVersion: STORAGE_VERSION,
      engines: {
        clients: { version: clientsEngine.version, syncID: clientsSyncID },
        catapult: { version: catapultEngine.version, syncID: catapultSyncID },
      },
    });
    let clientsColl = new ServerCollection({}, true);

    // Tracking info/collections.
    let collectionsHelper = track_collections_helper();
    let upd = collectionsHelper.with_updated_collection;

    let handler_401 = httpd_handler(401, "Unauthorized");
    return httpd_setup({
      // Normal server behaviour.
      "/1.1/johndoe/storage/meta/global": upd("meta", global.handler()),
      "/1.1/johndoe/info/collections": collectionsHelper.handler,
      "/1.1/johndoe/storage/crypto/keys": upd(
        "crypto",
        new ServerWBO("keys").handler()
      ),
      "/1.1/johndoe/storage/clients": upd("clients", clientsColl.handler()),

      // Credentials are wrong or node reallocated.
      "/1.1/janedoe/storage/meta/global": handler_401,
      "/1.1/janedoe/info/collections": handler_401,

      // Maintenance or overloaded (503 + Retry-After) at info/collections.
      "/1.1/broken.info/info/collections": EHTestsCommon.service_unavailable,

      // Maintenance or overloaded (503 + Retry-After) at meta/global.
      "/1.1/broken.meta/storage/meta/global": EHTestsCommon.service_unavailable,
      "/1.1/broken.meta/info/collections": collectionsHelper.handler,

      // Maintenance or overloaded (503 + Retry-After) at crypto/keys.
      "/1.1/broken.keys/storage/meta/global": upd("meta", global.handler()),
      "/1.1/broken.keys/info/collections": collectionsHelper.handler,
      "/1.1/broken.keys/storage/crypto/keys": EHTestsCommon.service_unavailable,

      // Maintenance or overloaded (503 + Retry-After) at wiping collection.
      "/1.1/broken.wipe/info/collections": collectionsHelper.handler,
      "/1.1/broken.wipe/storage/meta/global": upd("meta", global.handler()),
      "/1.1/broken.wipe/storage/crypto/keys": upd(
        "crypto",
        new ServerWBO("keys").handler()
      ),
      "/1.1/broken.wipe/storage": EHTestsCommon.service_unavailable,
      "/1.1/broken.wipe/storage/clients": upd("clients", clientsColl.handler()),
      "/1.1/broken.wipe/storage/catapult": EHTestsCommon.service_unavailable,
    });
  },

  CatapultEngine: (function () {
    function CatapultEngine() {
      SyncEngine.call(this, "Catapult", Service);
    }
    CatapultEngine.prototype = {
      exception: null, // tests fill this in
      async _sync() {
        if (this.exception) {
          throw this.exception;
        }
      },
    };
    Object.setPrototypeOf(CatapultEngine.prototype, SyncEngine.prototype);

    return CatapultEngine;
  })(),

  async generateCredentialsChangedFailure() {
    // Make sync fail due to changed credentials. We simply re-encrypt
    // the keys with a different Sync Key, without changing the local one.
    let newSyncKeyBundle = new BulkKeyBundle("crypto");
    await newSyncKeyBundle.generateRandom();
    let keys = Service.collectionKeys.asWBO();
    await keys.encrypt(newSyncKeyBundle);
    return keys.upload(Service.resource(Service.cryptoKeysURL));
  },

  async setUp(server) {
    syncTestLogging();
    await configureIdentity({ username: "johndoe" }, server);
    return EHTestsCommon.generateAndUploadKeys();
  },

  async generateAndUploadKeys() {
    await generateNewKeys(Service.collectionKeys);
    let serverKeys = Service.collectionKeys.asWBO("crypto", "keys");
    await serverKeys.encrypt(Service.identity.syncKeyBundle);
    let response = await serverKeys.upload(
      Service.resource(Service.cryptoKeysURL)
    );
    return response.success;
  },
};
