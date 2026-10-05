/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { ZenFirefoxProfileMigrator, FirefoxImportPolicies } =
  ChromeUtils.importESModule(
    "resource:///modules/ZenFirefoxProfileMigrator.sys.mjs"
  );
const { MigrationUtils } = ChromeUtils.importESModule(
  "resource:///modules/MigrationUtils.sys.mjs"
);
const { Sqlite } = ChromeUtils.importESModule(
  "resource://gre/modules/Sqlite.sys.mjs"
);
const { PromiseTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PromiseTestUtils.sys.mjs"
);
// Zen's existing sync tests also exclude this unrelated startup rejection.
PromiseTestUtils.allowMatchingRejectionsGlobally(
  /\[fluent\] Couldn't find a message: menu-bookmark-tab/
);
const TYPES = MigrationUtils.resourceTypes;

async function sourceProfile() {
  const root = await IOUtils.createUniqueDirectory(
    PathUtils.tempDir,
    "zen-import-test",
    0o700
  );
  const path = PathUtils.join(root, "profile");
  await IOUtils.makeDirectory(path);
  await IOUtils.writeUTF8(
    PathUtils.join(root, "profiles.ini"),
    "[Profile0]\nName=Import fixture\nIsRelative=1\nPath=profile\n"
  );
  const migrator = new ZenFirefoxProfileMigrator();
  migrator.getProfileRoots = () => [root];
  const [profile] = await migrator.getSourceProfiles();
  registerCleanupFunction(() => IOUtils.remove(root, { recursive: true }));
  return { root, path, profile, migrator };
}

async function sourceCookies(path, cookies) {
  const db = await Sqlite.openConnection({
    path: PathUtils.join(path, "cookies.sqlite"),
  });
  try {
    await db.setSchemaVersion(17);
    await db.execute(
      "CREATE TABLE moz_cookies (host TEXT, path TEXT, name TEXT, value TEXT, expiry INTEGER, isSecure INTEGER, isHttpOnly INTEGER, sameSite INTEGER, schemeMap INTEGER, isPartitioned INTEGER, originAttributes TEXT)"
    );
    for (const cookie of cookies) {
      await db.execute(
        "INSERT INTO moz_cookies VALUES (:host, '/', :name, :value, :expiry, 1, 1, 0, 2, 0, :attributes)",
        {
          expiry: Date.now() + 86400000,
          attributes: "",
          ...cookie,
        }
      );
    }
  } finally {
    await db.close();
  }
}

async function importProfile(fixture, items, onProgress = () => {}) {
  const results = new Map();
  await fixture.migrator.migrate(
    items,
    false,
    fixture.profile,
    (type, success, details) => {
      results.set(type, { success, ...details });
      onProgress(type, details);
    }
  );
  return results;
}

add_task(async function rejects_current_profile_and_respects_lock() {
  Assert.throws(
    () => FirefoxImportPolicies.validateProfile(PathUtils.profileDir),
    /profile/
  );
  const fixture = await sourceProfile();
  const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  file.initWithPath(fixture.path);
  const { AppConstants } = ChromeUtils.importESModule(
    "resource://gre/modules/AppConstants.sys.mjs"
  );
  let release;
  if (AppConstants.platform === "win") {
    const lock = Cc["@mozilla.org/zen/common-utils;1"]
      .getService(Ci.nsIZenCommonUtils)
      .lockFirefoxProfile(file);
    release = () => lock.unlock();
  } else {
    // POSIX record locks belong to a process. A second lock in this same
    // browser would succeed, so hold the source lock in a separate process.
    const { Subprocess } = ChromeUtils.importESModule(
      "resource://gre/modules/Subprocess.sys.mjs"
    );
    const code = [
      "import fcntl, sys",
      "lock = open(sys.argv[1], 'a+')",
      "fcntl.lockf(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)",
      "print('READY', flush=True)",
      "sys.stdin.buffer.read(1)",
    ].join("\n");
    const child = await Subprocess.call({
      command: await Subprocess.pathSearch("python3"),
      arguments: ["-c", code, PathUtils.join(fixture.path, ".parentlock")],
    });
    release = async () => {
      child.kill();
      await child.wait();
    };
    await child.stdout.readString(6);
  }
  try {
    const results = await importProfile(
      fixture,
      TYPES.BOOKMARKS | TYPES.COOKIES
    );
    is(
      results.get(TYPES.BOOKMARKS).reason,
      "locked",
      "A locked source is not copied"
    );
    is(
      results.get(TYPES.COOKIES).imported,
      0,
      "No destination data is written"
    );
  } finally {
    await release();
  }
});

add_task(
  async function keeps_existing_website_cookie_groups_and_deduplicates() {
    const fixture = await sourceProfile();
    const occupied = "accounts.zen-import-existing.example";
    const fresh = "zen-import-fresh.example";
    Services.cookies.add(
      occupied,
      "/",
      "zen",
      "keep",
      true,
      true,
      false,
      Date.now() + 86400000,
      {},
      Ci.nsICookie.SAMESITE_NONE,
      Ci.nsICookie.SCHEME_HTTPS
    );
    registerCleanupFunction(() => {
      for (const cookie of Services.cookies.cookies) {
        if (cookie.host.includes("zen-import-")) {
          Services.cookies.remove(
            cookie.host,
            cookie.name,
            cookie.path,
            cookie.originAttributes
          );
        }
      }
    });
    await sourceCookies(fixture.path, [
      { host: ".zen-import-existing.example", name: "firefox", value: "skip" },
      { host: fresh, name: "session", value: "import" },
      {
        host: fresh,
        name: "expired",
        value: "skip",
        expiry: Date.now() - 1000,
      },
      {
        host: fresh,
        name: "private",
        value: "skip",
        attributes: "^privateBrowsingId=1",
      },
      { host: fresh, name: "bad-expiry", value: "skip", expiry: 0 },
    ]);
    const original = await IOUtils.computeHexDigest(
      PathUtils.join(fixture.path, "cookies.sqlite"),
      "sha256"
    );
    let results = await importProfile(fixture, TYPES.COOKIES);
    is(
      results.get(TYPES.COOKIES).imported,
      1,
      "Only a new valid website cookie is imported"
    );
    is(
      results.get(TYPES.COOKIES).skipped,
      4,
      "Existing sites, expired, private and invalid cookies are skipped"
    );
    const all = Array.from(Services.cookies.cookies);
    is(
      all.find(cookie => cookie.host === occupied && cookie.name === "zen")
        .value,
      "keep",
      "Zen sign-in is preserved"
    );
    ok(
      !all.some(
        cookie =>
          cookie.name === "firefox" &&
          cookie.host.includes("zen-import-existing")
      ),
      "No token mixing across the site"
    );
    results = await importProfile(fixture, TYPES.COOKIES);
    is(
      results.get(TYPES.COOKIES).imported,
      0,
      "Repeating an import does not replace existing website cookies"
    );
    is(
      await IOUtils.computeHexDigest(
        PathUtils.join(fixture.path, "cookies.sqlite"),
        "sha256"
      ),
      original,
      "Firefox database is unchanged"
    );
    is(
      FirefoxImportPolicies.cookieExpiry(2000000000, 15),
      2000000000000,
      "Older cookie timestamps convert seconds to milliseconds"
    );
  }
);

add_task(async function preserves_bookmark_hierarchy_and_repeated_imports() {
  const fixture = await sourceProfile();
  const db = await Sqlite.openConnection({
    path: PathUtils.join(fixture.path, "places.sqlite"),
  });
  const url = "https://zen-import-bookmark.example/";
  try {
    await db.execute(
      "CREATE TABLE moz_bookmarks (id INTEGER, parent INTEGER, type INTEGER, title TEXT, guid TEXT, fk INTEGER, position INTEGER)"
    );
    await db.execute(
      "CREATE TABLE moz_places (id INTEGER, url TEXT, title TEXT)"
    );
    await db.execute(
      "CREATE TABLE moz_historyvisits (place_id INTEGER, visit_date INTEGER, visit_type INTEGER)"
    );
    await db.execute("INSERT INTO moz_places VALUES (1, :url, 'Fixture')", {
      url,
    });
    await db.execute(
      "INSERT INTO moz_bookmarks VALUES (1, 0, 2, '', 'toolbar_____', NULL, 0), (2, 1, 2, 'Import folder fixture', 'folderone___', NULL, 0), (3, 1, 2, 'Import folder fixture', 'foldertwo___', NULL, 1), (4, 2, 1, 'Fixture', 'bookmarkone_', 1, 0), (5, 3, 1, 'Fixture', 'bookmarktwo_', 1, 0)"
    );
    await db.execute("INSERT INTO moz_historyvisits VALUES (1, :date, 1)", {
      date: (Date.now() - 60000) * 1000 + 321,
    });
  } finally {
    await db.close();
  }
  registerCleanupFunction(async () => {
    const folders = [];
    await PlacesUtils.bookmarks.fetch(
      { parentGuid: PlacesUtils.bookmarks.toolbarGuid },
      bookmark => {
        if (
          ["Import folder fixture", "Import folder fixture"].includes(
            bookmark.title
          )
        ) {
          folders.push(bookmark);
        }
      }
    );
    for (const folder of folders) {
      await PlacesUtils.bookmarks.remove(folder.guid);
    }
    await PlacesUtils.history.remove(url);
  });
  let results = await importProfile(fixture, TYPES.BOOKMARKS | TYPES.HISTORY);
  is(
    results.get(TYPES.BOOKMARKS).imported,
    4,
    "Both folders and intentionally repeated URLs are imported"
  );
  is(results.get(TYPES.HISTORY).imported, 1, "History imports a valid visit");
  const bookmarks = [];
  await PlacesUtils.bookmarks.fetch({ url }, value => bookmarks.push(value));
  is(bookmarks.length, 2, "A URL in two distinct folders is preserved");
  isnot(
    bookmarks[0].parentGuid,
    bookmarks[1].parentGuid,
    "Identically named source folders remain separate"
  );
  results = await importProfile(fixture, TYPES.BOOKMARKS | TYPES.HISTORY);
  is(
    results.get(TYPES.BOOKMARKS).imported,
    0,
    "Repeated import keeps folder contents unique"
  );
  is(
    results.get(TYPES.HISTORY).imported,
    0,
    "Repeated import does not add visits"
  );
});

add_task(
  async function category_failures_and_cancellation_keep_successful_data() {
    const fixture = await sourceProfile();
    await IOUtils.writeUTF8(
      PathUtils.join(fixture.path, "places.sqlite"),
      "corrupt fixture"
    );
    await sourceCookies(fixture.path, [
      { host: "zen-import-partial.example", name: "fixture", value: "kept" },
    ]);
    registerCleanupFunction(() =>
      Services.cookies.remove("zen-import-partial.example", "fixture", "/", {})
    );
    const before = (await IOUtils.getChildren(PathUtils.tempDir)).filter(path =>
      PathUtils.filename(path).startsWith("zen-firefox-import")
    );
    let results = await importProfile(fixture, TYPES.BOOKMARKS | TYPES.COOKIES);
    ok(
      !results.get(TYPES.BOOKMARKS).success,
      "A corrupt category reports failure"
    );
    is(
      results.get(TYPES.COOKIES).imported,
      1,
      "An independent category still succeeds"
    );
    results = await importProfile(
      fixture,
      TYPES.BOOKMARKS | TYPES.COOKIES,
      type => {
        if (type === TYPES.BOOKMARKS) {
          fixture.migrator.cancel();
        }
      }
    );
    is(
      results.get(TYPES.COOKIES).reason,
      "cancelled",
      "Cancellation stops later categories"
    );
    is(
      Services.cookies.getCookiesFromHost("zen-import-partial.example", {})[0]
        .value,
      "kept",
      "Earlier successful data remains"
    );
    const after = (await IOUtils.getChildren(PathUtils.tempDir)).filter(path =>
      PathUtils.filename(path).startsWith("zen-firefox-import")
    );
    Assert.deepEqual(
      after.sort(),
      before.sort(),
      "Encrypted temporary snapshots are cleaned up"
    );
  }
);

add_task(async function login_conflict_keys_do_not_collide() {
  const common = {
    origin: "https://example.com",
    formActionOrigin: "https://example.com",
    httpRealm: null,
  };
  is(
    FirefoxImportPolicies.loginKey({ ...common, username: "alice" }),
    FirefoxImportPolicies.loginKey({
      hostname: common.origin,
      formSubmitURL: common.formActionOrigin,
      username: "alice",
    }),
    "Old and new Firefox formats use the same conflict key"
  );
  isnot(
    FirefoxImportPolicies.loginKey({ ...common, username: "alice" }),
    FirefoxImportPolicies.loginKey({ ...common, username: "bob" }),
    "Distinct website accounts remain separate"
  );
});

add_task(
  async function unsupported_password_keys_do_not_block_other_categories() {
    const fixture = await sourceProfile();
    await IOUtils.writeUTF8(
      PathUtils.join(fixture.path, "key3.db"),
      "unsupported legacy fixture"
    );
    await IOUtils.writeJSON(PathUtils.join(fixture.path, "logins.json"), {
      version: 3,
      logins: [],
    });
    await sourceCookies(fixture.path, [
      { host: "zen-import-legacy.example", name: "fixture", value: "imported" },
    ]);
    registerCleanupFunction(() =>
      Services.cookies.remove("zen-import-legacy.example", "fixture", "/", {})
    );
    const results = await importProfile(
      fixture,
      TYPES.PASSWORDS | TYPES.COOKIES
    );
    is(
      results.get(TYPES.PASSWORDS).reason,
      "unsupported",
      "Legacy keys are reported as unsupported"
    );
    is(
      results.get(TYPES.COOKIES).imported,
      1,
      "Supported website sign-ins still import"
    );
  }
);

add_task(async function imports_passwords_without_replacing_zen_logins() {
  const fixture = await sourceProfile();
  const origin = "https://zen-import-password.example";
  const current = Cc["@mozilla.org/login-manager/loginInfo;1"].createInstance(
    Ci.nsILoginInfo
  );
  current.init(origin, origin, null, "alice", "zen-password", "", "");
  const saved = await Services.logins.addLoginAsync(current);
  registerCleanupFunction(async () => {
    for (const login of await Services.logins.searchLoginsAsync({ origin })) {
      await Services.logins.removeLoginAsync(login);
    }
  });
  const crypto = Cc["@mozilla.org/login-manager/crypto/SDR;1"].getService(
    Ci.nsILoginManagerCrypto
  );
  const records = ["alice", "bob"].map(username => ({
    hostname: origin,
    formSubmitURL: origin,
    httpRealm: null,
    guid: saved.guid,
    encryptedUsername: crypto.encrypt(username),
    encryptedPassword: crypto.encrypt("firefox-password"),
    timePasswordChanged: Date.now() + 60000,
  }));
  await IOUtils.writeJSON(PathUtils.join(fixture.path, "logins.json"), {
    version: 3,
    logins: records,
  });
  for (const name of ["key4.db", "key4.db-wal", "cert9.db", "cert9.db-wal"]) {
    const source = PathUtils.join(PathUtils.profileDir, name);
    if (await IOUtils.exists(source)) {
      await IOUtils.copy(source, PathUtils.join(fixture.path, name));
    }
  }
  const results = await importProfile(fixture, TYPES.PASSWORDS);
  is(
    results.get(TYPES.PASSWORDS).reason,
    "complete",
    "The isolated helper unlocks an unprotected fixture"
  );
  is(results.get(TYPES.PASSWORDS).imported, 1, "A second account is imported");
  is(
    results.get(TYPES.PASSWORDS).skipped,
    1,
    "The existing account is skipped even with a newer source timestamp"
  );
  const logins = await Services.logins.searchLoginsAsync({ origin });
  is(
    logins.find(login => login.username === "alice").password,
    "zen-password",
    "Zen password remains unchanged"
  );
  is(
    logins.find(login => login.username === "bob").password,
    "firefox-password",
    "New account decrypts correctly"
  );
  isnot(
    logins.find(login => login.username === "bob").guid,
    saved.guid,
    "Source GUID is never reused"
  );
});

add_task(
  async function remaps_container_ids_and_preserves_partitioned_sessions() {
    const { ContextualIdentityService } = ChromeUtils.importESModule(
      "moz-src:///toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs"
    );
    const fixture = await sourceProfile();
    const target = ContextualIdentityService.create(
      "Firefox import fixture",
      "briefcase",
      "blue"
    );
    const host = "zen-import-container.example";
    const attributes = { userContextId: target.userContextId };
    Services.cookies.add(
      host,
      "/",
      "zen",
      "keep",
      true,
      true,
      false,
      Date.now() + 86400000,
      attributes,
      Ci.nsICookie.SAMESITE_NONE,
      Ci.nsICookie.SCHEME_HTTPS
    );
    registerCleanupFunction(() => {
      for (const cookie of Services.cookies.cookies) {
        if (cookie.host === host) {
          Services.cookies.remove(
            cookie.host,
            cookie.name,
            cookie.path,
            cookie.originAttributes
          );
        }
      }
      ContextualIdentityService.remove(target.userContextId);
    });
    await IOUtils.writeJSON(PathUtils.join(fixture.path, "containers.json"), {
      identities: [
        {
          userContextId: 4000,
          name: "Firefox import fixture",
          icon: "briefcase",
          color: "blue",
          public: true,
        },
      ],
    });
    await sourceCookies(fixture.path, [
      {
        host,
        name: "firefox",
        value: "skip",
        attributes: "^userContextId=4000",
      },
      {
        host,
        name: "unknown",
        value: "skip",
        attributes: "^userContextId=4001",
      },
    ]);
    await IOUtils.writeJSON(
      PathUtils.join(fixture.path, "sessionstore.jsonlz4"),
      {
        cookies: [
          {
            host,
            path: "/",
            name: "partitioned",
            value: "import",
            secure: true,
            httponly: true,
            originAttributes: {
              userContextId: 4000,
              partitionKey: "(https,partition.example)",
            },
          },
        ],
      },
      { compress: true }
    );
    const results = await importProfile(fixture, TYPES.COOKIES);
    is(
      results.get(TYPES.COOKIES).imported,
      1,
      "A separate partition's session cookie is imported"
    );
    is(
      results.get(TYPES.COOKIES).skipped,
      2,
      "Existing container sign-in and unknown container stay untouched"
    );
    const cookies = Array.from(Services.cookies.cookies).filter(
      cookie => cookie.host === host
    );
    const imported = cookies.find(cookie => cookie.name === "partitioned");
    is(
      imported.originAttributes.userContextId,
      target.userContextId,
      "Source numeric container ID is remapped"
    );
    is(
      imported.originAttributes.partitionKey,
      "(https,partition.example)",
      "Partition identity is preserved"
    );
    ok(imported.isSession, "A session cookie remains a session cookie");
    is(
      cookies.find(cookie => cookie.name === "zen").value,
      "keep",
      "Existing unpartitioned container sign-in is preserved"
    );
  }
);

add_task(
  async function reads_current_password_database_instead_of_stale_json() {
    const { initialize } = ChromeUtils.importESModule(
      "moz-src:///toolkit/components/uniffi-bindgen-gecko-js/components/generated/RustInitRustComponents.sys.mjs"
    );
    const {
      PrimaryPasswordAuthenticator,
      LoginEntry,
      createLoginStoreWithNssKeymanager,
    } = ChromeUtils.importESModule(
      "moz-src:///toolkit/components/uniffi-bindgen-gecko-js/components/generated/RustLogins.sys.mjs"
    );
    class FixtureAuthenticator extends PrimaryPasswordAuthenticator {
      async getPrimaryPassword() {
        return "";
      }
      async onAuthenticationSuccess() {}
      async onAuthenticationFailure() {
        throw new Error("Fixture authentication failed");
      }
    }
    const fixture = await sourceProfile();
    const origin = "https://zen-import-rust-password.example";
    registerCleanupFunction(async () => {
      for (const login of await Services.logins.searchLoginsAsync({ origin })) {
        await Services.logins.removeLoginAsync(login);
      }
    });
    await initialize(PathUtils.profileDir);
    let store = createLoginStoreWithNssKeymanager(
      PathUtils.join(fixture.path, "logins.db"),
      new FixtureAuthenticator()
    );
    await store.add(
      new LoginEntry({
        origin,
        formActionOrigin: origin,
        httpRealm: null,
        username: "rust-account",
        password: "current-password",
        usernameField: "",
        passwordField: "",
      })
    );
    store = null;
    await SpecialPowers.exactGC();
    await IOUtils.writeUTF8(
      PathUtils.join(fixture.path, "prefs.js"),
      'user_pref("signon.storage.rust.active", true);\n'
    );
    await IOUtils.writeJSON(PathUtils.join(fixture.path, "logins.json"), {
      version: 3,
      logins: [{ encryptedUsername: "stale", encryptedPassword: "stale" }],
    });
    for (const name of ["key4.db", "key4.db-wal", "cert9.db", "cert9.db-wal"]) {
      const path = PathUtils.join(PathUtils.profileDir, name);
      if (await IOUtils.exists(path)) {
        await IOUtils.copy(path, PathUtils.join(fixture.path, name));
      }
    }
    const results = await importProfile(fixture, TYPES.PASSWORDS);
    is(
      results.get(TYPES.PASSWORDS).reason,
      "complete",
      "Current JWE password format decrypts through the isolated helper"
    );
    is(
      results.get(TYPES.PASSWORDS).imported,
      1,
      "Only the active database's account is imported"
    );
    const [login] = await Services.logins.searchLoginsAsync({ origin });
    is(
      login.username,
      "rust-account",
      "Username comes from the active database"
    );
    is(
      login.password,
      "current-password",
      "Current password decrypts correctly"
    );
  }
);
