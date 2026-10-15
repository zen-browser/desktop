"use strict";

async function getLocalDumpLastModified(bucket, collection) {
  let res;
  try {
    res = await fetch(
      `resource://app/defaults/settings/${bucket}/${collection}.json`
    );
  } catch (e) {
    return -1;
  }
  const { timestamp } = await res.json();
  Assert.greaterOrEqual(
    timestamp,
    0,
    `${bucket}/${collection} dump has timestamp`
  );
  return timestamp;
}

add_task(async function lastModified_of_non_existing_dump() {
  ok(!Utils._dumpStats, "_dumpStats not initialized");
  equal(
    await Utils.getLocalDumpLastModified("did not", "exist"),
    -1,
    "A non-existent dump has value -1"
  );
  ok(Utils._dumpStats, "_dumpStats was initialized");

  ok("did not/exist" in Utils._dumpStats, "cached non-existing dump result");
  delete Utils._dumpStats["did not/exist"];
});

add_task(async function lastModified_summary_is_correct() {
  ok(!!Object.keys(Utils._dumpStats).length, "Contains summary of dumps");

  let checked = 0;
  for (let [identifier, lastModified] of Object.entries(Utils._dumpStats)) {
    let [bucket, collection] = identifier.split("/");
    let actual = await getLocalDumpLastModified(bucket, collection);
    if (actual < 0) {
      info(`${identifier} has no dump, skip.`);
      continue;
    }
    info(`Checking correctness of ${identifier}`);
    equal(
      await Utils.getLocalDumpLastModified(bucket, collection),
      lastModified,
      `Expected last_modified value for ${identifier}`
    );
    equal(lastModified, actual, `last_modified should match collection`);
    checked++;
  }
  Assert.greater(checked, 0, "At least one dump was packaged and checked.");
});
