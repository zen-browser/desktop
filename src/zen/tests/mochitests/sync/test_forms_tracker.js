/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { FormEngine } = ChromeUtils.importESModule(
  "resource://services-sync/engines/forms.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

add_task(async function run_test() {
  _("Verify we've got an empty tracker to work with.");
  let engine = new FormEngine(Service);
  await engine.initialize();
  let tracker = engine._tracker;

  let changes = await tracker.getChangedIDs();
  do_check_empty(changes);
  Log.repository.rootLogger.addAppender(new Log.DumpAppender());

  async function addEntry(name, value) {
    await engine._store.create({ name, value });
    await engine._tracker.asyncObserver.promiseObserversComplete();
  }
  async function removeEntry(name, value) {
    let guid = await engine._findDupe({ name, value });
    await engine._store.remove({ id: guid });
    await engine._tracker.asyncObserver.promiseObserversComplete();
  }

  try {
    _("Create an entry. Won't show because we haven't started tracking yet");
    await addEntry("name", "John Doe");
    changes = await tracker.getChangedIDs();
    do_check_empty(changes);

    _("Tell the tracker to start tracking changes.");
    tracker.start();
    await removeEntry("name", "John Doe");
    await addEntry("email", "john@doe.com");
    changes = await tracker.getChangedIDs();
    do_check_attribute_count(changes, 2);

    _("Notifying twice won't do any harm.");
    tracker.start();
    await addEntry("address", "Memory Lane");
    changes = await tracker.getChangedIDs();
    do_check_attribute_count(changes, 3);

    _("Check that ignoreAll is respected");
    await tracker.clearChangedIDs();
    tracker.score = 0;
    tracker.ignoreAll = true;
    await addEntry("username", "johndoe123");
    await addEntry("favoritecolor", "green");
    await removeEntry("name", "John Doe");
    tracker.ignoreAll = false;
    changes = await tracker.getChangedIDs();
    do_check_empty(changes);
    equal(tracker.score, 0);

    _("Let's stop tracking again.");
    await tracker.clearChangedIDs();
    await tracker.stop();
    await removeEntry("address", "Memory Lane");
    changes = await tracker.getChangedIDs();
    do_check_empty(changes);

    _("Notifying twice won't do any harm.");
    await tracker.stop();
    await removeEntry("email", "john@doe.com");
    changes = await tracker.getChangedIDs();
    do_check_empty(changes);
  } finally {
    _("Clean up.");
    await engine._store.wipe();
  }
});
