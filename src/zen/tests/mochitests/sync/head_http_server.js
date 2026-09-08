/* import-globals-from head_appinfo.js */
/* import-globals-from ../../../common/tests/unit/head_helpers.js */
/* import-globals-from head_helpers.js */

var Cm = Components.manager;

// Shared logging for all HTTP server functions.
var { Log } = ChromeUtils.importESModule("resource://gre/modules/Log.sys.mjs");
var { CommonUtils } = ChromeUtils.importESModule(
  "resource://services-common/utils.sys.mjs"
);
var { TestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/TestUtils.sys.mjs"
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

const SYNC_HTTP_LOGGER = "Sync.Test.Server";

// While the sync code itself uses 1.5, the tests hard-code 1.1,
// so we're sticking with 1.1 here.
const SYNC_API_VERSION = "1.1";

// Use the same method that record.js does, which mirrors the server.
// The server returns timestamps with 1/100 sec granularity. Note that this is
// subject to change: see Bug 650435.
function new_timestamp() {
  return round_timestamp(Date.now());
}

// Rounds a millisecond timestamp `t` to seconds, with centisecond precision.
function round_timestamp(t) {
  return Math.round(t / 10) / 100;
}

function return_timestamp(request, response, timestamp) {
  if (!timestamp) {
    timestamp = new_timestamp();
  }
  let body = "" + timestamp;
  response.setHeader("X-Weave-Timestamp", body);
  response.setStatusLine(request.httpVersion, 200, "OK");
  writeBytesToOutputStream(response.bodyOutputStream, body);
  return timestamp;
}

function has_hawk_header(req) {
  return (
    req.hasHeader("Authorization") &&
    req.getHeader("Authorization").startsWith("Hawk")
  );
}

function basic_auth_header(user, password) {
  return "Basic " + btoa(user + ":" + CommonUtils.encodeUTF8(password));
}

function basic_auth_matches(req, user, password) {
  if (!req.hasHeader("Authorization")) {
    return false;
  }

  let expected = basic_auth_header(user, CommonUtils.encodeUTF8(password));
  return req.getHeader("Authorization") == expected;
}

function httpd_basic_auth_handler(body, metadata, response) {
  if (basic_auth_matches(metadata, "guest", "guest")) {
    response.setStatusLine(metadata.httpVersion, 200, "OK, authorized");
    response.setHeader("WWW-Authenticate", 'Basic realm="secret"', false);
  } else {
    body = "This path exists and is protected - failed";
    response.setStatusLine(metadata.httpVersion, 401, "Unauthorized");
    response.setHeader("WWW-Authenticate", 'Basic realm="secret"', false);
  }
  writeBytesToOutputStream(response.bodyOutputStream, body);
}

/*
 * Represent a WBO on the server
 */
function ServerWBO(id, initialPayload, modified) {
  if (!id) {
    throw new Error("No ID for ServerWBO!");
  }
  this.id = id;
  if (!initialPayload) {
    return;
  }

  if (typeof initialPayload == "object") {
    initialPayload = JSON.stringify(initialPayload);
  }
  this.payload = initialPayload;
  this.modified = modified || new_timestamp();
  this.sortindex = 0;
}
ServerWBO.prototype = {
  get data() {
    return JSON.parse(this.payload);
  },

  get() {
    return { id: this.id, modified: this.modified, payload: this.payload };
  },

  put(input) {
    input = JSON.parse(input);
    this.payload = input.payload;
    this.modified = new_timestamp();
    this.sortindex = input.sortindex || 0;
  },

  delete() {
    delete this.payload;
    delete this.modified;
    delete this.sortindex;
  },

  // This handler sets `newModified` on the response body if the collection
  // timestamp has changed. This allows wrapper handlers to extract information
  // that otherwise would exist only in the body stream.
  handler() {
    let self = this;

    return function (request, response) {
      var statusCode = 200;
      var status = "OK";
      var body;

      switch (request.method) {
        case "GET":
          if (self.payload) {
            body = JSON.stringify(self.get());
          } else {
            statusCode = 404;
            status = "Not Found";
            body = "Not Found";
          }
          break;

        case "PUT":
          self.put(readBytesFromInputStream(request.bodyInputStream));
          body = JSON.stringify(self.modified);
          response.setHeader("Content-Type", "application/json");
          response.newModified = self.modified;
          break;

        case "DELETE": {
          self.delete();
          let ts = new_timestamp();
          body = JSON.stringify(ts);
          response.setHeader("Content-Type", "application/json");
          response.newModified = ts;
          break;
        }
      }
      response.setHeader("X-Weave-Timestamp", "" + new_timestamp(), false);
      response.setStatusLine(request.httpVersion, statusCode, status);
      writeBytesToOutputStream(response.bodyOutputStream, body);
    };
  },

  /**
   * Get the cleartext data stored in the payload.
   *
   * This isn't `get cleartext`, because `x.cleartext.blah = 3;` wouldn't work,
   * which seems like a footgun.
   */
  getCleartext() {
    return JSON.parse(JSON.parse(this.payload).ciphertext);
  },

  /**
   * Setter for getCleartext(), but lets you adjust the modified timestamp too.
   * Returns this ServerWBO object.
   */
  setCleartext(cleartext, modifiedTimestamp = this.modified) {
    this.payload = JSON.stringify(encryptPayload(cleartext));
    this.modified = modifiedTimestamp;
    return this;
  },
};

/**
 * Represent a collection on the server. The '_wbos' attribute is a
 * mapping of id -> ServerWBO objects.
 *
 * Note that if you want these records to be accessible individually,
 * you need to register their handlers with the server separately, or use a
 * containing HTTP server that will do so on your behalf.
 *
 * @param wbos
 *        An object mapping WBO IDs to ServerWBOs.
 * @param acceptNew
 *        If true, POSTs to this collection URI will result in new WBOs being
 *        created and wired in on the fly.
 * @param timestamp
 *        An optional timestamp value to initialize the modified time of the
 *        collection. This should be in the format returned by new_timestamp().
 *
 * @return the new ServerCollection instance.
 */
function ServerCollection(wbos, acceptNew, timestamp) {
  this._wbos = wbos || {};
  this.acceptNew = acceptNew || false;

  /*
   * Track modified timestamp.
   * We can't just use the timestamps of contained WBOs: an empty collection
   * has a modified time.
   */
  this.timestamp = timestamp || new_timestamp();
  this._log = Log.repository.getLogger(SYNC_HTTP_LOGGER);
}
ServerCollection.prototype = {
  /**
   * Convenience accessor for our WBO keys.
   * Excludes deleted items, of course.
   *
   * @param filter
   *        A predicate function (applied to the ID and WBO) which dictates
   *        whether to include the WBO's ID in the output.
   *
   * @return an array of IDs.
   */
  keys: function keys(filter) {
    let ids = [];
    for (let [id, wbo] of Object.entries(this._wbos)) {
      if (wbo.payload && (!filter || filter(id, wbo))) {
        ids.push(id);
      }
    }
    return ids;
  },

  /**
   * Convenience method to get an array of WBOs.
   * Optionally provide a filter function.
   *
   * @param filter
   *        A predicate function, applied to the WBO, which dictates whether to
   *        include the WBO in the output.
   *
   * @return an array of ServerWBOs.
   */
  wbos: function wbos(filter) {
    let os = [];
    for (let wbo of Object.values(this._wbos)) {
      if (wbo.payload) {
        os.push(wbo);
      }
    }

    if (filter) {
      return os.filter(filter);
    }
    return os;
  },

  /**
   * Convenience method to get an array of parsed ciphertexts.
   *
   * @return an array of the payloads of each stored WBO.
   */
  payloads() {
    return this.wbos().map(wbo => wbo.getCleartext());
  },

  // Just for syntactic elegance.
  wbo: function wbo(id) {
    return this._wbos[id];
  },

  payload: function payload(id) {
    return this.wbo(id).payload;
  },

  cleartext(id) {
    return this.wbo(id).getCleartext();
  },

  /**
   * Insert the provided WBO under its ID.
   *
   * @return the provided WBO.
   */
  insertWBO: function insertWBO(wbo) {
    this.timestamp = Math.max(this.timestamp, wbo.modified);
    return (this._wbos[wbo.id] = wbo);
  },

  /**
   * Update an existing WBO's cleartext using a callback function that modifies
   * the record in place, or returns a new record.
   */
  updateRecord(id, updateCallback, optTimestamp) {
    let wbo = this.wbo(id);
    if (!wbo) {
      throw new Error("No record with provided ID");
    }
    let curCleartext = wbo.getCleartext();
    // Allow update callback to either return a new cleartext, or modify in place.
    let newCleartext = updateCallback(curCleartext) || curCleartext;
    wbo.setCleartext(newCleartext, optTimestamp);
    // It is already inserted, but we might need to update our timestamp based
    // on it's `modified` value, if `optTimestamp` was provided.
    return this.insertWBO(wbo);
  },

  /**
   * Insert a record, which may either an object with a cleartext property, or
   * the cleartext property itself.
   */
  insertRecord(record, timestamp = Math.round(Date.now() / 10) / 100) {
    if (typeof timestamp != "number") {
      throw new TypeError("insertRecord: Timestamp is not a number.");
    }
    if (!record.id) {
      throw new Error("Attempt to insert record with no id");
    }
    // Allow providing either the cleartext directly, or the CryptoWrapper-like.
    let cleartext = record.cleartext || record;
    return this.insert(record.id, encryptPayload(cleartext), timestamp);
  },

  /**
   * Insert the provided payload as part of a new ServerWBO with the provided
   * ID.
   *
   * @param id
   *        The GUID for the WBO.
   * @param payload
   *        The payload, as provided to the ServerWBO constructor.
   * @param modified
   *        An optional modified time for the ServerWBO.
   *
   * @return the inserted WBO.
   */
  insert: function insert(id, payload, modified) {
    return this.insertWBO(new ServerWBO(id, payload, modified));
  },

  /**
   * Removes an object entirely from the collection.
   *
   * @param id
   *        (string) ID to remove.
   */
  remove: function remove(id) {
    delete this._wbos[id];
  },

  _inResultSet(wbo, options) {
    return (
      wbo.payload &&
      (!options.ids || options.ids.includes(wbo.id)) &&
      (!options.newer || wbo.modified > options.newer) &&
      (!options.older || wbo.modified < options.older)
    );
  },

  count(options) {
    options = options || {};
    let c = 0;
    for (let wbo of Object.values(this._wbos)) {
      if (wbo.modified && this._inResultSet(wbo, options)) {
        c++;
      }
    }
    return c;
  },

  get(options, request) {
    let data = [];
    for (let wbo of Object.values(this._wbos)) {
      if (wbo.modified && this._inResultSet(wbo, options)) {
        data.push(wbo);
      }
    }
    switch (options.sort) {
      case "newest":
        data.sort((a, b) => b.modified - a.modified);
        break;

      case "oldest":
        data.sort((a, b) => a.modified - b.modified);
        break;

      case "index":
        data.sort((a, b) => b.sortindex - a.sortindex);
        break;

      default:
        if (options.sort) {
          this._log.error(
            "Error: client requesting unknown sort order",
            options.sort
          );
          throw new Error("Unknown sort order");
        }
        // If the client didn't request a sort order, shuffle the records
        // to ensure that we don't accidentally depend on the default order.
        TestUtils.shuffle(data);
    }
    if (options.full) {
      data = data.map(wbo => wbo.get());
      let start = options.offset || 0;
      if (options.limit) {
        let numItemsPastOffset = data.length - start;
        data = data.slice(start, start + options.limit);
        // use options as a backchannel to set x-weave-next-offset
        if (numItemsPastOffset > options.limit) {
          options.nextOffset = start + options.limit;
        }
      } else if (start) {
        data = data.slice(start);
      }

      if (request && request.getHeader("accept") == "application/newlines") {
        this._log.error(
          "Error: client requesting application/newlines content"
        );
        throw new Error(
          "This server should not serve application/newlines content"
        );
      }

      // Use options as a backchannel to report count.
      options.recordCount = data.length;
    } else {
      data = data.map(wbo => wbo.id);
      let start = options.offset || 0;
      if (options.limit) {
        data = data.slice(start, start + options.limit);
        options.nextOffset = start + options.limit;
      } else if (start) {
        data = data.slice(start);
      }
      options.recordCount = data.length;
    }
    return JSON.stringify(data);
  },

  post(input) {
    input = JSON.parse(input);
    let success = [];
    let failed = {};

    // This will count records where we have an existing ServerWBO
    // registered with us as successful and all other records as failed.
    for (let key in input) {
      let record = input[key];
      let wbo = this.wbo(record.id);
      if (!wbo && this.acceptNew) {
        this._log.debug(
          "Creating WBO " + JSON.stringify(record.id) + " on the fly."
        );
        wbo = new ServerWBO(record.id);
        this.insertWBO(wbo);
      }
      if (wbo) {
        wbo.payload = record.payload;
        wbo.modified = new_timestamp();
        wbo.sortindex = record.sortindex || 0;
        success.push(record.id);
      } else {
        failed[record.id] = "no wbo configured";
      }
    }
    return { modified: new_timestamp(), success, failed };
  },

  delete(options) {
    let deleted = [];
    for (let wbo of Object.values(this._wbos)) {
      if (this._inResultSet(wbo, options)) {
        this._log.debug("Deleting " + JSON.stringify(wbo));
        deleted.push(wbo.id);
        wbo.delete();
      }
    }
    return deleted;
  },

  // This handler sets `newModified` on the response body if the collection
  // timestamp has changed.
  handler() {
    let self = this;

    return function (request, response) {
      var statusCode = 200;
      var status = "OK";
      var body;

      // Parse queryString
      let options = {};
      for (let chunk of request.queryString.split("&")) {
        if (!chunk) {
          continue;
        }
        chunk = chunk.split("=");
        if (chunk.length == 1) {
          options[chunk[0]] = "";
        } else {
          options[chunk[0]] = chunk[1];
        }
      }
      // The real servers return 400 if ids= is specified without a list of IDs.
      if (options.hasOwnProperty("ids")) {
        if (!options.ids) {
          response.setStatusLine(request.httpVersion, "400", "Bad Request");
          body = "Bad Request";
          writeBytesToOutputStream(response.bodyOutputStream, body);
          return;
        }
        options.ids = options.ids.split(",");
      }
      if (options.newer) {
        options.newer = parseFloat(options.newer);
      }
      if (options.older) {
        options.older = parseFloat(options.older);
      }
      if (options.limit) {
        options.limit = parseInt(options.limit, 10);
      }
      if (options.offset) {
        options.offset = parseInt(options.offset, 10);
      }

      switch (request.method) {
        case "GET": {
          body = self.get(options, request);
          // see http://moz-services-docs.readthedocs.io/en/latest/storage/apis-1.5.html
          // for description of these headers.
          let { recordCount: records, nextOffset } = options;

          self._log.info("Records: " + records + ", nextOffset: " + nextOffset);
          if (records != null) {
            response.setHeader("X-Weave-Records", "" + records);
          }
          if (nextOffset) {
            response.setHeader("X-Weave-Next-Offset", "" + nextOffset);
          }
          response.setHeader("X-Last-Modified", "" + self.timestamp);
          break;
        }

        case "POST": {
          let res = self.post(
            readBytesFromInputStream(request.bodyInputStream),
            request
          );
          body = JSON.stringify(res);
          response.newModified = res.modified;
          break;
        }

        case "DELETE": {
          self._log.debug("Invoking ServerCollection.DELETE.");
          let deleted = self.delete(options, request);
          let ts = new_timestamp();
          body = JSON.stringify(ts);
          response.newModified = ts;
          response.deleted = deleted;
          break;
        }
      }
      response.setHeader("X-Weave-Timestamp", "" + new_timestamp(), false);

      // Update the collection timestamp to the appropriate modified time.
      // This is either a value set by the handler, or the current time.
      if (request.method != "GET") {
        self.timestamp =
          response.newModified >= 0 ? response.newModified : new_timestamp();
      }
      response.setHeader("X-Last-Modified", "" + self.timestamp, false);

      response.setStatusLine(request.httpVersion, statusCode, status);
      writeBytesToOutputStream(response.bodyOutputStream, body);
    };
  },
};

/*
 * Test setup helpers.
 */
function sync_httpd_setup(handlers) {
  handlers["/1.1/foo/storage/meta/global"] = new ServerWBO(
    "global",
    {}
  ).handler();
  return httpd_setup(handlers);
}

/*
 * Track collection modified times. Return closures.
 *
 * XXX - DO NOT USE IN NEW TESTS
 *
 * This code has very limited and very hacky timestamp support - the test
 * server now has more complete and correct support - using this helper
 * may cause strangeness wrt timestamp headers and 412 responses.
 */
function track_collections_helper() {
  /*
   * Our tracking object.
   */
  let collections = {};

  /*
   * Update the timestamp of a collection.
   */
  function update_collection(coll, ts) {
    _("Updating collection " + coll + " to " + ts);
    let timestamp = ts || new_timestamp();
    collections[coll] = timestamp;
  }

  /*
   * Invoke a handler, updating the collection's modified timestamp unless
   * it's a GET request.
   */
  function with_updated_collection(coll, f) {
    return function (request, response) {
      f.call(this, request, response);

      // Update the collection timestamp to the appropriate modified time.
      // This is either a value set by the handler, or the current time.
      if (request.method != "GET") {
        update_collection(coll, response.newModified);
      }
    };
  }

  /*
   * Return the info/collections object.
   */
  function info_collections(request, response) {
    let body = "Error.";
    switch (request.method) {
      case "GET":
        body = JSON.stringify(collections);
        break;
      default:
        throw new Error("Non-GET on info_collections.");
    }

    response.setHeader("Content-Type", "application/json");
    response.setHeader("X-Weave-Timestamp", "" + new_timestamp(), false);
    response.setStatusLine(request.httpVersion, 200, "OK");
    writeBytesToOutputStream(response.bodyOutputStream, body);
  }

  return {
    collections,
    handler: info_collections,
    with_updated_collection,
    update_collection,
  };
}

// ===========================================================================//
// httpd.js-based Sync server.                                               //
// ===========================================================================//

/**
 * In general, the preferred way of using SyncServer is to directly introspect
 * it. Callbacks are available for operations which are hard to verify through
 * introspection, such as deletions.
 *
 * One of the goals of this server is to provide enough hooks for test code to
 * find out what it needs without monkeypatching. Use this object as your
 * prototype, and override as appropriate.
 */
var SyncServerCallback = {
  onCollectionDeleted: function onCollectionDeleted() {},
  onItemDeleted: function onItemDeleted() {},

  /**
   * Called at the top of every request.
   *
   * Allows the test to inspect the request. Hooks should be careful not to
   * modify or change state of the request or they may impact future processing.
   * The response is also passed so the callback can set headers etc - but care
   * must be taken to not screw with the response body or headers that may
   * conflict with normal operation of this server.
   */
  onRequest: function onRequest() {},
};

/**
 * Construct a new test Sync server. Takes a callback object (e.g.,
 * SyncServerCallback) as input.
 */
function SyncServer(callback) {
  this.callback = callback || Object.create(SyncServerCallback);
  this.server = new HttpServer();
  this.started = false;
  this.users = {};
  this._log = Log.repository.getLogger(SYNC_HTTP_LOGGER);

  // Install our own default handler. This allows us to mess around with the
  // whole URL space.
  let handler = this.server._handler;
  handler._handleDefault = this.handleDefault.bind(this, handler);
}
SyncServer.prototype = {
  server: null, // HttpServer.
  users: null, // Map of username => {collections, password}.

  /**
   * Start the SyncServer's underlying HTTP server.
   *
   * @param port
   *        The numeric port on which to start. -1 implies the default, a
   *        randomly chosen port.
   * @param cb
   *        A callback function (of no arguments) which is invoked after
   *        startup.
   */
  start: function start(port = -1, cb) {
    if (this.started) {
      this._log.warn("Warning: server already started on " + this.port);
      return;
    }
    try {
      this.server.start(port);
      let i = this.server.identity;
      this.port = i.primaryPort;
      this.baseURI =
        i.primaryScheme + "://" + i.primaryHost + ":" + i.primaryPort + "/";
      this.started = true;
      if (cb) {
        cb();
      }
    } catch (ex) {
      _("==========================================");
      _("Got exception starting Sync HTTP server.");
      _("Error: " + Log.exceptionStr(ex));
      _("Is there a process already listening on port " + port + "?");
      _("==========================================");
      do_throw(ex);
    }
  },

  /**
   * Stop the SyncServer's HTTP server.
   *
   * @param cb
   *        A callback function. Invoked after the server has been stopped.
   */
  stop: function stop(cb) {
    if (!this.started) {
      this._log.warn(
        "SyncServer: Warning: server not running. Can't stop me now!"
      );
      return;
    }

    this.server.stop(cb);
    this.started = false;
  },

  /**
   * Return a server timestamp for a record.
   * The server returns timestamps with 1/100 sec granularity. Note that this is
   * subject to change: see Bug 650435.
   */
  timestamp: function timestamp() {
    return new_timestamp();
  },

  /**
   * Create a new user, complete with an empty set of collections.
   *
   * @param username
   *        The username to use. An Error will be thrown if a user by that name
   *        already exists.
   * @param password
   *        A password string.
   *
   * @return a user object, as would be returned by server.user(username).
   */
  registerUser: function registerUser(username, password) {
    if (username in this.users) {
      throw new Error("User already exists.");
    }
    this.users[username] = {
      password,
      collections: {},
    };
    return this.user(username);
  },

  userExists: function userExists(username) {
    return username in this.users;
  },

  getCollection: function getCollection(username, collection) {
    return this.users[username].collections[collection];
  },

  _insertCollection: function _insertCollection(collections, collection, wbos) {
    let coll = new ServerCollection(wbos, true);
    coll.collectionHandler = coll.handler();
    collections[collection] = coll;
    return coll;
  },

  createCollection: function createCollection(username, collection, wbos) {
    if (!(username in this.users)) {
      throw new Error("Unknown user.");
    }
    let collections = this.users[username].collections;
    if (collection in collections) {
      throw new Error("Collection already exists.");
    }
    return this._insertCollection(collections, collection, wbos);
  },

  /**
   * Accept a map like the following:
   * {
   *   meta: {global: {version: 1, ...}},
   *   crypto: {"keys": {}, foo: {bar: 2}},
   *   bookmarks: {}
   * }
   * to cause collections and WBOs to be created.
   * If a collection already exists, no error is raised.
   * If a WBO already exists, it will be updated to the new contents.
   */
  createContents: function createContents(username, collections) {
    if (!(username in this.users)) {
      throw new Error("Unknown user.");
    }
    let userCollections = this.users[username].collections;
    for (let [id, contents] of Object.entries(collections)) {
      let coll =
        userCollections[id] || this._insertCollection(userCollections, id);
      for (let [wboID, payload] of Object.entries(contents)) {
        coll.insert(wboID, payload);
      }
    }
  },

  /**
   * Insert a WBO in an existing collection.
   */
  insertWBO: function insertWBO(username, collection, wbo) {
    if (!(username in this.users)) {
      throw new Error("Unknown user.");
    }
    let userCollections = this.users[username].collections;
    if (!(collection in userCollections)) {
      throw new Error("Unknown collection.");
    }
    userCollections[collection].insertWBO(wbo);
    return wbo;
  },

  /**
   * Delete all of the collections for the named user.
   *
   * @param username
   *        The name of the affected user.
   *
   * @return a timestamp.
   */
  deleteCollections: function deleteCollections(username) {
    if (!(username in this.users)) {
      throw new Error("Unknown user.");
    }
    let userCollections = this.users[username].collections;
    for (let name in userCollections) {
      let coll = userCollections[name];
      this._log.trace("Bulk deleting " + name + " for " + username + "...");
      coll.delete({});
    }
    this.users[username].collections = {};
    return this.timestamp();
  },

  /**
   * Simple accessor to allow collective binding and abbreviation of a bunch of
   * methods. Yay!
   * Use like this:
   *
   *   let u = server.user("john");
   *   u.collection("bookmarks").wbo("abcdefg").payload;  // Etc.
   *
   * @return a proxy for the user data stored in this server.
   */
  user: function user(username) {
    let collection = this.getCollection.bind(this, username);
    let createCollection = this.createCollection.bind(this, username);
    let createContents = this.createContents.bind(this, username);
    let modified = function (collectionName) {
      return collection(collectionName).timestamp;
    };
    let deleteCollections = this.deleteCollections.bind(this, username);
    return {
      collection,
      createCollection,
      createContents,
      deleteCollections,
      modified,
    };
  },

  /*
   * Regular expressions for splitting up Sync request paths.
   * Sync URLs are of the form:
   *   /$apipath/$version/$user/$further
   * where $further is usually:
   *   storage/$collection/$wbo
   * or
   *   storage/$collection
   * or
   *   info/$op
   * We assume for the sake of simplicity that $apipath is empty.
   *
   * N.B., we don't follow any kind of username spec here, because as far as I
   * can tell there isn't one. See Bug 689671. Instead we follow the Python
   * server code.
   *
   * Path: [all, version, username, first, rest]
   * Storage: [all, collection?, id?]
   */
  pathRE:
    /^\/([0-9]+(?:\.[0-9]+)?)\/([-._a-zA-Z0-9]+)(?:\/([^\/]+)(?:\/(.+))?)?$/,
  storageRE: /^([-_a-zA-Z0-9]+)(?:\/([-_a-zA-Z0-9]+)\/?)?$/,

  defaultHeaders: {},

  /**
   * HTTP response utility.
   */
  respond: function respond(req, resp, code, status, body, headers) {
    resp.setStatusLine(req.httpVersion, code, status);
    if (!headers) {
      headers = this.defaultHeaders;
    }
    for (let header in headers) {
      let value = headers[header];
      resp.setHeader(header, value);
    }
    resp.setHeader("X-Weave-Timestamp", "" + this.timestamp(), false);
    writeBytesToOutputStream(resp.bodyOutputStream, body);
  },

  /**
   * This is invoked by the HttpServer. `this` is bound to the SyncServer;
   * `handler` is the HttpServer's handler.
   *
   * TODO: need to use the correct Sync API response codes and errors here.
   * TODO: Basic Auth.
   * TODO: check username in path against username in BasicAuth.
   */
  handleDefault: function handleDefault(handler, req, resp) {
    try {
      this._handleDefault(handler, req, resp);
    } catch (e) {
      if (e instanceof HttpError) {
        this.respond(req, resp, e.code, e.description, "", {});
      } else {
        throw e;
      }
    }
  },

  _handleDefault: function _handleDefault(handler, req, resp) {
    this._log.debug(
      "SyncServer: Handling request: " + req.method + " " + req.path
    );

    if (this.callback.onRequest) {
      this.callback.onRequest(req, resp);
    }

    let parts = this.pathRE.exec(req.path);
    if (!parts) {
      this._log.debug("SyncServer: Unexpected request: bad URL " + req.path);
      throw HTTP_404;
    }

    let [, version, username, first, rest] = parts;
    // Doing a float compare of the version allows for us to pretend there was
    // a node-reassignment - eg, we could re-assign from "1.1/user/" to
    // "1.10/user" - this server will then still accept requests with the new
    // URL while any code in sync itself which compares URLs will see a
    // different URL.
    if (parseFloat(version) != parseFloat(SYNC_API_VERSION)) {
      this._log.debug("SyncServer: Unknown version.");
      throw HTTP_404;
    }

    if (!this.userExists(username)) {
      this._log.debug("SyncServer: Unknown user.");
      throw HTTP_401;
    }

    // Hand off to the appropriate handler for this path component.
    if (first in this.toplevelHandlers) {
      let newHandler = this.toplevelHandlers[first];
      return newHandler.call(
        this,
        newHandler,
        req,
        resp,
        version,
        username,
        rest
      );
    }
    this._log.debug("SyncServer: Unknown top-level " + first);
    throw HTTP_404;
  },

  /**
   * Compute the object that is returned for an info/collections request.
   */
  infoCollections: function infoCollections(username) {
    let responseObject = {};
    let colls = this.users[username].collections;
    for (let coll in colls) {
      responseObject[coll] = colls[coll].timestamp;
    }
    this._log.trace(
      "SyncServer: info/collections returning " + JSON.stringify(responseObject)
    );
    return responseObject;
  },

  /**
   * Collection of the handler methods we use for top-level path components.
   */
  toplevelHandlers: {
    storage: function handleStorage(
      handler,
      req,
      resp,
      version,
      username,
      rest
    ) {
      let respond = this.respond.bind(this, req, resp);
      if (!rest || !rest.length) {
        this._log.debug(
          "SyncServer: top-level storage " + req.method + " request."
        );

        // TODO: verify if this is spec-compliant.
        if (req.method != "DELETE") {
          respond(405, "Method Not Allowed", "[]", { Allow: "DELETE" });
          return undefined;
        }

        // Delete all collections and track the timestamp for the response.
        let timestamp = this.user(username).deleteCollections();

        // Return timestamp and OK for deletion.
        respond(200, "OK", JSON.stringify(timestamp));
        return undefined;
      }

      let match = this.storageRE.exec(rest);
      if (!match) {
        this._log.warn("SyncServer: Unknown storage operation " + rest);
        throw HTTP_404;
      }
      let [, collection, wboID] = match;
      let coll = this.getCollection(username, collection);

      let checkXIUSFailure = () => {
        if (req.hasHeader("x-if-unmodified-since")) {
          let xius = parseFloat(req.getHeader("x-if-unmodified-since"));
          // Sadly the way our tests are setup, we often end up with xius of
          // zero (typically when syncing just one engine, so the date from
          // info/collections isn't used) - so we allow that to work.
          // Further, the Python server treats non-existing collections as
          // having a timestamp of 0.
          let collTimestamp = coll ? coll.timestamp : 0;
          if (xius && xius < collTimestamp) {
            this._log.info(
              `x-if-unmodified-since mismatch - request wants ${xius} but our collection has ${collTimestamp}`
            );
            respond(412, "precondition failed", "precondition failed");
            return true;
          }
        }
        return false;
      };

      switch (req.method) {
        case "GET": {
          if (!coll) {
            if (wboID) {
              respond(404, "Not found", "Not found");
              return undefined;
            }
            // *cries inside*: - apparently the real sync server returned 200
            // here for some time, then returned 404 for some time (bug 687299),
            // and now is back to 200 (bug 963332).
            respond(200, "OK", "[]");
            return undefined;
          }
          if (!wboID) {
            return coll.collectionHandler(req, resp);
          }
          let wbo = coll.wbo(wboID);
          if (!wbo) {
            respond(404, "Not found", "Not found");
            return undefined;
          }
          return wbo.handler()(req, resp);
        }
        case "DELETE": {
          if (!coll) {
            respond(200, "OK", "{}");
            return undefined;
          }
          if (checkXIUSFailure()) {
            return undefined;
          }
          if (wboID) {
            let wbo = coll.wbo(wboID);
            if (wbo) {
              wbo.delete();
              this.callback.onItemDeleted(username, collection, wboID);
            }
            respond(200, "OK", "{}");
            return undefined;
          }
          coll.collectionHandler(req, resp);

          // Spot if this is a DELETE for some IDs, and don't blow away the
          // whole collection!
          //
          // We already handled deleting the WBOs by invoking the deleted
          // collection's handler. However, in the case of
          //
          //   DELETE storage/foobar
          //
          // we also need to remove foobar from the collections map. This
          // clause tries to differentiate the above request from
          //
          //  DELETE storage/foobar?ids=foo,baz
          //
          // and do the right thing.
          // TODO: less hacky method.
          if (-1 == req.queryString.indexOf("ids=")) {
            // When you delete the entire collection, we drop it.
            this._log.debug("Deleting entire collection.");
            delete this.users[username].collections[collection];
            this.callback.onCollectionDeleted(username, collection);
          }

          // Notify of item deletion.
          let deleted = resp.deleted || [];
          for (let i = 0; i < deleted.length; ++i) {
            this.callback.onItemDeleted(username, collection, deleted[i]);
          }
          return undefined;
        }
        case "PUT":
          // PUT and POST have slightly different XIUS semantics - for PUT,
          // the check is against the item, whereas for POST it is against
          // the collection. So first, a special-case for PUT.
          if (req.hasHeader("x-if-unmodified-since")) {
            let xius = parseFloat(req.getHeader("x-if-unmodified-since"));
            // treat and xius of zero as if it wasn't specified - this happens
            // in some of our tests for a new collection.
            if (xius > 0) {
              let wbo = coll.wbo(wboID);
              if (xius < wbo.modified) {
                this._log.info(
                  `x-if-unmodified-since mismatch - request wants ${xius} but wbo has ${wbo.modified}`
                );
                respond(412, "precondition failed", "precondition failed");
                return undefined;
              }
              wbo.handler()(req, resp);
              coll.timestamp = resp.newModified;
              return resp;
            }
          }
        // fall through to post.
        case "POST":
          if (checkXIUSFailure()) {
            return undefined;
          }
          if (!coll) {
            coll = this.createCollection(username, collection);
          }

          if (wboID) {
            let wbo = coll.wbo(wboID);
            if (!wbo) {
              this._log.trace(
                "SyncServer: creating WBO " + collection + "/" + wboID
              );
              wbo = coll.insert(wboID);
            }
            // Rather than instantiate each WBO's handler function, do it once
            // per request. They get hit far less often than do collections.
            wbo.handler()(req, resp);
            coll.timestamp = resp.newModified;
            return resp;
          }
          return coll.collectionHandler(req, resp);
        default:
          throw new Error("Request method " + req.method + " not implemented.");
      }
    },

    info: function handleInfo(handler, req, resp, version, username, rest) {
      switch (rest) {
        case "collections": {
          let body = JSON.stringify(this.infoCollections(username));
          this.respond(req, resp, 200, "OK", body, {
            "Content-Type": "application/json",
          });
          return;
        }
        case "collection_usage":
        case "collection_counts":
        case "quota":
          // TODO: implement additional info methods.
          this.respond(req, resp, 200, "OK", "TODO");
          return;
        default:
          // TODO
          this._log.warn("SyncServer: Unknown info operation " + rest);
          throw HTTP_404;
      }
    },
  },
};

/**
 * Test helper.
 */
function serverForUsers(users, contents, callback) {
  let server = new SyncServer(callback);
  for (let [user, pass] of Object.entries(users)) {
    server.registerUser(user, pass);
    server.createContents(user, contents);
  }
  server.start();
  return server;
}
