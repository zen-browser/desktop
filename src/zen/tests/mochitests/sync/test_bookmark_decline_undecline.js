/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

// A stored reference to the collection won't be valid after disabling.
function getBookmarkWBO(server, guid) {
  let coll = server.user("foo").collection("bookmarks");
  if (!coll) {
    return null;
  }
  return coll.wbo(guid);
}

add_task(async function test_decline_undecline() {
  let engine = Service.engineManager.get("bookmarks");
  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  try {
    let { guid: bzGuid } = await PlacesUtils.bookmarks.insert({
      parentGuid: PlacesUtils.bookmarks.menuGuid,
      url: "https://bugzilla.mozilla.org",
      index: PlacesUtils.bookmarks.DEFAULT_INDEX,
      title: "bugzilla",
    });

    ok(!getBookmarkWBO(server, bzGuid), "Shouldn't have been uploaded yet");
    await Service.sync();
    ok(getBookmarkWBO(server, bzGuid), "Should be present on server");

    engine.enabled = false;
    await Service.sync();
    ok(
      !getBookmarkWBO(server, bzGuid),
      "Shouldn't be present on server anymore"
    );

    engine.enabled = true;
    await Service.sync();
    ok(getBookmarkWBO(server, bzGuid), "Should be present on server again");
  } finally {
    await PlacesSyncUtils.bookmarks.reset();
    await promiseStopServer(server);
  }
});
