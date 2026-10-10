/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

let prefsWithUserValue = new Set();
add_setup(function record_prefsWithUserValue() {
  for (const pref of Services.prefs.getChildList("")) {
    if (Services.prefs.prefHasUserValue(pref)) {
      prefsWithUserValue.add(pref);
    }
  }
});

function clearValues() {
  for (const pref of Services.prefs.getChildList("")) {
    if (!prefsWithUserValue.has(pref)) {
      Services.prefs.clearUserPref(pref);
    }
  }
}

add_task(async function run_test() {
  let engine = Service.engineManager.get("prefs");
  let tracker = engine._tracker;

  try {
    _("tracker.modified corresponds to preference.");
    // Assert preference is not defined.
    Assert.equal(
      Svc.PrefBranch.getPrefType("engine.prefs.modified"),
      Ci.nsIPrefBranch.PREF_INVALID
    );
    Assert.ok(!tracker.modified);

    tracker.modified = true;
    Assert.equal(Svc.PrefBranch.getBoolPref("engine.prefs.modified"), true);
    Assert.ok(tracker.modified);

    _("Engine's getChangedID() just returns the one GUID we have.");
    let changedIDs = await engine.getChangedIDs();
    let ids = Object.keys(changedIDs);
    Assert.equal(ids.length, 1);
    Assert.equal(ids[0], CommonUtils.encodeBase64URL(Services.appinfo.ID));

    Svc.PrefBranch.setBoolPref("engine.prefs.modified", false);
    Assert.ok(!tracker.modified);

    _("No modified state, so no changed IDs.");
    do_check_empty(await engine.getChangedIDs());

    _("Initial score is 0");
    Assert.equal(tracker.score, 0);

    _("Test fixtures.");
    Svc.PrefBranch.setBoolPref("prefs.sync.testing.int", true);

    _(
      "Test fixtures haven't upped the tracker score yet because it hasn't started tracking yet."
    );
    Assert.equal(tracker.score, 0);

    _("Tell the tracker to start tracking changes.");
    tracker.start();
    Services.prefs.setIntPref("testing.int", 23);
    await tracker.asyncObserver.promiseObserversComplete();
    Assert.equal(tracker.score, SCORE_INCREMENT_XLARGE);
    Assert.equal(tracker.modified, true);

    _("Clearing changed IDs reset modified status.");
    await tracker.clearChangedIDs();
    Assert.equal(tracker.modified, false);

    _("Resetting a pref ups the score, too.");
    Services.prefs.clearUserPref("testing.int");
    await tracker.asyncObserver.promiseObserversComplete();
    Assert.equal(tracker.score, SCORE_INCREMENT_XLARGE * 2);
    Assert.equal(tracker.modified, true);
    await tracker.clearChangedIDs();

    _("So does changing a pref sync pref.");
    Svc.PrefBranch.setBoolPref("prefs.sync.testing.int", false);
    await tracker.asyncObserver.promiseObserversComplete();
    Assert.equal(tracker.score, SCORE_INCREMENT_XLARGE * 3);
    Assert.equal(tracker.modified, true);
    await tracker.clearChangedIDs();

    _(
      "Now that the pref sync pref has been flipped, changes to it won't be picked up."
    );
    Services.prefs.setIntPref("testing.int", 42);
    await tracker.asyncObserver.promiseObserversComplete();
    Assert.equal(tracker.score, SCORE_INCREMENT_XLARGE * 3);
    Assert.equal(tracker.modified, false);
    await tracker.clearChangedIDs();

    _("Changing some other random pref won't do anything.");
    Services.prefs.setStringPref("testing.other", "blergh");
    await tracker.asyncObserver.promiseObserversComplete();
    Assert.equal(tracker.score, SCORE_INCREMENT_XLARGE * 3);
    Assert.equal(tracker.modified, false);
  } finally {
    await tracker.stop();
    clearValues();
  }
});
