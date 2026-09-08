/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Bookmark, BookmarkFolder, BookmarkQuery, PlacesItem } =
  ChromeUtils.importESModule(
    "resource://services-sync/engines/bookmarks.sys.mjs"
  );
// `Service` is used as a global in head_helpers.js.
// eslint-disable-next-line no-unused-vars
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

const BookmarksToolbarTitle = "toolbar";

// apply some test records without going via a test server.
async function apply_records(engine, records) {
  for (record of records) {
    await engine._store.applyIncoming(record);
  }
  await engine._apply();
}

add_bookmark_test(async function test_ignore_specials(engine) {
  _("Ensure that we can't delete bookmark roots.");
  let store = engine._store;

  // Belt...
  let record = new BookmarkFolder("bookmarks", "toolbar", "folder");
  record.deleted = true;
  Assert.notEqual(
    null,
    await PlacesTestUtils.promiseItemId(PlacesUtils.bookmarks.toolbarGuid)
  );

  await apply_records(engine, [record]);

  // Ensure that the toolbar exists.
  Assert.notEqual(
    null,
    await PlacesTestUtils.promiseItemId(PlacesUtils.bookmarks.toolbarGuid)
  );

  await apply_records(engine, [record]);

  Assert.notEqual(
    null,
    await PlacesTestUtils.promiseItemId(PlacesUtils.bookmarks.toolbarGuid)
  );
  await store.wipe();
});

add_bookmark_test(async function test_bookmark_create(engine) {
  let store = engine._store;

  try {
    _("Ensure the record isn't present yet.");
    let item = await PlacesUtils.bookmarks.fetch({
      url: "http://getfirefox.com/",
    });
    Assert.equal(null, item);

    _("Let's create a new record.");
    let fxrecord = new Bookmark("bookmarks", "get-firefox1");
    fxrecord.bmkUri = "http://getfirefox.com/";
    fxrecord.title = "Get Firefox!";
    fxrecord.tags = ["firefox", "awesome", "browser"];
    fxrecord.keyword = "awesome";
    fxrecord.parentName = BookmarksToolbarTitle;
    fxrecord.parentid = "toolbar";
    await apply_records(engine, [fxrecord]);

    _("Verify it has been created correctly.");
    item = await PlacesUtils.bookmarks.fetch(fxrecord.id);
    Assert.equal(item.type, PlacesUtils.bookmarks.TYPE_BOOKMARK);
    Assert.equal(item.url.href, "http://getfirefox.com/");
    Assert.equal(item.title, fxrecord.title);
    Assert.equal(item.parentGuid, PlacesUtils.bookmarks.toolbarGuid);
    let keyword = await PlacesUtils.keywords.fetch(fxrecord.keyword);
    Assert.equal(keyword.url.href, "http://getfirefox.com/");

    _(
      "Have the store create a new record object. Verify that it has the same data."
    );
    let newrecord = await store.createRecord(fxrecord.id);
    Assert.ok(newrecord instanceof Bookmark);
    for (let property of [
      "type",
      "bmkUri",
      "title",
      "keyword",
      "parentName",
      "parentid",
    ]) {
      Assert.equal(newrecord[property], fxrecord[property]);
    }
    Assert.ok(Utils.deepEquals(newrecord.tags.sort(), fxrecord.tags.sort()));

    _("The calculated sort index is based on frecency data.");
    Assert.greaterOrEqual(newrecord.sortindex, 150);

    _("Create a record with some values missing.");
    let tbrecord = new Bookmark("bookmarks", "thunderbird1");
    tbrecord.bmkUri = "http://getthunderbird.com/";
    tbrecord.parentName = BookmarksToolbarTitle;
    tbrecord.parentid = "toolbar";
    await apply_records(engine, [tbrecord]);

    _("Verify it has been created correctly.");
    item = await PlacesUtils.bookmarks.fetch(tbrecord.id);
    Assert.equal(item.type, PlacesUtils.bookmarks.TYPE_BOOKMARK);
    Assert.equal(item.url.href, "http://getthunderbird.com/");
    Assert.equal(item.title, "");
    Assert.equal(item.parentGuid, PlacesUtils.bookmarks.toolbarGuid);
    keyword = await PlacesUtils.keywords.fetch({
      url: "http://getthunderbird.com/",
    });
    Assert.equal(null, keyword);
  } finally {
    _("Clean up.");
    await store.wipe();
  }
});

add_bookmark_test(async function test_bookmark_update(engine) {
  let store = engine._store;

  try {
    _("Create a bookmark whose values we'll change.");
    let bmk1 = await PlacesUtils.bookmarks.insert({
      parentGuid: PlacesUtils.bookmarks.toolbarGuid,
      url: "http://getfirefox.com/",
      title: "Get Firefox!",
    });
    await PlacesUtils.keywords.insert({
      url: "http://getfirefox.com/",
      keyword: "firefox",
    });

    _("Update the record with some null values.");
    let record = await store.createRecord(bmk1.guid);
    record.title = null;
    record.keyword = null;
    record.tags = null;
    await apply_records(engine, [record]);

    _("Verify that the values have been cleared.");
    let item = await PlacesUtils.bookmarks.fetch(bmk1.guid);
    Assert.equal(item.title, "");
    let keyword = await PlacesUtils.keywords.fetch({
      url: "http://getfirefox.com/",
    });
    Assert.equal(null, keyword);
  } finally {
    _("Clean up.");
    await store.wipe();
  }
});

add_bookmark_test(async function test_bookmark_createRecord(engine) {
  let store = engine._store;

  try {
    _("Create a bookmark without a title.");
    let bmk1 = await PlacesUtils.bookmarks.insert({
      parentGuid: PlacesUtils.bookmarks.toolbarGuid,
      url: "http://getfirefox.com/",
    });

    _("Verify that the record is created accordingly.");
    let record = await store.createRecord(bmk1.guid);
    Assert.equal(record.title, "");
    Assert.equal(record.keyword, null);
  } finally {
    _("Clean up.");
    await store.wipe();
  }
});

add_bookmark_test(async function test_folder_create(engine) {
  let store = engine._store;

  try {
    _("Create a folder.");
    let folder = new BookmarkFolder("bookmarks", "testfolder-1");
    folder.parentName = BookmarksToolbarTitle;
    folder.parentid = "toolbar";
    folder.title = "Test Folder";
    await apply_records(engine, [folder]);

    _("Verify it has been created correctly.");
    let item = await PlacesUtils.bookmarks.fetch(folder.id);
    Assert.equal(item.type, PlacesUtils.bookmarks.TYPE_FOLDER);
    Assert.equal(item.title, folder.title);
    Assert.equal(item.parentGuid, PlacesUtils.bookmarks.toolbarGuid);

    _(
      "Have the store create a new record object. Verify that it has the same data."
    );
    let newrecord = await store.createRecord(folder.id);
    Assert.ok(newrecord instanceof BookmarkFolder);
    for (let property of ["title", "parentName", "parentid"]) {
      Assert.equal(newrecord[property], folder[property]);
    }

    _("Folders have high sort index to ensure they're synced first.");
    Assert.equal(newrecord.sortindex, 1000000);
  } finally {
    _("Clean up.");
    await store.wipe();
  }
});

add_bookmark_test(async function test_folder_createRecord(engine) {
  let store = engine._store;

  try {
    _("Create a folder.");
    let folder1 = await PlacesUtils.bookmarks.insert({
      parentGuid: PlacesUtils.bookmarks.toolbarGuid,
      type: PlacesUtils.bookmarks.TYPE_FOLDER,
      title: "Folder1",
    });

    _("Create two bookmarks in that folder without assigning them GUIDs.");
    let bmk1 = await PlacesUtils.bookmarks.insert({
      parentGuid: folder1.guid,
      url: "http://getfirefox.com/",
      title: "Get Firefox!",
    });
    let bmk2 = await PlacesUtils.bookmarks.insert({
      parentGuid: folder1.guid,
      url: "http://getthunderbird.com/",
      title: "Get Thunderbird!",
    });

    _("Create a record for the folder and verify basic properties.");
    let record = await store.createRecord(folder1.guid);
    Assert.ok(record instanceof BookmarkFolder);
    Assert.equal(record.title, "Folder1");
    Assert.equal(record.parentid, "toolbar");
    Assert.equal(record.parentName, BookmarksToolbarTitle);

    _(
      "Verify the folder's children. Ensures that the bookmarks were given GUIDs."
    );
    Assert.deepEqual(record.children, [bmk1.guid, bmk2.guid]);
  } finally {
    _("Clean up.");
    await store.wipe();
  }
});

add_bookmark_test(async function test_deleted(engine) {
  let store = engine._store;

  try {
    _("Create a bookmark that will be deleted.");
    let bmk1 = await PlacesUtils.bookmarks.insert({
      parentGuid: PlacesUtils.bookmarks.toolbarGuid,
      url: "http://getfirefox.com/",
      title: "Get Firefox!",
    });
    // The engine needs to think we've previously synced it.
    await PlacesTestUtils.markBookmarksAsSynced();

    _("Delete the bookmark through the store.");
    let record = new PlacesItem("bookmarks", bmk1.guid);
    record.deleted = true;
    await apply_records(engine, [record]);
    _("Ensure it has been deleted.");
    let item = await PlacesUtils.bookmarks.fetch(bmk1.guid);
    let newrec = await store.createRecord(bmk1.guid);
    Assert.equal(null, item);
    Assert.equal(newrec.deleted, true);
    _("Verify that the keyword has been cleared.");
    let keyword = await PlacesUtils.keywords.fetch({
      url: "http://getfirefox.com/",
    });
    Assert.equal(null, keyword);
  } finally {
    _("Clean up.");
    await store.wipe();
  }
});

add_bookmark_test(async function test_move_folder(engine) {
  let store = engine._store;
  store._childrenToOrder = {}; // *sob* - only needed for legacy.

  try {
    _("Create two folders and a bookmark in one of them.");
    let folder1 = await PlacesUtils.bookmarks.insert({
      parentGuid: PlacesUtils.bookmarks.toolbarGuid,
      type: PlacesUtils.bookmarks.TYPE_FOLDER,
      title: "Folder1",
    });
    let folder2 = await PlacesUtils.bookmarks.insert({
      parentGuid: PlacesUtils.bookmarks.toolbarGuid,
      type: PlacesUtils.bookmarks.TYPE_FOLDER,
      title: "Folder2",
    });
    let bmk = await PlacesUtils.bookmarks.insert({
      parentGuid: folder1.guid,
      url: "http://getfirefox.com/",
      title: "Get Firefox!",
    });
    // add records to the store that represent the current state.
    await apply_records(engine, [
      await store.createRecord(folder1.guid),
      await store.createRecord(folder2.guid),
      await store.createRecord(bmk.guid),
    ]);

    _("Now simulate incoming records reparenting it.");
    let bmkRecord = await store.createRecord(bmk.guid);
    Assert.equal(bmkRecord.parentid, folder1.guid);
    bmkRecord.parentid = folder2.guid;

    let folder1Record = await store.createRecord(folder1.guid);
    Assert.deepEqual(folder1Record.children, [bmk.guid]);
    folder1Record.children = [];
    let folder2Record = await store.createRecord(folder2.guid);
    Assert.deepEqual(folder2Record.children, []);
    folder2Record.children = [bmk.guid];

    await apply_records(engine, [bmkRecord, folder1Record, folder2Record]);

    _("Verify the new parent.");
    let movedBmk = await PlacesUtils.bookmarks.fetch(bmk.guid);
    Assert.equal(movedBmk.parentGuid, folder2.guid);
  } finally {
    _("Clean up.");
    await store.wipe();
  }
});

add_bookmark_test(async function test_move_order(engine) {
  let store = engine._store;
  let tracker = engine._tracker;

  // Make sure the tracker is turned on.
  tracker.start();
  try {
    _("Create two bookmarks");
    let bmk1 = await PlacesUtils.bookmarks.insert({
      parentGuid: PlacesUtils.bookmarks.toolbarGuid,
      url: "http://getfirefox.com/",
      title: "Get Firefox!",
    });
    let bmk2 = await PlacesUtils.bookmarks.insert({
      parentGuid: PlacesUtils.bookmarks.toolbarGuid,
      url: "http://getthunderbird.com/",
      title: "Get Thunderbird!",
    });

    _("Verify order.");
    let childIds =
      await PlacesSyncUtils.bookmarks.fetchChildRecordIds("toolbar");
    Assert.deepEqual(childIds, [bmk1.guid, bmk2.guid]);
    let toolbar = await store.createRecord("toolbar");
    Assert.deepEqual(toolbar.children, [bmk1.guid, bmk2.guid]);

    _("Move bookmarks around.");
    store._childrenToOrder = {};
    toolbar.children = [bmk2.guid, bmk1.guid];
    await apply_records(engine, [
      toolbar,
      await store.createRecord(bmk1.guid),
      await store.createRecord(bmk2.guid),
    ]);
    delete store._childrenToOrder;

    _("Verify new order.");
    let newChildIds =
      await PlacesSyncUtils.bookmarks.fetchChildRecordIds("toolbar");
    Assert.deepEqual(newChildIds, [bmk2.guid, bmk1.guid]);
  } finally {
    await tracker.stop();
    _("Clean up.");
    await store.wipe();
  }
});

// Tests Bug 806460, in which query records arrive with empty folder
// names and missing bookmark URIs.
add_bookmark_test(async function test_empty_query_doesnt_die(engine) {
  let record = new BookmarkQuery("bookmarks", "8xoDGqKrXf1P");
  record.folderName = "";
  record.queryId = "";
  record.parentName = "Toolbar";
  record.parentid = "toolbar";

  // These should not throw.
  await apply_records(engine, [record]);

  delete record.folderName;
  await apply_records(engine, [record]);
});

add_bookmark_test(async function test_calculateIndex_for_invalid_url(engine) {
  let store = engine._store;

  let folderIndex = await store._calculateIndex({
    type: "folder",
  });
  equal(folderIndex, 1000000, "Should use high sort index for folders");

  let toolbarIndex = await store._calculateIndex({
    parentid: "toolbar",
  });
  equal(toolbarIndex, 150, "Should bump sort index for toolbar bookmarks");

  let validURLIndex = await store._calculateIndex({
    bmkUri: "http://example.com/a",
  });
  greaterOrEqual(validURLIndex, 0, "Should use frecency for index");

  let invalidURLIndex = await store._calculateIndex({
    bmkUri: "!@#$%",
  });
  equal(invalidURLIndex, 0, "Should not throw for invalid URLs");
});

// Test that applying incoming records uses the server's modified timestamp
// for the local lastModified, not the current time. This is important because
// using the current time causes non-deterministic behavior in the merge
// algorithm when comparing local and remote ages.
add_bookmark_test(async function test_incoming_lastModified(engine) {
  let store = engine._store;

  // The server's modified timestamp (in seconds).
  const serverModified = 1770000000;

  _("Create a folder record with a specific server modified time.");
  let folderRecord = new BookmarkFolder("bookmarks", "BBBBBBBBBBBB");
  folderRecord.title = "Test Folder";
  folderRecord.parentName = BookmarksToolbarTitle;
  folderRecord.parentid = "toolbar";
  folderRecord.children = ["AAAAAAAAAAAA"];
  folderRecord.modified = serverModified;

  _("Create a bookmark record with a specific server modified time.");
  let bmkRecord = new Bookmark("bookmarks", "AAAAAAAAAAAA");
  bmkRecord.bmkUri = "http://example.com/test";
  bmkRecord.title = "Test Bookmark";
  bmkRecord.parentName = "Test Folder";
  bmkRecord.parentid = "BBBBBBBBBBBB";
  bmkRecord.modified = serverModified;

  await apply_records(engine, [folderRecord, bmkRecord]);

  _("Verify the bookmark's lastModified matches the server timestamp.");
  let item = await PlacesUtils.bookmarks.fetch({ guid: "AAAAAAAAAAAA" });
  Assert.ok(item, "Bookmark should exist");
  // The server timestamp is in seconds, lastModified is in milliseconds.
  Assert.equal(
    item.lastModified.getTime(),
    serverModified * 1000,
    "lastModified should match the server's modified timestamp"
  );

  _("Verify the folder's lastModified also matches.");
  let folder = await PlacesUtils.bookmarks.fetch("BBBBBBBBBBBB");
  Assert.ok(folder, "Folder should exist");
  Assert.equal(
    folder.lastModified.getTime(),
    serverModified * 1000,
    "Folder lastModified should match the server's modified timestamp"
  );

  _("Update the bookmark with a newer server timestamp.");
  const newerServerModified = 1780000000;
  bmkRecord.title = "Updated Test Bookmark";
  bmkRecord.modified = newerServerModified;
  await apply_records(engine, [bmkRecord]);

  item = await PlacesUtils.bookmarks.fetch("AAAAAAAAAAAA");
  Assert.equal(
    item.lastModified.getTime(),
    newerServerModified * 1000,
    "lastModified should be updated to the newer server timestamp"
  );

  await store.wipe();
});
