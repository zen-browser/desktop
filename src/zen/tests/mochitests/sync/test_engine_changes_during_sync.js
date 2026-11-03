const { FormHistory } = ChromeUtils.importESModule(
  "resource://gre/modules/FormHistory.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { Bookmark, BookmarkFolder, BookmarkQuery } = ChromeUtils.importESModule(
  "resource://services-sync/engines/bookmarks.sys.mjs"
);
const { HistoryRec } = ChromeUtils.importESModule(
  "resource://services-sync/engines/history.sys.mjs"
);
const { FormRec } = ChromeUtils.importESModule(
  "resource://services-sync/engines/forms.sys.mjs"
);
const { LoginRec } = ChromeUtils.importESModule(
  "resource://services-sync/engines/passwords.sys.mjs"
);
const { PrefRec } = ChromeUtils.importESModule(
  "resource://services-sync/engines/prefs.sys.mjs"
);

const LoginInfo = Components.Constructor(
  "@mozilla.org/login-manager/loginInfo;1",
  Ci.nsILoginInfo,
  "init"
);

/**
 * We don't test the clients or tabs engines because neither has conflict
 * resolution logic. The clients engine syncs twice per global sync, and
 * custom conflict resolution logic for commands that doesn't use
 * timestamps. Tabs doesn't have conflict resolution at all, since it's
 * read-only.
 */

async function assertChildGuids(folderGuid, expectedChildGuids, message) {
  let tree = await PlacesUtils.promiseBookmarksTree(folderGuid);
  let childGuids = tree.children.map(child => child.guid);
  deepEqual(childGuids, expectedChildGuids, message);
}

async function cleanup(engine, server) {
  await engine._tracker.stop();
  await engine._store.wipe();
  for (const pref of Svc.PrefBranch.getChildList("")) {
    Svc.PrefBranch.clearUserPref(pref);
  }
  Service.recordManager.clearCache();
  await promiseStopServer(server);
}

add_task(async function test_history_change_during_sync() {
  _("Ensure that we don't bump the score when applying history records.");

  enableValidationPrefs();

  let engine = Service.engineManager.get("history");
  let server = await serverForEnginesWithKeys({ foo: "password" }, [engine]);
  await SyncTestingInfrastructure(server);
  let collection = server.user("foo").collection("history");

  // Override `uploadOutgoing` to insert a record while we're applying
  // changes. The tracker should ignore this change.
  let uploadOutgoing = engine._uploadOutgoing;
  engine._uploadOutgoing = async function () {
    engine._uploadOutgoing = uploadOutgoing;
    try {
      await uploadOutgoing.call(this);
    } finally {
      _("Inserting local history visit");
      await addVisit("during_sync");
      await engine._tracker.asyncObserver.promiseObserversComplete();
    }
  };

  engine._tracker.start();

  try {
    let remoteRec = new HistoryRec("history", "UrOOuzE5QM-e");
    remoteRec.histUri = "http://getfirefox.com/";
    remoteRec.title = "Get Firefox!";
    remoteRec.visits = [
      {
        date: PlacesUtils.toPRTime(Date.now()),
        type: PlacesUtils.history.TRANSITION_TYPED,
      },
    ];
    collection.insert(remoteRec.id, encryptPayload(remoteRec.cleartext));

    await sync_engine_and_validate_telem(engine, true);
    strictEqual(
      Service.scheduler.globalScore,
      0,
      "Should not bump global score for visits added during sync"
    );

    equal(
      collection.count(),
      1,
      "New local visit should not exist on server after first sync"
    );

    await sync_engine_and_validate_telem(engine, true);
    strictEqual(
      Service.scheduler.globalScore,
      0,
      "Should not bump global score during second history sync"
    );

    equal(
      collection.count(),
      2,
      "New local visit should exist on server after second sync"
    );
  } finally {
    engine._uploadOutgoing = uploadOutgoing;
    await cleanup(engine, server);
  }
});

add_task(async function test_passwords_change_during_sync() {
  _("Ensure that we don't bump the score when applying passwords.");

  enableValidationPrefs();

  let engine = Service.engineManager.get("passwords");
  let server = await serverForEnginesWithKeys({ foo: "password" }, [engine]);
  await SyncTestingInfrastructure(server);
  let collection = server.user("foo").collection("passwords");

  let uploadOutgoing = engine._uploadOutgoing;
  engine._uploadOutgoing = async function () {
    engine._uploadOutgoing = uploadOutgoing;
    try {
      await uploadOutgoing.call(this);
    } finally {
      _("Inserting local password");
      let login = new LoginInfo(
        "https://example.com",
        "",
        null,
        "username",
        "password",
        "",
        ""
      );
      await Services.logins.addLoginAsync(login);
      await engine._tracker.asyncObserver.promiseObserversComplete();
    }
  };

  engine._tracker.start();

  try {
    let remoteRec = new LoginRec(
      "passwords",
      "{765e3d6e-071d-d640-a83d-81a7eb62d3ed}"
    );
    remoteRec.formSubmitURL = "";
    remoteRec.httpRealm = "";
    remoteRec.hostname = "https://mozilla.org";
    remoteRec.username = "username";
    remoteRec.password = "sekrit";
    remoteRec.timeCreated = Date.now();
    remoteRec.timePasswordChanged = Date.now();
    collection.insert(remoteRec.id, encryptPayload(remoteRec.cleartext));

    await sync_engine_and_validate_telem(engine, true);
    strictEqual(
      Service.scheduler.globalScore,
      0,
      "Should not bump global score for passwords added during first sync"
    );

    equal(
      collection.count(),
      1,
      "New local password should not exist on server after first sync"
    );

    await sync_engine_and_validate_telem(engine, true);
    strictEqual(
      Service.scheduler.globalScore,
      0,
      "Should not bump global score during second passwords sync"
    );

    equal(
      collection.count(),
      2,
      "New local password should exist on server after second sync"
    );
  } finally {
    engine._uploadOutgoing = uploadOutgoing;
    await cleanup(engine, server);
  }
});

add_task(async function test_prefs_change_during_sync() {
  _("Ensure that we don't bump the score when applying prefs.");

  const TEST_PREF = "test.duringSync";
  // create a "control pref" for the pref we sync.
  Services.prefs.setBoolPref("services.sync.prefs.sync.test.duringSync", true);

  enableValidationPrefs();

  let engine = Service.engineManager.get("prefs");
  let server = await serverForEnginesWithKeys({ foo: "password" }, [engine]);
  await SyncTestingInfrastructure(server);
  let collection = server.user("foo").collection("prefs");

  let uploadOutgoing = engine._uploadOutgoing;
  engine._uploadOutgoing = async function () {
    engine._uploadOutgoing = uploadOutgoing;
    try {
      await uploadOutgoing.call(this);
    } finally {
      _("Updating local pref value");
      // Change the value of a synced pref.
      Services.prefs.setStringPref(TEST_PREF, "hello");
      await engine._tracker.asyncObserver.promiseObserversComplete();
    }
  };

  engine._tracker.start();

  try {
    // All synced prefs are stored in a single record, so we'll only ever
    // have one record on the server. This test just checks that we don't
    // track or upload prefs changed during the sync.
    let guid = CommonUtils.encodeBase64URL(Services.appinfo.ID);
    let remoteRec = new PrefRec("prefs", guid);
    remoteRec.value = {
      [TEST_PREF]: "world",
    };
    collection.insert(remoteRec.id, encryptPayload(remoteRec.cleartext));

    await sync_engine_and_validate_telem(engine, true);
    strictEqual(
      Service.scheduler.globalScore,
      0,
      "Should not bump global score for prefs added during first sync"
    );
    let payloads = collection.payloads();
    equal(
      payloads.length,
      1,
      "Should not upload multiple prefs records after first sync"
    );
    equal(
      payloads[0].value[TEST_PREF],
      "world",
      "Should not upload pref value changed during first sync"
    );

    await sync_engine_and_validate_telem(engine, true);
    strictEqual(
      Service.scheduler.globalScore,
      0,
      "Should not bump global score during second prefs sync"
    );
    payloads = collection.payloads();
    equal(
      payloads.length,
      1,
      "Should not upload multiple prefs records after second sync"
    );
    equal(
      payloads[0].value[TEST_PREF],
      "hello",
      "Should upload changed pref value during second sync"
    );
  } finally {
    engine._uploadOutgoing = uploadOutgoing;
    await cleanup(engine, server);
    Services.prefs.clearUserPref(TEST_PREF);
  }
});

add_task(async function test_forms_change_during_sync() {
  _("Ensure that we don't bump the score when applying form records.");

  enableValidationPrefs();

  let engine = Service.engineManager.get("forms");
  let server = await serverForEnginesWithKeys({ foo: "password" }, [engine]);
  await SyncTestingInfrastructure(server);
  let collection = server.user("foo").collection("forms");

  let uploadOutgoing = engine._uploadOutgoing;
  engine._uploadOutgoing = async function () {
    engine._uploadOutgoing = uploadOutgoing;
    try {
      await uploadOutgoing.call(this);
    } finally {
      _("Inserting local form history entry");
      await FormHistory.update([
        {
          op: "add",
          fieldname: "favoriteDrink",
          value: "cocoa",
        },
      ]);
      await engine._tracker.asyncObserver.promiseObserversComplete();
    }
  };

  engine._tracker.start();

  try {
    // Add an existing remote form history entry. We shouldn't bump the score when
    // we apply this record.
    let remoteRec = new FormRec("forms", "Tl9dHgmJSR6FkyxS");
    remoteRec.name = "name";
    remoteRec.value = "alice";
    collection.insert(remoteRec.id, encryptPayload(remoteRec.cleartext));

    await sync_engine_and_validate_telem(engine, true);
    strictEqual(
      Service.scheduler.globalScore,
      0,
      "Should not bump global score for forms added during first sync"
    );

    equal(
      collection.count(),
      1,
      "New local form should not exist on server after first sync"
    );

    await sync_engine_and_validate_telem(engine, true);
    strictEqual(
      Service.scheduler.globalScore,
      0,
      "Should not bump global score during second forms sync"
    );

    equal(
      collection.count(),
      2,
      "New local form should exist on server after second sync"
    );
  } finally {
    engine._uploadOutgoing = uploadOutgoing;
    await cleanup(engine, server);
  }
});

add_task(async function test_bookmark_change_during_sync() {
  _("Ensure that we track bookmark changes made during a sync.");

  enableValidationPrefs();
  let schedulerProto = Object.getPrototypeOf(Service.scheduler);
  let syncThresholdDescriptor = Object.getOwnPropertyDescriptor(
    schedulerProto,
    "syncThreshold"
  );
  Object.defineProperty(Service.scheduler, "syncThreshold", {
    // Trigger resync if any changes exist, rather than deciding based on the
    // normal sync threshold.
    get: () => 0,
  });

  let engine = Service.engineManager.get("bookmarks");
  let server = await serverForEnginesWithKeys({ foo: "password" }, [engine]);
  await SyncTestingInfrastructure(server);

  // Already-tracked bookmarks that shouldn't be uploaded during the first sync.
  let bzBmk = await PlacesUtils.bookmarks.insert({
    parentGuid: PlacesUtils.bookmarks.menuGuid,
    url: "https://bugzilla.mozilla.org/",
    title: "Bugzilla",
  });
  _(`Bugzilla GUID: ${bzBmk.guid}`);

  await PlacesTestUtils.setBookmarkSyncFields({
    guid: bzBmk.guid,
    syncChangeCounter: 0,
    syncStatus: PlacesUtils.bookmarks.SYNC_STATUS.NORMAL,
  });

  let collection = server.user("foo").collection("bookmarks");

  let bmk3; // New child of Folder 1, created locally during sync.

  let uploadOutgoing = engine._uploadOutgoing;
  engine._uploadOutgoing = async function () {
    engine._uploadOutgoing = uploadOutgoing;
    try {
      await uploadOutgoing.call(this);
    } finally {
      _("Inserting bookmark into local store");
      bmk3 = await PlacesUtils.bookmarks.insert({
        parentGuid: folder1.guid,
        url: "https://mozilla.org/",
        title: "Mozilla",
      });
      await engine._tracker.asyncObserver.promiseObserversComplete();
    }
  };

  // New bookmarks that should be uploaded during the first sync.
  let folder1 = await PlacesUtils.bookmarks.insert({
    type: PlacesUtils.bookmarks.TYPE_FOLDER,
    parentGuid: PlacesUtils.bookmarks.toolbarGuid,
    title: "Folder 1",
  });
  _(`Folder GUID: ${folder1.guid}`);

  let tbBmk = await PlacesUtils.bookmarks.insert({
    parentGuid: folder1.guid,
    url: "http://getthunderbird.com/",
    title: "Get Thunderbird!",
  });
  _(`Thunderbird GUID: ${tbBmk.guid}`);

  engine._tracker.start();

  try {
    let bmk2_guid = "get-firefox1"; // New child of Folder 1, created remotely.
    let folder2_guid = "folder2-1111"; // New folder, created remotely.
    let tagQuery_guid = "tag-query111"; // New tag query child of Folder 2, created remotely.
    let bmk4_guid = "example-org1"; // New tagged child of Folder 2, created remotely.
    {
      // An existing record changed on the server that should not trigger
      // another sync when applied.
      let remoteBzBmk = new Bookmark("bookmarks", bzBmk.guid);
      remoteBzBmk.bmkUri = "https://bugzilla.mozilla.org/";
      remoteBzBmk.description = "New description";
      remoteBzBmk.title = "Bugzilla";
      remoteBzBmk.tags = ["new", "tags"];
      remoteBzBmk.parentName = "Bookmarks Menu";
      remoteBzBmk.parentid = "menu";
      collection.insert(bzBmk.guid, encryptPayload(remoteBzBmk.cleartext));

      let remoteFolder = new BookmarkFolder("bookmarks", folder2_guid);
      remoteFolder.title = "Folder 2";
      remoteFolder.children = [bmk4_guid, tagQuery_guid];
      remoteFolder.parentName = "Bookmarks Menu";
      remoteFolder.parentid = "menu";
      collection.insert(folder2_guid, encryptPayload(remoteFolder.cleartext));

      let remoteFxBmk = new Bookmark("bookmarks", bmk2_guid);
      remoteFxBmk.bmkUri = "http://getfirefox.com/";
      remoteFxBmk.description = "Firefox is awesome.";
      remoteFxBmk.title = "Get Firefox!";
      remoteFxBmk.tags = ["firefox", "awesome", "browser"];
      remoteFxBmk.keyword = "awesome";
      remoteFxBmk.parentName = "Folder 1";
      remoteFxBmk.parentid = folder1.guid;
      collection.insert(bmk2_guid, encryptPayload(remoteFxBmk.cleartext));

      // A tag query referencing a nonexistent tag folder, which we should
      // create locally when applying the record.
      let remoteTagQuery = new BookmarkQuery("bookmarks", tagQuery_guid);
      remoteTagQuery.bmkUri = "place:type=7&folder=999";
      remoteTagQuery.title = "Taggy tags";
      remoteTagQuery.folderName = "taggy";
      remoteTagQuery.parentName = "Folder 2";
      remoteTagQuery.parentid = folder2_guid;
      collection.insert(
        tagQuery_guid,
        encryptPayload(remoteTagQuery.cleartext)
      );

      // A bookmark that should appear in the results for the tag query.
      let remoteTaggedBmk = new Bookmark("bookmarks", bmk4_guid);
      remoteTaggedBmk.bmkUri = "https://example.org/";
      remoteTaggedBmk.title = "Tagged bookmark";
      remoteTaggedBmk.tags = ["taggy"];
      remoteTaggedBmk.parentName = "Folder 2";
      remoteTaggedBmk.parentid = folder2_guid;
      collection.insert(bmk4_guid, encryptPayload(remoteTaggedBmk.cleartext));

      collection.insert(
        "toolbar",
        encryptPayload({
          id: "toolbar",
          type: "folder",
          title: "toolbar",
          children: [folder1.guid],
          parentName: "places",
          parentid: "places",
        })
      );

      collection.insert(
        "menu",
        encryptPayload({
          id: "menu",
          type: "folder",
          title: "menu",
          children: [bzBmk.guid, folder2_guid],
          parentName: "places",
          parentid: "places",
        })
      );

      collection.insert(
        folder1.guid,
        encryptPayload({
          id: folder1.guid,
          type: "folder",
          title: "Folder 1",
          children: [bmk2_guid],
          parentName: "toolbar",
          parentid: "toolbar",
        })
      );
    }

    await assertChildGuids(
      folder1.guid,
      [tbBmk.guid],
      "Folder should have 1 child before first sync"
    );

    let pingsPromise = wait_for_pings(2);

    let changes = await PlacesSyncUtils.bookmarks.pullChanges();
    deepEqual(
      Object.keys(changes).sort(),
      [folder1.guid, tbBmk.guid, "menu", "mobile", "toolbar", "unfiled"].sort(),
      "Should track bookmark and folder created before first sync"
    );

    // Unlike the tests above, we can't use `sync_engine_and_validate_telem`
    // because the bookmarks engine will automatically schedule a follow-up
    // sync for us.
    _("Perform first sync and immediate follow-up sync");
    Service.sync({ engines: ["bookmarks"] });

    let pings = await pingsPromise;
    equal(pings.length, 2, "Should submit two pings");
    ok(
      pings.every(p => {
        assert_success_ping(p);
        return p.syncs.length == 1;
      }),
      "Should submit 1 sync per ping"
    );

    strictEqual(
      Service.scheduler.globalScore,
      0,
      "Should reset global score after follow-up sync"
    );
    ok(bmk3, "Should insert bookmark during first sync to simulate change");
    ok(
      collection.wbo(bmk3.guid),
      "Changed bookmark should be uploaded after follow-up sync"
    );

    let bmk2 = await PlacesUtils.bookmarks.fetch({
      guid: bmk2_guid,
    });
    ok(bmk2, "Remote bookmark should be applied during first sync");
    {
      // We only check child GUIDs, and not their order, because the exact
      // order is an implementation detail.
      let folder1Children = await PlacesSyncUtils.bookmarks.fetchChildRecordIds(
        folder1.guid
      );
      deepEqual(
        folder1Children.sort(),
        [bmk2_guid, tbBmk.guid, bmk3.guid].sort(),
        "Folder 1 should have 3 children after first sync"
      );
    }
    await assertChildGuids(
      folder2_guid,
      [bmk4_guid, tagQuery_guid],
      "Folder 2 should have 2 children after first sync"
    );
    let taggedURIs = [];
    await PlacesUtils.bookmarks.fetch({ tags: ["taggy"] }, b =>
      taggedURIs.push(b.url)
    );
    equal(taggedURIs.length, 1, "Should have 1 tagged URI");
    equal(
      taggedURIs[0].href,
      "https://example.org/",
      "Synced tagged bookmark should appear in tagged URI list"
    );

    changes = await PlacesSyncUtils.bookmarks.pullChanges();
    deepEqual(
      changes,
      {},
      "Should have already uploaded changes in follow-up sync"
    );

    // First ping won't include validation data, since we've changed bookmarks
    // and `canValidate` will indicate it can't proceed.
    let engineData = pings.map(p => {
      return p.syncs[0].engines.find(e => e.name == "bookmarks-buffered");
    });
    ok(engineData[0].validation, "Engine should validate after first sync");
    ok(engineData[1].validation, "Engine should validate after second sync");
  } finally {
    Object.defineProperty(
      schedulerProto,
      "syncThreshold",
      syncThresholdDescriptor
    );
    engine._uploadOutgoing = uploadOutgoing;
    await cleanup(engine, server);
  }
});
