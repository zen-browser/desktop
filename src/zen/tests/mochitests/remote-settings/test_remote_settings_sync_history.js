"use strict";

async function clear_state() {
  await new SyncHistory("").clear();
}
add_task(clear_state);

add_task(async function test_entries_are_stored_by_source() {
  const history = new SyncHistory();
  await history.store(42, "success", { pi: "3.14" });
  // Check that history is isolated by source.
  await new SyncHistory("main/cfr").store(88, "error");

  const l = await history.list();

  Assert.deepEqual(l, [
    {
      timestamp: 42,
      status: "success",
      infos: { pi: "3.14" },
      datetime: new Date(42),
    },
  ]);
});
add_task(clear_state);

add_task(
  async function test_old_entries_are_removed_keep_fixed_size_per_source() {
    const history = new SyncHistory("settings-sync", { size: 3 });
    const anotherHistory = await new SyncHistory("main/cfr");

    await history.store(42, "success");
    await history.store(41, "sync_error");
    await history.store(43, "up_to_date");

    let l = await history.list();
    Assert.equal(l.length, 3);

    await history.store(44, "success");
    await anotherHistory.store(44, "success");

    l = await history.list();
    Assert.equal(l.length, 3);
    Assert.ok(!l.map(e => e.timestamp).includes(41));

    l = await anotherHistory.list();
    Assert.equal(l.length, 1);
  }
);
add_task(clear_state);

add_task(async function test_entries_are_sorted_by_timestamp_desc() {
  const history = new SyncHistory("settings-sync");
  await history.store(42, "success");
  await history.store(41, "sync_error");
  await history.store(44, "up_to_date");

  const l = await history.list();

  Assert.deepEqual(
    l.map(e => e.timestamp),
    [44, 42, 41]
  );
});
add_task(clear_state);
