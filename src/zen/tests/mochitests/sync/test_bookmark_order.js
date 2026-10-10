/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

_(
  "Making sure after processing incoming bookmarks, they show up in the right order"
);
const { Bookmark, BookmarkFolder } = ChromeUtils.importESModule(
  "resource://services-sync/engines/bookmarks.sys.mjs"
);
const { Weave } = ChromeUtils.importESModule(
  "resource://services-sync/main.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

async function serverForFoo(engine) {
  await generateNewKeys(Service.collectionKeys);

  let clientsEngine = Service.clientsEngine;
  let clientsSyncID = await clientsEngine.resetLocalSyncID();
  let engineSyncID = await engine.resetLocalSyncID();
  return serverForUsers(
    { foo: "password" },
    {
      meta: {
        global: {
          syncID: Service.syncID,
          storageVersion: STORAGE_VERSION,
          engines: {
            clients: {
              version: clientsEngine.version,
              syncID: clientsSyncID,
            },
            [engine.name]: {
              version: engine.version,
              syncID: engineSyncID,
            },
          },
        },
      },
      crypto: {
        keys: encryptPayload({
          id: "keys",
          // Generate a fake default key bundle to avoid resetting the client
          // before the first sync.
          default: [
            await Weave.Crypto.generateRandomKey(),
            await Weave.Crypto.generateRandomKey(),
          ],
        }),
      },
      [engine.name]: {},
    }
  );
}

async function resolveConflict(
  engine,
  collection,
  timestamp,
  buildTree,
  message
) {
  let guids = {
    // These items don't exist on the server.
    fx: Utils.makeGUID(),
    nightly: Utils.makeGUID(),
    support: Utils.makeGUID(),
    customize: Utils.makeGUID(),

    // These exist on the server, but in a different order, and `res`
    // has completely different children.
    res: Utils.makeGUID(),
    tb: Utils.makeGUID(),

    // These don't exist locally.
    bz: Utils.makeGUID(),
    irc: Utils.makeGUID(),
    mdn: Utils.makeGUID(),
  };

  await PlacesUtils.bookmarks.insertTree({
    guid: PlacesUtils.bookmarks.menuGuid,
    children: [
      {
        guid: guids.fx,
        title: "Get Firefox!",
        url: "http://getfirefox.com/",
      },
      {
        guid: guids.res,
        title: "Resources",
        type: PlacesUtils.bookmarks.TYPE_FOLDER,
        children: [
          {
            guid: guids.nightly,
            title: "Nightly",
            url: "https://nightly.mozilla.org/",
          },
          {
            guid: guids.support,
            title: "Support",
            url: "https://support.mozilla.org/",
          },
          {
            guid: guids.customize,
            title: "Customize",
            url: "https://mozilla.org/firefox/customize/",
          },
        ],
      },
      {
        title: "Get Thunderbird!",
        guid: guids.tb,
        url: "http://getthunderbird.com/",
      },
    ],
  });

  let serverRecords = [
    {
      id: "menu",
      type: "folder",
      title: "Bookmarks Menu",
      parentid: "places",
      children: [guids.tb, guids.res],
    },
    {
      id: guids.tb,
      type: "bookmark",
      parentid: "menu",
      bmkUri: "http://getthunderbird.com/",
      title: "Get Thunderbird!",
    },
    {
      id: guids.res,
      type: "folder",
      parentid: "menu",
      title: "Resources",
      children: [guids.irc, guids.bz, guids.mdn],
    },
    {
      id: guids.bz,
      type: "bookmark",
      parentid: guids.res,
      bmkUri: "https://bugzilla.mozilla.org/",
      title: "Bugzilla",
    },
    {
      id: guids.mdn,
      type: "bookmark",
      parentid: guids.res,
      bmkUri: "https://developer.mozilla.org/",
      title: "MDN",
    },
    {
      id: guids.irc,
      type: "bookmark",
      parentid: guids.res,
      bmkUri: "ircs://irc.mozilla.org/nightly",
      title: "IRC",
    },
  ];
  for (let record of serverRecords) {
    collection.insert(record.id, encryptPayload(record), timestamp);
  }

  engine.lastModified = collection.timestamp;
  await sync_engine_and_validate_telem(engine, false);

  let expectedTree = buildTree(guids);
  await assertBookmarksTreeMatches(
    PlacesUtils.bookmarks.menuGuid,
    expectedTree,
    message
  );
}

async function get_engine() {
  return Service.engineManager.get("bookmarks");
}

add_task(async function test_local_order_newer() {
  let engine = await get_engine();
  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  try {
    let collection = server.user("foo").collection("bookmarks");
    let serverModified = Date.now() / 1000 - 120;
    await resolveConflict(
      engine,
      collection,
      serverModified,
      guids => [
        {
          guid: guids.fx,
          index: 0,
        },
        {
          guid: guids.res,
          index: 1,
          children: [
            {
              guid: guids.nightly,
              index: 0,
            },
            {
              guid: guids.support,
              index: 1,
            },
            {
              guid: guids.customize,
              index: 2,
            },
            {
              guid: guids.irc,
              index: 3,
            },
            {
              guid: guids.bz,
              index: 4,
            },
            {
              guid: guids.mdn,
              index: 5,
            },
          ],
        },
        {
          guid: guids.tb,
          index: 2,
        },
      ],
      "Should use local order as base if remote is older"
    );
  } finally {
    await engine.wipeClient();
    await Service.startOver();
    await promiseStopServer(server);
  }
});

add_task(async function test_remote_order_newer() {
  let engine = await get_engine();
  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  try {
    let collection = server.user("foo").collection("bookmarks");
    let serverModified = Date.now() / 1000 + 120;
    await resolveConflict(
      engine,
      collection,
      serverModified,
      guids => [
        {
          guid: guids.tb,
          index: 0,
        },
        {
          guid: guids.res,
          index: 1,
          children: [
            {
              guid: guids.irc,
              index: 0,
            },
            {
              guid: guids.bz,
              index: 1,
            },
            {
              guid: guids.mdn,
              index: 2,
            },
            {
              guid: guids.nightly,
              index: 3,
            },
            {
              guid: guids.support,
              index: 4,
            },
            {
              guid: guids.customize,
              index: 5,
            },
          ],
        },
        {
          guid: guids.fx,
          index: 2,
        },
      ],
      "Should use remote order as base if local is older"
    );
  } finally {
    await engine.wipeClient();
    await Service.startOver();
    await promiseStopServer(server);
  }
});

add_task(async function test_bookmark_order() {
  let engine = await get_engine();
  let store = engine._store;
  _("Starting with a clean slate of no bookmarks");
  await store.wipe();
  await assertBookmarksTreeMatches(
    "",
    [
      {
        guid: PlacesUtils.bookmarks.menuGuid,
        index: 0,
      },
      {
        guid: PlacesUtils.bookmarks.toolbarGuid,
        index: 1,
      },
      {
        // Index 2 is the tags root. (Root indices depend on the order of the
        // `CreateRoot` calls in `Database::CreateBookmarkRoots`).
        guid: PlacesUtils.bookmarks.unfiledGuid,
        index: 3,
      },
      {
        guid: PlacesUtils.bookmarks.mobileGuid,
        index: 4,
      },
    ],
    "clean slate"
  );

  function bookmark(name, parent) {
    let bm = new Bookmark("http://weave.server/my-bookmark");
    bm.id = name;
    bm.title = name;
    bm.bmkUri = "http://uri/";
    bm.parentid = parent || "unfiled";
    bm.tags = [];
    return bm;
  }

  function folder(name, parent, children) {
    let bmFolder = new BookmarkFolder("http://weave.server/my-bookmark-folder");
    bmFolder.id = name;
    bmFolder.title = name;
    bmFolder.parentid = parent || "unfiled";
    bmFolder.children = children;
    return bmFolder;
  }

  async function apply(records) {
    for (record of records) {
      await store.applyIncoming(record);
    }
    await engine._apply();
  }
  let id10 = "10_aaaaaaaaa";
  _("basic add first bookmark");
  await apply([bookmark(id10, "")]);
  await assertBookmarksTreeMatches(
    "",
    [
      {
        guid: PlacesUtils.bookmarks.menuGuid,
        index: 0,
      },
      {
        guid: PlacesUtils.bookmarks.toolbarGuid,
        index: 1,
      },
      {
        guid: PlacesUtils.bookmarks.unfiledGuid,
        index: 3,
        children: [
          {
            guid: id10,
            index: 0,
          },
        ],
      },
      {
        guid: PlacesUtils.bookmarks.mobileGuid,
        index: 4,
      },
    ],
    "basic add first bookmark"
  );
  let id20 = "20_aaaaaaaaa";
  _("basic append behind 10");
  await apply([bookmark(id20, "")]);
  await assertBookmarksTreeMatches(
    "",
    [
      {
        guid: PlacesUtils.bookmarks.menuGuid,
        index: 0,
      },
      {
        guid: PlacesUtils.bookmarks.toolbarGuid,
        index: 1,
      },
      {
        guid: PlacesUtils.bookmarks.unfiledGuid,
        index: 3,
        children: [
          {
            guid: id10,
            index: 0,
          },
          {
            guid: id20,
            index: 1,
          },
        ],
      },
      {
        guid: PlacesUtils.bookmarks.mobileGuid,
        index: 4,
      },
    ],
    "basic append behind 10"
  );

  let id31 = "31_aaaaaaaaa";
  let id30 = "f30_aaaaaaaa";
  _("basic create in folder");
  let b31 = bookmark(id31, id30);
  let f30 = folder(id30, "", [id31]);
  await apply([b31, f30]);
  await assertBookmarksTreeMatches(
    "",
    [
      {
        guid: PlacesUtils.bookmarks.menuGuid,
        index: 0,
      },
      {
        guid: PlacesUtils.bookmarks.toolbarGuid,
        index: 1,
      },
      {
        guid: PlacesUtils.bookmarks.unfiledGuid,
        index: 3,
        children: [
          {
            guid: id10,
            index: 0,
          },
          {
            guid: id20,
            index: 1,
          },
          {
            guid: id30,
            index: 2,
            children: [
              {
                guid: id31,
                index: 0,
              },
            ],
          },
        ],
      },
      {
        guid: PlacesUtils.bookmarks.mobileGuid,
        index: 4,
      },
    ],
    "basic create in folder"
  );

  let id41 = "41_aaaaaaaaa";
  let id40 = "f40_aaaaaaaa";
  _("insert missing parent -> append to unfiled");
  await apply([bookmark(id41, id40)]);
  await assertBookmarksTreeMatches(
    "",
    [
      {
        guid: PlacesUtils.bookmarks.menuGuid,
        index: 0,
      },
      {
        guid: PlacesUtils.bookmarks.toolbarGuid,
        index: 1,
      },
      {
        guid: PlacesUtils.bookmarks.unfiledGuid,
        index: 3,
        children: [
          {
            guid: id10,
            index: 0,
          },
          {
            guid: id20,
            index: 1,
          },
          {
            guid: id30,
            index: 2,
            children: [
              {
                guid: id31,
                index: 0,
              },
            ],
          },
          {
            guid: id41,
            index: 3,
          },
        ],
      },
      {
        guid: PlacesUtils.bookmarks.mobileGuid,
        index: 4,
      },
    ],
    "insert missing parent -> append to unfiled"
  );

  let id42 = "42_aaaaaaaaa";

  _("insert another missing parent -> append");
  await apply([bookmark(id42, id40)]);
  await assertBookmarksTreeMatches(
    "",
    [
      {
        guid: PlacesUtils.bookmarks.menuGuid,
        index: 0,
      },
      {
        guid: PlacesUtils.bookmarks.toolbarGuid,
        index: 1,
      },
      {
        guid: PlacesUtils.bookmarks.unfiledGuid,
        index: 3,
        children: [
          {
            guid: id10,
            index: 0,
          },
          {
            guid: id20,
            index: 1,
          },
          {
            guid: id30,
            index: 2,
            children: [
              {
                guid: id31,
                index: 0,
              },
            ],
          },
          {
            guid: id41,
            index: 3,
          },
          {
            guid: id42,
            index: 4,
          },
        ],
      },
      {
        guid: PlacesUtils.bookmarks.mobileGuid,
        index: 4,
      },
    ],
    "insert another missing parent -> append"
  );

  await engine.wipeClient();
  await Service.startOver();
  await engine.finalize();
});
