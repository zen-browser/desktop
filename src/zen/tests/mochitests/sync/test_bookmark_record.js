/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const { Bookmark, BookmarkQuery, PlacesItem } = ChromeUtils.importESModule(
  "resource://services-sync/engines/bookmarks.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

function prepareBookmarkItem(collection, id) {
  let b = new Bookmark(collection, id);
  b.cleartext.stuff = "my payload here";
  return b;
}

add_task(async function test_bookmark_record() {
  await configureIdentity();

  await generateNewKeys(Service.collectionKeys);
  let keyBundle = Service.identity.syncKeyBundle;

  _("Creating a record");

  let placesItem = new PlacesItem("bookmarks", "foo", "bookmark");
  let bookmarkItem = prepareBookmarkItem("bookmarks", "foo");

  _("Checking getTypeObject");
  Assert.equal(placesItem.getTypeObject(placesItem.type), Bookmark);
  Assert.equal(bookmarkItem.getTypeObject(bookmarkItem.type), Bookmark);

  await bookmarkItem.encrypt(keyBundle);
  _("Ciphertext is " + bookmarkItem.ciphertext);
  Assert.notEqual(bookmarkItem.ciphertext, null);

  _("Decrypting the record");

  let payload = await bookmarkItem.decrypt(keyBundle);
  Assert.equal(payload.stuff, "my payload here");
  Assert.equal(bookmarkItem.getTypeObject(bookmarkItem.type), Bookmark);
  Assert.notEqual(payload, bookmarkItem.payload); // wrap.data.payload is the encrypted one
});

add_task(async function test_query_foldername() {
  // Bug 1443388
  let checks = [
    ["foo", "foo"],
    ["", undefined],
  ];
  for (let [inVal, outVal] of checks) {
    let bmk1 = new BookmarkQuery("bookmarks", Utils.makeGUID());
    bmk1.fromSyncBookmark({
      url: Services.io.newURI("https://example.com"),
      folder: inVal,
    });
    Assert.strictEqual(bmk1.folderName, outVal);

    // other direction
    let bmk2 = new BookmarkQuery("bookmarks", Utils.makeGUID());
    bmk2.folderName = inVal;
    let record = bmk2.toSyncBookmark();
    Assert.strictEqual(record.folder, outVal);
  }
});
