/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { HistoryEngine } = ChromeUtils.importESModule(
  "resource://services-sync/engines/history.sys.mjs"
);

// Use only for rawAddVisit.
XPCOMUtils.defineLazyServiceGetter(
  this,
  "asyncHistory",
  "@mozilla.org/browser/history;1",
  Ci.mozIAsyncHistory
);
async function rawAddVisit(id, uri, visitPRTime, transitionType) {
  return new Promise(resolve => {
    let results = [];
    let handler = {
      handleResult(result) {
        results.push(result);
      },
      handleError(resultCode) {
        do_throw(`updatePlaces gave error ${resultCode}!`);
      },
      handleCompletion(count) {
        resolve({ results, count });
      },
    };
    asyncHistory.updatePlaces(
      [
        {
          guid: id,
          uri: typeof uri == "string" ? CommonUtils.makeURI(uri) : uri,
          visits: [{ visitDate: visitPRTime, transitionType }],
        },
      ],
      handler
    );
  });
}

add_task(async function test_history_download_limit() {
  let engine = new HistoryEngine(Service);
  await engine.initialize();

  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let lastSync = new_timestamp();

  let collection = server.user("foo").collection("history");
  for (let i = 0; i < 15; i++) {
    let id = "place" + i.toString(10).padStart(7, "0");
    let wbo = new ServerWBO(
      id,
      encryptPayload({
        id,
        histUri: "http://example.com/" + i,
        title: "Page " + i,
        visits: [
          {
            date: Date.now() * 1000,
            type: PlacesUtils.history.TRANSITIONS.TYPED,
          },
          {
            date: Date.now() * 1000,
            type: PlacesUtils.history.TRANSITIONS.LINK,
          },
        ],
      }),
      lastSync + 1 + i
    );
    wbo.sortindex = 15 - i;
    collection.insertWBO(wbo);
  }

  // We have 15 records on the server since the last sync, but our download
  // limit is 5 records at a time. We should eventually fetch all 15.
  await engine.setLastSync(lastSync);
  engine.downloadBatchSize = 4;
  engine.downloadLimit = 5;

  // Don't actually fetch any backlogged records, so that we can inspect
  // the backlog between syncs.
  engine.guidFetchBatchSize = 0;

  let ping = await sync_engine_and_validate_telem(engine, false);
  deepEqual(ping.engines[0].incoming, { applied: 5 });

  let backlogAfterFirstSync = Array.from(engine.toFetch).sort();
  deepEqual(backlogAfterFirstSync, [
    "place0000000",
    "place0000001",
    "place0000002",
    "place0000003",
    "place0000004",
    "place0000005",
    "place0000006",
    "place0000007",
    "place0000008",
    "place0000009",
  ]);

  // We should have fast-forwarded the last sync time.
  equal(await engine.getLastSync(), lastSync + 15);

  engine.lastModified = collection.modified;
  ping = await sync_engine_and_validate_telem(engine, false);
  ok(!ping.engines[0].incoming);

  // After the second sync, our backlog still contains the same GUIDs: we
  // weren't able to make progress on fetching them, since our
  // `guidFetchBatchSize` is 0.
  let backlogAfterSecondSync = Array.from(engine.toFetch).sort();
  deepEqual(backlogAfterFirstSync, backlogAfterSecondSync);

  // Now add a newer record to the server.
  let newWBO = new ServerWBO(
    "placeAAAAAAA",
    encryptPayload({
      id: "placeAAAAAAA",
      histUri: "http://example.com/a",
      title: "New Page A",
      visits: [
        {
          date: Date.now() * 1000,
          type: PlacesUtils.history.TRANSITIONS.TYPED,
        },
      ],
    }),
    lastSync + 20
  );
  newWBO.sortindex = -1;
  collection.insertWBO(newWBO);

  engine.lastModified = collection.modified;
  ping = await sync_engine_and_validate_telem(engine, false);
  deepEqual(ping.engines[0].incoming, { applied: 1 });

  // Our backlog should remain the same.
  let backlogAfterThirdSync = Array.from(engine.toFetch).sort();
  deepEqual(backlogAfterSecondSync, backlogAfterThirdSync);

  equal(await engine.getLastSync(), lastSync + 20);

  // Bump the fetch batch size to let the backlog make progress. We should
  // make 3 requests to fetch 5 backlogged GUIDs.
  engine.guidFetchBatchSize = 2;

  engine.lastModified = collection.modified;
  ping = await sync_engine_and_validate_telem(engine, false);
  deepEqual(ping.engines[0].incoming, { applied: 5 });

  deepEqual(Array.from(engine.toFetch).sort(), [
    "place0000005",
    "place0000006",
    "place0000007",
    "place0000008",
    "place0000009",
  ]);

  // Sync again to clear out the backlog.
  engine.lastModified = collection.modified;
  ping = await sync_engine_and_validate_telem(engine, false);
  deepEqual(ping.engines[0].incoming, { applied: 5 });

  deepEqual(Array.from(engine.toFetch), []);

  await engine.wipeClient();
  await engine.finalize();
});

add_task(async function test_history_visit_roundtrip() {
  let engine = new HistoryEngine(Service);
  await engine.initialize();
  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  engine._tracker.start();

  let id = "aaaaaaaaaaaa";
  let oneHourMS = 60 * 60 * 1000;
  // Insert a visit with a non-round microsecond timestamp (e.g. it's not evenly
  // divisible by 1000). This will typically be the case for visits that occur
  // during normal navigation.
  let time = (Date.now() - oneHourMS) * 1000 + 555;
  // We use the low level history api since it lets us provide microseconds
  let { count } = await rawAddVisit(
    id,
    "https://www.example.com",
    time,
    PlacesUtils.history.TRANSITIONS.TYPED
  );
  equal(count, 1);
  // Check that it was inserted and that we didn't round on the insert.
  let visits = await PlacesSyncUtils.history.fetchVisitsForURL(
    "https://www.example.com"
  );
  equal(visits.length, 1);
  equal(visits[0].date, time);

  let collection = server.user("foo").collection("history");

  // Sync the visit up to the server.
  await sync_engine_and_validate_telem(engine, false);

  collection.updateRecord(
    id,
    cleartext => {
      // Double-check that we didn't round the visit's timestamp to the nearest
      // millisecond when uploading.
      equal(cleartext.visits[0].date, time);
      // Add a remote visit so that we get past the deepEquals check in reconcile
      // (otherwise the history engine will skip applying this record). The
      // contents of this visit don't matter, beyond the fact that it needs to
      // exist.
      cleartext.visits.push({
        date: (Date.now() - oneHourMS / 2) * 1000,
        type: PlacesUtils.history.TRANSITIONS.LINK,
      });
    },
    new_timestamp() + 10
  );

  // Force a remote sync.
  await engine.setLastSync(new_timestamp() - 30);
  await sync_engine_and_validate_telem(engine, false);

  // Make sure that we didn't duplicate the visit when inserting. (Prior to bug
  // 1423395, we would insert a duplicate visit, where the timestamp was
  // effectively `Math.round(microsecondTimestamp / 1000) * 1000`.)
  visits = await PlacesSyncUtils.history.fetchVisitsForURL(
    "https://www.example.com"
  );
  equal(visits.length, 2);

  await engine.wipeClient();
  await engine.finalize();
});

add_task(async function test_history_visit_dedupe_old() {
  let engine = new HistoryEngine(Service);
  await engine.initialize();
  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let initialVisits = Array.from({ length: 25 }, (_, index) => ({
    transition: PlacesUtils.history.TRANSITION_LINK,
    date: new Date(Date.UTC(2017, 10, 1 + index)),
  }));
  initialVisits.push({
    transition: PlacesUtils.history.TRANSITION_LINK,
    date: new Date(),
  });
  await PlacesUtils.history.insert({
    url: "https://www.example.com",
    visits: initialVisits,
  });

  let recentVisits = await PlacesSyncUtils.history.fetchVisitsForURL(
    "https://www.example.com"
  );
  equal(recentVisits.length, 20);
  let { visits: allVisits, guid } = await PlacesUtils.history.fetch(
    "https://www.example.com",
    {
      includeVisits: true,
    }
  );
  equal(allVisits.length, 26);

  let collection = server.user("foo").collection("history");

  await sync_engine_and_validate_telem(engine, false);

  collection.updateRecord(
    guid,
    data => {
      data.visits.push(
        // Add a couple remote visit equivalent to some old visits we have already
        {
          date: Date.UTC(2017, 10, 1) * 1000, // Nov 1, 2017
          type: PlacesUtils.history.TRANSITIONS.LINK,
        },
        {
          date: Date.UTC(2017, 10, 2) * 1000, // Nov 2, 2017
          type: PlacesUtils.history.TRANSITIONS.LINK,
        },
        // Add a couple new visits to make sure we are still applying them.
        {
          date: Date.UTC(2017, 11, 4) * 1000, // Dec 4, 2017
          type: PlacesUtils.history.TRANSITIONS.LINK,
        },
        {
          date: Date.UTC(2017, 11, 5) * 1000, // Dec 5, 2017
          type: PlacesUtils.history.TRANSITIONS.LINK,
        }
      );
    },
    new_timestamp() + 10
  );

  await engine.setLastSync(new_timestamp() - 30);
  await sync_engine_and_validate_telem(engine, false);

  allVisits = (
    await PlacesUtils.history.fetch("https://www.example.com", {
      includeVisits: true,
    })
  ).visits;

  equal(allVisits.length, 28);
  ok(
    allVisits.find(x => x.date.getTime() === Date.UTC(2017, 11, 4)),
    "Should contain the Dec. 4th visit"
  );
  ok(
    allVisits.find(x => x.date.getTime() === Date.UTC(2017, 11, 5)),
    "Should contain the Dec. 5th visit"
  );

  await engine.wipeClient();
  await engine.finalize();
});

add_task(async function test_history_unknown_fields() {
  let engine = new HistoryEngine(Service);
  await engine.initialize();
  let server = await serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  engine._tracker.start();

  let id = "aaaaaaaaaaaa";
  let oneHourMS = 60 * 60 * 1000;
  // Insert a visit with a non-round microsecond timestamp (e.g. it's not evenly
  // divisible by 1000). This will typically be the case for visits that occur
  // during normal navigation.
  let time = (Date.now() - oneHourMS) * 1000 + 555;
  // We use the low level history api since it lets us provide microseconds
  let { count } = await rawAddVisit(
    id,
    "https://www.example.com",
    time,
    PlacesUtils.history.TRANSITIONS.TYPED
  );
  equal(count, 1);

  let collection = server.user("foo").collection("history");

  // Sync the visit up to the server.
  await sync_engine_and_validate_telem(engine, false);

  collection.updateRecord(
    id,
    cleartext => {
      equal(cleartext.visits[0].date, time);

      // Add unknown fields to an instance of a visit
      cleartext.visits.push({
        date: (Date.now() - oneHourMS / 2) * 1000,
        type: PlacesUtils.history.TRANSITIONS.LINK,
        unknownVisitField: "an unknown field could show up in a visit!",
      });
      cleartext.title = "A page title";
      // Add unknown fields to the payload for this URL
      cleartext.unknownStrField = "an unknown str field";
      cleartext.unknownObjField = { newField: "a field within an object" };
    },
    new_timestamp() + 10
  );

  // Force a remote sync.
  await engine.setLastSync(new_timestamp() - 30);
  await sync_engine_and_validate_telem(engine, false);

  // Add a new visit to ensure we're actually putting things back on the server
  let newTime = (Date.now() - oneHourMS) * 1000 + 555;
  await rawAddVisit(
    id,
    "https://www.example.com",
    newTime,
    PlacesUtils.history.TRANSITIONS.LINK
  );

  // Sync again
  await engine.setLastSync(new_timestamp() - 30);
  await sync_engine_and_validate_telem(engine, false);

  let placeInfo = await PlacesSyncUtils.history.fetchURLInfoForGuid(id);

  // Found the place we're looking for
  Assert.equal(placeInfo.title, "A page title");
  Assert.equal(placeInfo.url, "https://www.example.com/");

  // It correctly returns any unknownFields that might've been
  // stored in the moz_places_extra table
  deepEqual(JSON.parse(placeInfo.unknownFields), {
    unknownStrField: "an unknown str field",
    unknownObjField: { newField: "a field within an object" },
  });

  // Getting visits via SyncUtils also will return unknownFields
  // via the moz_historyvisits_extra table
  let visits = await PlacesSyncUtils.history.fetchVisitsForURL(
    "https://www.example.com"
  );
  equal(visits.length, 3);

  // fetchVisitsForURL is a sync method that gets called during upload
  // so unknown field should already be at the top-level
  deepEqual(
    visits[0].unknownVisitField,
    "an unknown field could show up in a visit!"
  );

  // Remote history record should have the fields back at the top level
  let remotePlace = collection.payloads().find(rec => rec.id === id);
  deepEqual(remotePlace.unknownStrField, "an unknown str field");
  deepEqual(remotePlace.unknownObjField, {
    newField: "a field within an object",
  });

  await engine.wipeClient();
  await engine.finalize();
});
