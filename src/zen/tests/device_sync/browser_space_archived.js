/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function spaceRecord(uuid, data) {
  return {
    id: uuid,
    deleted: false,
    cleartext: { kind: "space", data },
  };
}

function isArchived(uuid) {
  return gZenWorkspaces.isWorkspaceArchived(
    gZenWorkspaces.getWorkspaceFromId(uuid)
  );
}

add_task(async function test_archived_flag_round_trips() {
  await gZenWorkspaces.promiseInitialized;
  const space = await gZenWorkspaces.createAndSaveWorkspace("Sync Archive");
  const uuid = space.uuid;
  registerCleanupFunction(() => gZenWorkspaces.removeWorkspace(uuid));
  await gZenWorkspaces.archiveWorkspace(uuid);

  const projected = (await collectProjections()).get(uuid)?.data;
  Assert.ok(projected, "the space projects");
  Assert.strictEqual(projected.archived, true, "the flag is projected");

  let failed = await ZenSpacesSyncApplier.applyBatch([
    spaceRecord(uuid, { ...projected, archived: false }),
  ]);
  Assert.deepEqual(failed, [], "a restore from another device applies");
  Assert.ok(!isArchived(uuid), "the space is restored");

  failed = await ZenSpacesSyncApplier.applyBatch([
    spaceRecord(uuid, { ...projected, archived: true }),
  ]);
  Assert.deepEqual(failed, [], "an archive from another device applies");
  Assert.ok(isArchived(uuid), "the space is archived again");

  const { archived: _ignored, ...legacy } = projected;
  failed = await ZenSpacesSyncApplier.applyBatch([
    spaceRecord(uuid, { ...legacy, name: "Renamed elsewhere" }),
  ]);
  Assert.deepEqual(failed, [], "a record from an older client applies");
  Assert.ok(isArchived(uuid), "a record without the flag keeps it archived");
  Assert.equal(
    gZenWorkspaces.getWorkspaceFromId(uuid).name,
    "Renamed elsewhere",
    "the rest of the record still applies"
  );

  ZenSpacesSyncModel.noteApplied(uuid, null);
});
