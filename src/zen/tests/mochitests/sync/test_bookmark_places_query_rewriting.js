/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

_("Rewrite place: URIs.");
const { BookmarkQuery, BookmarkFolder } = ChromeUtils.importESModule(
  "resource://services-sync/engines/bookmarks.sys.mjs"
);
// `Service` is used as a global in head_helpers.js.
// eslint-disable-next-line no-unused-vars
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

function makeTagRecord(id, uri) {
  let tagRecord = new BookmarkQuery("bookmarks", id);
  tagRecord.queryId = "MagicTags";
  tagRecord.parentName = "Bookmarks Toolbar";
  tagRecord.bmkUri = uri;
  tagRecord.title = "tagtag";
  tagRecord.folderName = "bar";
  tagRecord.parentid = PlacesUtils.bookmarks.toolbarGuid;
  return tagRecord;
}

add_bookmark_test(async function run_test(engine) {
  let store = engine._store;

  let toolbar = new BookmarkFolder("bookmarks", "toolbar");
  toolbar.parentid = "places";
  toolbar.children = ["abcdefabcdef"];

  let uri = "place:folder=499&type=7&queryType=1";
  let tagRecord = makeTagRecord("abcdefabcdef", uri);

  _("Type: " + tagRecord.type);
  _("Folder name: " + tagRecord.folderName);
  await store.applyIncoming(toolbar);
  await store.applyIncoming(tagRecord);
  await engine._apply();

  let insertedRecord = await store.createRecord("abcdefabcdef", "bookmarks");
  Assert.equal(insertedRecord.bmkUri, "place:tag=bar");

  _("... but not if the type is wrong.");
  let wrongTypeURI = "place:folder=499&type=2&queryType=1";
  let wrongTypeRecord = makeTagRecord("fedcbafedcba", wrongTypeURI);
  await store.applyIncoming(wrongTypeRecord);
  toolbar.children = ["fedcbafedcba"];
  await store.applyIncoming(toolbar);
  let expected = wrongTypeURI;
  await engine._apply();
  // the mirror appends a special param to these.
  expected += "&excludeItems=1";

  insertedRecord = await store.createRecord("fedcbafedcba", "bookmarks");
  Assert.equal(insertedRecord.bmkUri, expected);
});
