/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

add_task(async function test_tracker_basics() {
  let tracker = new LegacyTracker("Tracker", Service);

  let id = "the_id!";

  _("Make sure nothing exists yet..");
  let changes = await tracker.getChangedIDs();
  Assert.equal(changes[id], null);

  _("Make sure adding of time 0 works");
  await tracker.addChangedID(id, 0);
  changes = await tracker.getChangedIDs();
  Assert.equal(changes[id], 0);

  _("A newer time will replace the old 0");
  await tracker.addChangedID(id, 10);
  changes = await tracker.getChangedIDs();
  Assert.equal(changes[id], 10);

  _("An older time will not replace the newer 10");
  await tracker.addChangedID(id, 5);
  changes = await tracker.getChangedIDs();
  Assert.equal(changes[id], 10);

  _("Adding without time defaults to current time");
  await tracker.addChangedID(id);
  changes = await tracker.getChangedIDs();
  Assert.greater(changes[id], 10);
});

add_task(async function test_tracker_persistence() {
  let tracker = new LegacyTracker("Tracker", Service);
  let id = "abcdef";

  let promiseSave = new Promise((resolve, reject) => {
    let save = tracker._storage._save;
    tracker._storage._save = function () {
      save.call(tracker._storage).then(resolve, reject);
    };
  });

  await tracker.addChangedID(id, 5);

  await promiseSave;

  _("IDs saved.");
  const changes = await tracker.getChangedIDs();
  Assert.equal(5, changes[id]);

  let json = await Utils.jsonLoad(["changes", "tracker"], tracker);
  Assert.equal(5, json[id]);
});
